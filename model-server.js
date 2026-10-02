const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ort = require('onnxruntime-node');

sharp.cache(false);
sharp.concurrency(1);

const app = express();
app.disable('x-powered-by');
const PORT = process.env.MODEL_PORT || process.env.PORT || 5000;
const BASE_DIR = path.resolve(__dirname);

const resolveModelPath = (name, fallback) => {
    const p1 = path.join(BASE_DIR, 'models', name);
    if (fs.existsSync(p1)) return p1;
    const p2 = path.join(BASE_DIR, 'models', fallback);
    if (fs.existsSync(p2)) return p2;
    return p1;
};

const MODEL_PATHS = {
    silueta: process.env.SILUETA_MODEL_PATH || path.join(BASE_DIR, 'models', 'silueta.onnx'),
    u2netp: process.env.U2NETP_MODEL_PATH || path.join(BASE_DIR, 'models', 'u2netp.onnx'),
    isnet: process.env.ISNET_MODEL_PATH || resolveModelPath('isnet.onnx', 'isnet-general-use.onnx'),
    rmbg: process.env.RMBG_MODEL_PATH || resolveModelPath('briarmbg.onnx', 'model.onnx'),
    ben2: process.env.BEN2_MODEL_PATH || path.join(BASE_DIR, 'models', 'ben2.onnx')
};

const MAX_IMAGE_PIXELS = parseInt(process.env.MAX_IMAGE_PIXELS || '41943040', 10);

app.use(cors({
    origin(origin, cb) {
        if (!origin) return cb(null, true);
        return cb(null, false);
    },
    optionsSuccessStatus: 204
}));
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 }
});

const sessions = {};

const sessionOptions = {
    executionProviders: ['cpu'],
    enableCpuMemArena: false,
    enableMemPattern: false,
    executionMode: 'sequential',
    graphOptimizationLevel: 'basic',
    intraOpNumThreads: parseInt(process.env.THREADS || '2', 10),
    interOpNumThreads: 1,
    extra: {
        session: {
            'memory.enable_memory_arena_shrinkage': 'cpu:0',
            'intra_op.allow_spinning': '0'
        }
    }
};

const ACTIVE_MODELS = (process.env.ACTIVE_MODELS || process.env.ENABLED_MODELS || 'silueta,u2netp,isnet,rmbg').toLowerCase();

async function getModelSession(modelName) {
    if (!modelName) {
        throw new Error('Model name is required.');
    }
    const clean = modelName.toLowerCase();
    let key;
    if (clean === 'silueta' || clean.includes('silueta')) {
        key = 'silueta';
    } else if (clean === 'u2netp' || clean.includes('u2net') || clean.includes('u2')) {
        key = 'u2netp';
    } else if (clean === 'rmbg' || clean.includes('rmbg')) {
        key = 'rmbg';
    } else if (clean === 'isnet' || clean.includes('isnet')) {
        key = 'isnet';
    } else if (clean === 'ben2' || clean.includes('ben2') || clean.includes('ben')) {
        key = 'ben2';
    } else {
        throw new Error(`Unknown model requested: "${modelName}". Available models: silueta, u2netp, isnet, rmbg, ben2.`);
    }

    if (ACTIVE_MODELS !== 'all' && !ACTIVE_MODELS.includes(key)) {
        throw new Error(`Model [${key.toUpperCase()}] is disabled on this server. Active models: ${ACTIVE_MODELS.toUpperCase()}.`);
    }

    if (!sessions[key]) {
        const targetPath = MODEL_PATHS[key];
        if (!targetPath || !fs.existsSync(targetPath)) {
            throw new Error(`Model file for [${key.toUpperCase()}] not found on disk at: ${targetPath}`);
        }
        console.log(`[ENGINE] Loading ${key.toUpperCase()} model from: ${targetPath}`);
        sessions[key] = await ort.InferenceSession.create(targetPath, sessionOptions);
        console.log(`[ENGINE] Inference session ready for [${key.toUpperCase()}] (${path.basename(targetPath)})`);
    }
    return { session: sessions[key], modelKey: key, modelPath: MODEL_PATHS[key] };
}

app.get('/health', (req, res) => {
    res.json({
        status: true,
        engine: 'Background Removal ONNX Multi-Model',
        models: {
            silueta: { loaded: !!sessions.silueta, file: path.basename(MODEL_PATHS.silueta) },
            u2netp: { loaded: !!sessions.u2netp, file: path.basename(MODEL_PATHS.u2netp) },
            isnet: { loaded: !!sessions.isnet, file: path.basename(MODEL_PATHS.isnet) },
            rmbg: { loaded: !!sessions.rmbg, file: path.basename(MODEL_PATHS.rmbg) },
            ben2: { loaded: !!sessions.ben2, file: path.basename(MODEL_PATHS.ben2) }
        },
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        timestamp: Date.now()
    });
});

