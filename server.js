const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { spawn } = require('child_process');
const {
    getClientIp,
    rateLimit,
    securityHeaders,
    validateImageFile,
    getImageMime,
    safeErrorMessage
} = require('./lib/security');

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
});

const app = express();
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;

const BASE_DIR = path.resolve(__dirname);
const TMP_DIR = path.join(BASE_DIR, 'tmp');
const OUTPUT_DIR = TMP_DIR;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const MODEL_PATH = process.env.MODEL_PATH || path.join(BASE_DIR, 'models', 'model.onnx');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

const MAX_IMAGE_PIXELS = parseInt(process.env.MAX_IMAGE_PIXELS || '41943040', 10);
const FILE_TTL_MS = parseInt(process.env.TMP_FILE_TTL_MIN || '30', 10) * 60 * 1000;
const JOB_TTL_MS = parseInt(process.env.JOB_TTL_MIN || '15', 10) * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

app.use(cors({
    origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.length === 0) return cb(null, false);
        try {
            const originUrl = new URL(origin);
            return cb(null, ALLOWED_ORIGINS.some((o) => {
                const allowed = new URL(o);
                return allowed.host === originUrl.host;
            }));
        } catch (_) {
            return cb(null, false);
        }
    },
    optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(securityHeaders);
app.use(express.static(PUBLIC_DIR));

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

// Private temp file accessor (whitelisted image files only)
app.get('/tmp/:name', (req, res) => {
    const name = path.basename(req.params.name);
    if (name !== req.params.name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
        return res.status(400).json({ status: false, error: 'Invalid file name.' });
    }

    const mime = getImageMime(path.extname(name).slice(1));
    if (!mime) {
        return res.status(404).json({ status: false, error: 'File not found.' });
    }

    const filePath = path.join(TMP_DIR, name);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: false, error: 'File not found.' });
    }

    res.set({
        'Content-Type': mime,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'no-store'
    });
    return fs.createReadStream(filePath).on('error', () => {
        if (!res.headersSent) res.status(404).json({ status: false, error: 'File not found.' });
    }).pipe(res);
});


