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
const MODEL_PATH = process.env.MODEL_PATH || path.join(BASE_DIR, 'models', 'model.onnx');


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

// Static Documentation Routes
app.get('/status', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'status.html'));
});

app.get('/how-to-use', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'how-to-use.html'));
});

app.get(['/api-docs', '/api'], (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'api-docs.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'privacy.html'));
});

app.get(['/faq', '/limitations'], (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'faq.html'));
});

app.get('/contributing', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'contributing.html'));
});


// Real-Time System Status API (Uptime Kuma style JSON)
app.get('/api/status', async (req, res) => {
    const BACKEND_URL = process.env.BACKEND_URL || process.env.MODEL_SERVER_URL;
    
    const webStatus = {
        status: 'online',
        uptime: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        timestamp: Date.now()
    };

    let backendStatus = {
        mode: BACKEND_URL ? 'decoupled' : 'standalone',
        url: BACKEND_URL || 'local-worker',
        status: 'unknown',
        latencyMs: null,
        details: null
    };

    if (BACKEND_URL) {
        const beStart = Date.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const resp = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);
            const beLatency = Date.now() - beStart;
            if (resp.ok) {
                const data = await resp.json();
                backendStatus.status = 'operational';
                backendStatus.latencyMs = beLatency;
                backendStatus.details = data;
            } else {
                backendStatus.status = 'degraded';
                backendStatus.error = `HTTP ${resp.status}`;
            }
        } catch (err) {
            backendStatus.status = 'offline';
            backendStatus.error = err.message || 'Connection failed';
        }
    } else {
        const modelExists = fs.existsSync(MODEL_PATH);
        backendStatus.status = modelExists ? 'operational' : 'error';
        backendStatus.latencyMs = 0;
        backendStatus.details = {
            engine: 'Isolated Worker (libvips + ORT)',
            model: path.basename(MODEL_PATH),
            modelExists
        };
    }

    const isAllOperational = webStatus.status === 'online' && backendStatus.status === 'operational';

    res.json({
        system: isAllOperational ? 'operational' : (backendStatus.status === 'offline' ? 'major_outage' : 'degraded'),
        web: webStatus,
        backend: backendStatus,
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

// Real-Time Inference Queue Manager
const MAX_CONCURRENT_INFERENCES = parseInt(process.env.MAX_CONCURRENT || '1', 10);
const AVG_INFERENCE_SECONDS = 2.5;

let activeInferences = 0;
const inferenceQueue = []; // Array of { jobId, resolve, notify }

function broadcastQueue() {
    inferenceQueue.forEach((item, index) => {
        const queuePos = index + 1; // 1-indexed
        const estimatedSeconds = Math.max(1, Math.round(queuePos * AVG_INFERENCE_SECONDS));
        if (typeof item.notify === 'function') {
            item.notify(queuePos, estimatedSeconds);
        }
    });
}

function acquireInferenceSlot(jobId, notify) {
    if (activeInferences < MAX_CONCURRENT_INFERENCES && inferenceQueue.length === 0) {
        activeInferences++;
        return Promise.resolve(0); // Immediately ready
    }

    return new Promise((resolve) => {
        const queueItem = {
            jobId,
            resolve: () => {
                activeInferences++;
                resolve();
            },
            notify
        };
        inferenceQueue.push(queueItem);
        broadcastQueue();
    });
}

function releaseInferenceSlot(jobId) {
    // Remove from queue if present (e.g. cancelled before turn)
    const idx = inferenceQueue.findIndex(item => item.jobId === jobId);
    if (idx !== -1) {
        inferenceQueue.splice(idx, 1);
    } else {
        activeInferences = Math.max(0, activeInferences - 1);
    }

    if (inferenceQueue.length > 0 && activeInferences < MAX_CONCURRENT_INFERENCES) {
        const next = inferenceQueue.shift();
        next.resolve();
    }

    broadcastQueue();
}

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
    let slotAcquired = false;

    req.on('close', () => {
        isClosed = true;
        if (childProcess) {
            try { childProcess.kill(); } catch (_) {}
        }
        releaseInferenceSlot(jobId);
    });

    const sendEvent = (percent, statusText, logMsg, extra = {}) => {
        if (isClosed) return;
        const now = new Date().toTimeString().split(' ')[0];
        const logLine = `[${now}] ${logMsg || statusText}`;
        try {
            res.write(`event: progress\ndata: ${JSON.stringify({ percent, statusText, log: logLine, ...extra })}\n\n`);
        } catch (_) {}
    };

    const startTime = Date.now();
    const inputPath = job.inputPath;
    const outputFilename = `nobg-${path.parse(job.filename).name}.png`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    try {
        sendEvent(5, 'Initializing AI engine...', `Received file: ${job.filename} (${(job.size / 1024).toFixed(1)} KB)`);
        
        sendEvent(10, 'Reading image metadata...', 'Reading dimensions & EXIF orientation via Sharp');
        const metadata = await sharp(inputPath).metadata();
        sendEvent(15, 'Preparing inference pipeline...', `Dimensions: ${metadata.width}x${metadata.height} (${metadata.format || 'image'})`);

        // Queue waiting callback
        const onQueuePositionUpdate = (position, estimatedSec) => {
            sendEvent(15, `Queue #${position} • Est. wait ~${estimatedSec}s`, `Position #${position} in queue. Estimated wait: ${estimatedSec} seconds.`, {
                queuePosition: position,
                estimatedSeconds: estimatedSec
            });
        };

        // Wait in queue if other inferences are active
        await acquireInferenceSlot(jobId, onQueuePositionUpdate);
        slotAcquired = true;

        if (isClosed) {
            releaseInferenceSlot(jobId);
            return;
        }

        sendEvent(35, 'Running AI segmentation...', 'Executing BRIA RMBG-1.4 ONNX inference...', {
            queuePosition: 0,
            estimatedSeconds: 0
        });

        const BACKEND_URL = process.env.BACKEND_URL || process.env.MODEL_SERVER_URL;

        if (BACKEND_URL) {
            sendEvent(45, 'Processing on Model Server...', `Executing model on remote engine (${BACKEND_URL})...`);
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
            let currentInferPct = 35;
            let stepCount = 1;
            const inferTimer = setInterval(() => {
                if (isClosed) {
                    clearInterval(inferTimer);
                    return;
                }
                if (currentInferPct < 85) {
                    currentInferPct += 10;
                    sendEvent(currentInferPct, 'Running AI inference on CPU...', `[Inference Step ${stepCount++}] Processing segmentation feature maps...`);
                }
            }, 600);

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

        releaseInferenceSlot(jobId);
        slotAcquired = false;

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
        if (slotAcquired) {
            releaseInferenceSlot(jobId);
        }
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
