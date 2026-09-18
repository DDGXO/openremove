const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ort = require('onnxruntime-node');
const sharp = require('sharp');

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

let session = null;
async function getModelSession() {
    if (!session) {
        console.log('[AI] Loading BiRefNet model into memory...');
        session = await ort.InferenceSession.create(MODEL_PATH);
        console.log('[AI] Model loaded and ready!');
    }
    return session;
}

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
    req.on('close', () => {
        isClosed = true;
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
        
        sendEvent(12, 'Reading image metadata...', 'Reading image dimensions & format via Sharp');
        const sess = await getModelSession();
        const image = sharp(inputPath);
        const metadata = await image.metadata();
        const { width: origW, height: origH, format } = metadata;
        sendEvent(18, 'Metadata loaded', `Original input dimensions: ${origW}x${origH} (${format})`);

        sendEvent(25, 'Preprocessing to 1024x1024...', 'Resizing raw buffer to 1024x1024 aspect ratio fill...');
        const { data: rawBuffer } = await image
            .resize(1024, 1024, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        sendEvent(32, 'Normalizing RGB tensor...', 'Normalizing NCHW float32 (mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225])...');
        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];
        const floatArray = new Float32Array(3 * 1024 * 1024);

        for (let c = 0; c < 3; c++) {
            for (let i = 0; i < 1024 * 1024; i++) {
                const val = rawBuffer[i * 3 + c] / 255.0;
                floatArray[c * 1024 * 1024 + i] = (val - mean[c]) / std[c];
            }
        }

        const inputTensor = new ort.Tensor('float32', floatArray, [1, 3, 1024, 1024]);
        const inputName = sess.inputNames[0];

        sendEvent(40, 'Starting BiRefNet AI inference on CPU...', `ONNX InferenceSession running on CPU (AVX2 mode)... Input tensor: [1, 3, 1024, 1024]`);

        let currentInferPct = 40;
        let stepCount = 1;
        const inferTimer = setInterval(() => {
            if (isClosed) {
                clearInterval(inferTimer);
                return;
            }
            if (currentInferPct < 75) {
                currentInferPct += 6;
                sendEvent(currentInferPct, 'Running AI inference on CPU...', `[Inference Step ${stepCount++}] Processing segmentation feature maps...`);
            }
        }, 900);

        const inferStart = Date.now();
        const results = await sess.run({ [inputName]: inputTensor });
        clearInterval(inferTimer);
        const inferDuration = Date.now() - inferStart;

        sendEvent(78, 'Inference completed!', `Model inference finished in ${inferDuration} ms.`);

        const outputTensor = results[sess.outputNames[0]];
        const maskData = outputTensor.data;
        sendEvent(82, 'Extracting output tensor...', `Output tensor: dims=[${outputTensor.dims.join(',')}], total points=${maskData.length}`);

        sendEvent(88, 'Calculating sigmoid & defringe filter...', 'Applying sigmoid activation & edge boundary clamp threshold (0.25-0.90)...');
        const maskBuffer = Buffer.alloc(1024 * 1024);
        for (let i = 0; i < maskData.length; i++) {
            let val = 1 / (1 + Math.exp(-maskData[i]));
            if (val <= 0.25) {
                val = 0;
            } else if (val >= 0.90) {
                val = 1;
            } else {
                const t = (val - 0.25) / (0.90 - 0.25);
                val = t * t * (3 - 2 * t);
            }
            maskBuffer[i] = Math.round(val * 255);
        }

        sendEvent(92, 'Resizing mask & compositing RGBA...', `Upscaling mask to original dimensions ${origW}x${origH} & merging alpha channel...`);
        const { data: alphaMask } = await sharp(maskBuffer, {
            raw: { width: 1024, height: 1024, channels: 1 }
        })
        .resize(origW, origH, { fit: 'fill' })
        .toColourspace('b-w')
        .raw()
        .toBuffer({ resolveWithObject: true });

        const { data: origRgb } = await sharp(inputPath)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const finalRgba = Buffer.alloc(origW * origH * 4);
        for (let i = 0; i < origW * origH; i++) {
            finalRgba[i * 4] = origRgb[i * 3];
            finalRgba[i * 4 + 1] = origRgb[i * 3 + 1];
            finalRgba[i * 4 + 2] = origRgb[i * 3 + 2];
            finalRgba[i * 4 + 3] = alphaMask[i];
        }

        sendEvent(97, 'Encoding transparent PNG...', `Writing final transparent PNG: ${outputPath}`);
        await sharp(finalRgba, {
            raw: { width: origW, height: origH, channels: 4 }
        })
        .png()
        .toFile(outputPath);

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

app.listen(PORT, async () => {
    console.log(`=========================================`);
    console.log(`OpenRemove Server running at http://localhost:${PORT}`);
    console.log(`=========================================`);
    try {
        await getModelSession();
    } catch (e) {
        console.error('Error preloading AI model:', e);
    }
});