// Real-Time System Status API (Sanitized Public Health Monitor)
const statusRatePerIp = rateLimit({ windowMs: 60 * 1000, max: 30, name: 'status-ip' });
app.get('/api/status', statusRatePerIp, async (req, res) => {
    const BACKEND_URL = process.env.BACKEND_URL || process.env.MODEL_SERVER_URL;

    let isBackendHealthy = false;

    if (BACKEND_URL) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
            const resp = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/health`, { signal: controller.signal });
            isBackendHealthy = resp.ok;
        } catch (_) {
            isBackendHealthy = false;
        } finally {
            clearTimeout(timeoutId);
        }
    } else {
        isBackendHealthy = fs.existsSync(MODEL_PATH);
    }

    const systemStatus = isBackendHealthy ? 'operational' : 'degraded';

    res.json({
        status: 'ok',
        system: systemStatus,
        web: {
            status: 'online'
        },
        backend: {
            status: isBackendHealthy ? 'operational' : 'offline'
        },
        timestamp: Date.now()
    });
});


const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `upload-pending-${uniqueSuffix}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

const jobs = new Map();

// Real-Time Inference Queue Manager
const MAX_CONCURRENT_INFERENCES = parseInt(process.env.MAX_CONCURRENT || '1', 10);
const MAX_QUEUE_LENGTH = parseInt(process.env.MAX_QUEUE || '50', 10);
const AVG_INFERENCE_SECONDS = 2.5;

let activeInferences = 0;
const inferenceQueue = []; // Array of { jobId, resolve, notify }

function broadcastQueue() {
    inferenceQueue.forEach((item, index) => {
        const queuePos = index + 1;
        const estimatedSeconds = Math.max(1, Math.round(queuePos * AVG_INFERENCE_SECONDS));
        if (typeof item.notify === 'function') {
            item.notify(queuePos, estimatedSeconds);
        }
    });
}

function acquireInferenceSlot(jobId, notify) {
    if (activeInferences < MAX_CONCURRENT_INFERENCES && inferenceQueue.length === 0) {
        activeInferences++;
        return Promise.resolve(0);
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


async function validateAndFinalizeUpload(req, res, next) {
    if (!req.file) {
        return res.status(400).json({ status: false, error: 'Image file is required.' });
    }

    try {
        const { ext } = await validateImageFile(req.file.path, MAX_IMAGE_PIXELS);
        const safeName = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const newPath = path.join(TMP_DIR, safeName);
        fs.renameSync(req.file.path, newPath);
        req.file.path = newPath;
        req.file.filename = safeName;
        return next();
    } catch (err) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        const msg = err.code === 'ETOO_LARGE'
            ? `Image exceeds maximum dimension limit (${MAX_IMAGE_PIXELS}px).`
            : err.message;
        return res.status(400).json({ status: false, error: msg });
    }
}

const uploadRatePerIp = rateLimit({ windowMs: 60 * 1000, max: 15, name: 'upload-ip' });
const uploadRateGlobal = rateLimit({ windowMs: 60 * 1000, max: 60, name: 'upload-global', globalKey: 'global-upload' });

app.post('/api/upload',
    uploadRatePerIp,
    uploadRateGlobal,
    upload.single('image'),
    validateAndFinalizeUpload,
    (req, res) => {
        const jobId = Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 12);
        jobs.set(jobId, {
            jobId,
            inputPath: req.file.path,
            filename: req.file.filename,
            size: req.file.size,
            createdAt: Date.now()
        });

        return res.json({ status: true, jobId, filename: req.file.filename });
    });


const streamRatePerIp = rateLimit({ windowMs: 60 * 1000, max: 30, name: 'stream-ip' });
app.get('/api/process-stream/:jobId', streamRatePerIp, async (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ status: false, error: 'Job ID not found.' });
    }

    if (!/^[a-zA-Z0-9-]+$/.test(jobId)) {
        return res.status(400).json({ status: false, error: 'Invalid job ID.' });
    }

    if (inferenceQueue.length >= MAX_QUEUE_LENGTH) {
        return res.status(503).json({ status: false, error: 'Server is busy. Please try again shortly.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let isClosed = false;
    let slotReleased = false;
    let childProcess = null;
    let slotAcquired = false;

    const releaseSlotOnce = () => {
        if (slotReleased) return;
        slotReleased = true;
        releaseInferenceSlot(jobId);
    };

    req.on('close', () => {
        isClosed = true;
        if (childProcess) {
            try { childProcess.kill(); } catch (_) {}
        }
        releaseSlotOnce();
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
        const metadata = await sharp(inputPath, { limitInputPixels: Math.ceil(MAX_IMAGE_PIXELS * 1.1) }).metadata();
        sendEvent(15, 'Preparing inference pipeline...', `Dimensions: ${metadata.width}x${metadata.height} (${metadata.format || 'image'})`);

        const onQueuePositionUpdate = (position, estimatedSec) => {
            sendEvent(15, `Queue #${position} • Est. wait ~${estimatedSec}s`, `Position #${position} in queue. Estimated wait: ${estimatedSec} seconds.`, {
                queuePosition: position,
                estimatedSeconds: estimatedSec
            });
        };

        await acquireInferenceSlot(jobId, onQueuePositionUpdate);
        slotAcquired = true;

        if (isClosed) {
            releaseSlotOnce();
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

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            let resp;
            try {
                resp = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/inference`, {
                    method: 'POST',
                    body: form,
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeoutId);
            }

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

        releaseSlotOnce();
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
        console.error('[STREAM ERROR]', err);
        if (slotAcquired) releaseSlotOnce();
        try { fs.unlinkSync(job.inputPath); } catch (_) {}

        if (!isClosed) {
            res.write(`event: error\ndata: ${JSON.stringify({ status: false, error: safeErrorMessage(err) })}\n\n`);
            res.end();
        }
        jobs.delete(jobId);
    }
});

// Temp file & job retention sweeper (TTL)
function sweepTmp() {
    const now = Date.now();
    try {
        const files = fs.readdirSync(TMP_DIR);
        for (const file of files) {
            if (file === '.gitkeep') continue;
            const filePath = path.join(TMP_DIR, file);
            try {
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > FILE_TTL_MS) {
                    fs.unlinkSync(filePath);
                    console.log(`[SWEEPER] Removed expired temp file: ${file}`);
                }
            } catch (_) {}
        }
    } catch (err) {
        console.error('[SWEEPER] TMP scan error:', err.message);
    }

    for (const [jobId, job] of jobs) {
        if (now - job.createdAt > JOB_TTL_MS) {
            try { fs.unlinkSync(job.inputPath); } catch (_) {}
            jobs.delete(jobId);
            console.log(`[SWEEPER] Evicted expired job: ${jobId}`);
        }
    }
}
sweepTmp();
setInterval(sweepTmp, SWEEP_INTERVAL_MS).unref();

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
    if (process.env.BACKEND_URL || process.env.MODEL_SERVER_URL) {
        console.log(`[MODE] Decoupled: Routing AI tasks to ${process.env.BACKEND_URL || process.env.MODEL_SERVER_URL}`);
    } else {
        console.log(`[MODE] Standalone: Local isolated worker inference`);
    }
    console.log(`[SEC] Rate limits enabled | CORS restricted | security headers on | tmp TTL ${FILE_TTL_MS / 60000} min`);
    console.log(`=========================================`);
});