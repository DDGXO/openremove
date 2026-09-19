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
const MODEL_PATH = process.env.MODEL_PATH || path.join(BASE_DIR, 'models', 'model.onnx');
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

let session = null;
async function getModelSession() {
    if (!session) {
        console.log(`[ENGINE] Loading model from: ${MODEL_PATH}`);
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
        session = await ort.InferenceSession.create(MODEL_PATH, sessionOptions);
        console.log(`[ENGINE] Inference session ready using ${path.basename(MODEL_PATH)}`);
    }
    return session;
}

app.get('/health', (req, res) => {
    res.json({
        status: true,
        engine: 'Background Removal ONNX',
        model: path.basename(MODEL_PATH),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        timestamp: Date.now()
    });
});

app.post('/inference', upload.single('image'), async (req, res) => {
    if (!req.file || !req.file.buffer) {
        return res.status(400).json({ status: false, error: 'Image file required.' });
    }

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
        const sess = await getModelSession();
        const image = sharp(req.file.buffer, { limitInputPixels: Math.ceil(MAX_IMAGE_PIXELS * 1.1) }).rotate();
        
        const { data: rgbData, info } = await image
            .clone()
            .removeAlpha()
            .toColourspace('srgb')
            .raw()
            .toBuffer({ resolveWithObject: true });

        const origW = info.width;
        const origH = info.height;

        const { data: rawBuffer } = await image
            .clone()
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize(1024, 1024, { fit: 'fill' })
            .toColourspace('srgb')
            .raw()
            .toBuffer({ resolveWithObject: true });

        const inputName = sess.inputNames[0];
        const isImageNetNorm = inputName === 'pixel_values';
        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];

        const floatArray = new Float32Array(3 * 1024 * 1024);
        for (let c = 0; c < 3; c++) {
            const m = isImageNetNorm ? mean[c] : 0.5;
            const s = isImageNetNorm ? std[c] : 1.0;
            const offset = c * 1024 * 1024;
            for (let i = 0; i < 1024 * 1024; i++) {
                floatArray[offset + i] = ((rawBuffer[i * 3 + c] / 255.0) - m) / s;
            }
        }

        const inputTensor = new ort.Tensor('float32', floatArray, [1, 3, 1024, 1024]);

        const results = await sess.run({ [inputName]: inputTensor });
        const maskData = results[sess.outputNames[0]].data;

        let minVal = Infinity;
        let maxVal = -Infinity;
        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] < minVal) minVal = maskData[i];
            if (maskData[i] > maxVal) maxVal = maskData[i];
        }
        const range = maxVal - minVal || 1;

        const LOW_THRESHOLD = 0.05;  // Suppress background noise / ghosting below 5%
        const HIGH_THRESHOLD = 0.95; // Ensure clean solid foreground above 95%

        const mask1024 = Buffer.alloc(1024 * 1024);
        for (let i = 0; i < maskData.length; i++) {
            const norm = (maskData[i] - minVal) / range;
            if (norm <= LOW_THRESHOLD) {
                mask1024[i] = 0;
            } else if (norm >= HIGH_THRESHOLD) {
                mask1024[i] = 255;
            } else {
                const remapped = (norm - LOW_THRESHOLD) / (HIGH_THRESHOLD - LOW_THRESHOLD);
                mask1024[i] = Math.round(remapped * 255);
            }
        }


        const maskOrig = await sharp(mask1024, {
            raw: { width: 1024, height: 1024, channels: 1 }
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
    console.log(`=========================================`);
    try {
        await getModelSession();
    } catch (e) {
        console.error('Preload warning:', e.message);
    }
});
