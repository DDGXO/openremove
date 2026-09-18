const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { spawn } = require('child_process');

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_DIR = path.resolve(__dirname);
const TMP_DIR = path.join(BASE_DIR, 'tmp');
const OUTPUT_DIR = TMP_DIR;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const MODEL_PATH = process.env.MODEL_PATH || path.join(BASE_DIR, 'models', 'lite', 'model.onnx');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use('/tmp', express.static(TMP_DIR));

// Healthcheck / Ping Routes
app.get(['/ping', '/api/ping'], (req, res) => {
    res.json({
        status: true,
        message: 'pong',
        app: 'OpenRemove',
        timestamp: Date.now()
    });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `upload-${uniqueSuffix}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

const jobs = new Map();

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: false, error: 'Image file is required.' });
    }

    const jobId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    jobs.set(jobId, {
        jobId,
        inputPath: req.file.path,
        filename: req.file.filename,
        size: req.file.size
    });

    res.json({ status: true, jobId, filename: req.file.filename });
});

app.get('/api/process-stream/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ status: false, error: 'Job ID not found.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let isClosed = false;
    let childProcess = null;

    req.on('close', () => {
        isClosed = true;
        if (childProcess) {
            try { childProcess.kill(); } catch (_) {}
        }
    });

    const sendEvent = (percent, statusText, logMsg) => {
        if (isClosed) return;
        const now = new Date().toTimeString().split(' ')[0];
        const logLine = `[${now}] ${logMsg || statusText}`;
        try {
            res.write(`event: progress\ndata: ${JSON.stringify({ percent, statusText, log: logLine })}\n\n`);
        } catch (_) {}
    };

    const startTime = Date.now();
    const inputPath = job.inputPath;
    const outputFilename = `nobg-${path.parse(job.filename).name}.png`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    try {
        sendEvent(5, 'Initializing AI engine...', `Received file: ${job.filename} (${(job.size / 1024).toFixed(1)} KB)`);
        
        sendEvent(15, 'Reading image metadata...', 'Reading dimensions & EXIF orientation via Sharp');
        const metadata = await sharp(inputPath).metadata();
        sendEvent(25, 'Preparing inference pipeline...', `Dimensions: ${metadata.width}x${metadata.height} (${metadata.format || 'image'})`);

        const BACKEND_URL = process.env.BACKEND_URL || process.env.MODEL_SERVER_URL;

        if (BACKEND_URL) {
            sendEvent(35, 'Forwarding to Model Server...', `Sending request to ${BACKEND_URL}/inference...`);
            const fileBuf = fs.readFileSync(inputPath);
            const form = new FormData();
            form.append('image', new Blob([fileBuf]), job.filename);

            const resp = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/inference`, {
                method: 'POST',
                body: form
            });

            if (!resp.ok) {
                const errJson = await resp.json().catch(() => ({}));
                throw new Error(errJson.error || `Model Server returned HTTP ${resp.status}`);
            }

            const arrayBuf = await resp.arrayBuffer();
            fs.writeFileSync(outputPath, Buffer.from(arrayBuf));
            sendEvent(92, 'Result received!', 'Transparent PNG received from remote Model Server.');
        } else {
            sendEvent(35, 'Running AI segmentation...', 'Executing BiRefNet ONNX in local memory-safe worker...');

            let currentInferPct = 35;
            let stepCount = 1;
            const inferTimer = setInterval(() => {
                if (isClosed) {
                    clearInterval(inferTimer);
                    return;
                }
                if (currentInferPct < 85) {
                    currentInferPct += 5;
                    sendEvent(currentInferPct, 'Running AI inference on CPU...', `[Inference Step ${stepCount++}] Processing segmentation feature maps...`);
                }
            }, 800);

            const workerPath = path.join(BASE_DIR, 'inference-worker.js');
            const runWorker = () => new Promise((resolve, reject) => {
                childProcess = spawn(process.execPath, [
                    '--expose-gc',
                    '--max-old-space-size=1536',
                    workerPath,
                    inputPath,
                    outputPath,
                    MODEL_PATH
                ]);

                let stderrOutput = '';
                childProcess.stderr.on('data', (d) => { stderrOutput += d.toString(); });

                childProcess.on('close', (code) => {
                    clearInterval(inferTimer);
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(stderrOutput || `Worker process exited with code ${code}`));
                    }
                });

                childProcess.on('error', (err) => {
                    clearInterval(inferTimer);
                    reject(err);
                });
            });

            await runWorker();
            sendEvent(92, 'Compositing alpha channel...', 'Merging alpha mask natively via libvips joinChannel...');
        }

        const durationMs = Date.now() - startTime;
        sendEvent(100, 'Complete!', `Background removed successfully in ${(durationMs / 1000).toFixed(2)} seconds.`);

        if (!isClosed) {
            res.write(`event: complete\ndata: ${JSON.stringify({
                status: true,
                durationMs,
                originalUrl: `/tmp/${job.filename}`,
                resultUrl: `/tmp/${outputFilename}`,
                downloadName: outputFilename
            })}\n\n`);
            res.end();
        }

        jobs.delete(jobId);
    } catch (err) {
        console.error('[STREAM ERROR]', err);
        if (!isClosed) {
            res.write(`event: error\ndata: ${JSON.stringify({ status: false, error: err.message })}\n\n`);
            res.end();
        }
        jobs.delete(jobId);
    }
});

// 404 Handler
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>404 - Page Not Found | OpenRemove</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-gray-50 text-gray-800 min-h-screen flex flex-col items-center justify-center p-6 text-center font-sans">
                <div class="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                    <div class="text-5xl font-extrabold text-blue-600 mb-2">404</div>
                    <h1 class="text-xl font-bold text-gray-900 mb-2">Page Not Found</h1>
                    <p class="text-sm text-gray-500 mb-6">The page or endpoint you are looking for does not exist.</p>
                    <a href="/" class="inline-block px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition">
                        Back to Home
                    </a>
                </div>
            </body>
            </html>
        `);
    } else {
        res.status(404).json({ status: false, error: 'Endpoint not found.' });
    }
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`OpenRemove Web Server running at http://localhost:${PORT}`);
    if (process.env.MODEL_SERVER_URL) {
        console.log(`[MODE] Decoupled: Routing AI tasks to ${process.env.MODEL_SERVER_URL}`);
    } else {
        console.log(`[MODE] Standalone: Local isolated worker inference`);
    }
    console.log(`=========================================`);
});