app.post('/inference', upload.single('image'), async (req, res) => {
    if (!req.file || !req.file.buffer) {
        return res.status(400).json({ status: false, error: 'Image file required.' });
    }

    const requestedModel = req.query.model || req.headers['x-model'] || req.body.model || 'silueta';
    const startTime = Date.now();

    try {
        const preMeta = await sharp(req.file.buffer, { limitInputPixels: Math.ceil(MAX_IMAGE_PIXELS * 1.1) }).metadata();
        if (!preMeta.format || !['jpeg', 'png', 'webp', 'gif', 'bmp'].includes(preMeta.format)) {
            return res.status(400).json({ status: false, error: 'Unsupported image format.' });
        }
        const pixels = (preMeta.width || 0) * (preMeta.height || 0);
        if (!pixels || pixels > MAX_IMAGE_PIXELS) {
            return res.status(400).json({ status: false, error: `Image is invalid or too large. Max ${MAX_IMAGE_PIXELS}px.` });
        }

        const { session: sess, modelKey } = await getModelSession(requestedModel);
        const image = sharp(req.file.buffer, { limitInputPixels: Math.ceil(MAX_IMAGE_PIXELS * 1.1) }).rotate();
        
        const { data: rgbData, info } = await image
            .clone()
            .removeAlpha()
            .toColourspace('srgb')
            .raw()
            .toBuffer({ resolveWithObject: true });

        const origW = info.width;
        const origH = info.height;

        const inputDim = (modelKey === 'silueta' || modelKey === 'u2netp') ? 320 : 1024;

        const { data: rawBuffer } = await image
            .clone()
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize(inputDim, inputDim, { fit: 'fill' })
            .toColourspace('srgb')
            .raw()
            .toBuffer({ resolveWithObject: true });

        const inputName = sess.inputNames[0];
        const isImageNetNorm = inputName === 'pixel_values' || modelKey === 'ben2' || modelKey === 'birefnet' || modelKey === 'inspyrenet' || modelKey === 'silueta' || modelKey === 'u2netp';
        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];

        const floatArray = new Float32Array(3 * inputDim * inputDim);
        for (let c = 0; c < 3; c++) {
            const m = isImageNetNorm ? mean[c] : 0.5;
            const s = isImageNetNorm ? std[c] : 1.0;
            const offset = c * inputDim * inputDim;
            for (let i = 0; i < inputDim * inputDim; i++) {
                floatArray[offset + i] = ((rawBuffer[i * 3 + c] / 255.0) - m) / s;
            }
        }

        const inputTensor = new ort.Tensor('float32', floatArray, [1, 3, inputDim, inputDim]);

        const results = await sess.run({ [inputName]: inputTensor });
        const maskData = results[sess.outputNames[0]].data;

        let minVal = Infinity;
        let maxVal = -Infinity;
        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] < minVal) minVal = maskData[i];
            if (maskData[i] > maxVal) maxVal = maskData[i];
        }
        const range = maxVal - minVal || 1;

        const maskBuf = Buffer.alloc(inputDim * inputDim);
        for (let i = 0; i < maskData.length; i++) {
            const norm = (maskData[i] - minVal) / range;
            maskBuf[i] = Math.max(0, Math.min(255, Math.round(norm * 255)));
        }

        const maskOrig = await sharp(maskBuf, {
            raw: { width: inputDim, height: inputDim, channels: 1 }
        })
        .resize(origW, origH, { fit: 'fill' })
        .toColourspace('b-w')
        .raw()
        .toBuffer();

        const outputPng = await sharp(rgbData, {
            raw: { width: origW, height: origH, channels: 3 }
        })
        .joinChannel(maskOrig, {
            raw: { width: origW, height: origH, channels: 1 }
        })
        .png({ compressionLevel: 6 })
        .toBuffer();

        const durationMs = Date.now() - startTime;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('X-Inference-Duration-Ms', durationMs.toString());
        res.setHeader('X-Model-Used', modelKey);
        res.setHeader('X-Model-File', path.basename(MODEL_PATHS[modelKey] || 'model.onnx'));
        res.send(outputPng);

        if (global.gc) setImmediate(() => global.gc());
    } catch (err) {
        console.error('[ENGINE ERROR]', err);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, async () => {
    console.log(`=========================================`);
    console.log(`OpenRemove Model Server running on port ${PORT}`);
    console.log(`Configured Active Models: ${ACTIVE_MODELS.toUpperCase()}`);
    console.log(`=========================================`);
    try {
        const promises = [];
        if (ACTIVE_MODELS === 'all' || ACTIVE_MODELS.includes('silueta')) {
            promises.push(getModelSession('silueta').catch(e => console.error('[SILUETA PRELOAD ERROR]:', e.message)));
        }
        if (ACTIVE_MODELS === 'all' || ACTIVE_MODELS.includes('u2netp')) {
            promises.push(getModelSession('u2netp').catch(e => console.error('[U2NETP PRELOAD ERROR]:', e.message)));
        }
        if (ACTIVE_MODELS === 'all' || ACTIVE_MODELS.includes('isnet')) {
            promises.push(getModelSession('isnet').catch(e => console.error('[ISNET PRELOAD ERROR]:', e.message)));
        }
        if (ACTIVE_MODELS === 'all' || ACTIVE_MODELS.includes('rmbg')) {
            promises.push(getModelSession('rmbg').catch(e => console.error('[RMBG PRELOAD ERROR]:', e.message)));
        }
        if (ACTIVE_MODELS === 'all' || ACTIVE_MODELS.includes('ben2')) {
            promises.push(getModelSession('ben2').catch(e => console.error('[BEN2 PRELOAD ERROR]:', e.message)));
        }
        await Promise.all(promises);
        console.log(`[ENGINE] Selected active models loaded and ready for immediate inference!`);
    } catch (e) {
        console.error('Preload warning:', e.message);
    }
});
