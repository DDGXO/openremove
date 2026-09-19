const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ort = require('onnxruntime-node');

sharp.cache(false);
sharp.concurrency(1);

async function run() {
    const [,, inputPath, outputPath, modelPath] = process.argv;
    if (!inputPath || !outputPath || !modelPath) {
        console.error('Missing arguments');
        process.exit(1);
    }

    try {
        const MAX_PIXELS = parseInt(process.env.MAX_IMAGE_PIXELS || '41943040', 10);
        const image = sharp(inputPath, { limitInputPixels: Math.ceil(MAX_PIXELS * 1.1) }).rotate();
        const { data: rgbData, info } = await image
            .clone()
            .removeAlpha()
            .toColourspace('srgb')
            .raw()
            .toBuffer({ resolveWithObject: true });

        const origW = info.width;
        const origH = info.height;

        // Resize to 1024x1024 with white background flattening for model input
        const { data: rawBuffer } = await image
            .clone()
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize(1024, 1024, { fit: 'fill' })
            .toColourspace('srgb')
            .raw()
            .toBuffer({ resolveWithObject: true });

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

        const session = await ort.InferenceSession.create(modelPath, sessionOptions);
        const inputName = session.inputNames[0];
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
        const results = await session.run({ [inputName]: inputTensor });
        const outputTensor = results[session.outputNames[0]];
        const maskData = outputTensor.data;

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

        // Upscale mask to original dimensions
        const maskOrig = await sharp(mask1024, {
            raw: { width: 1024, height: 1024, channels: 1 }
        })
        .resize(origW, origH, { fit: 'fill' })
        .toColourspace('b-w')
        .raw()
        .toBuffer();

        // Merge mask directly via joinChannel in libvips
        await sharp(rgbData, {
            raw: { width: origW, height: origH, channels: 3 }
        })
        .joinChannel(maskOrig, {
            raw: { width: origW, height: origH, channels: 1 }
        })
        .png({ compressionLevel: 6 })
        .toFile(outputPath);

        process.exit(0);
    } catch (err) {
        console.error('Worker error:', err);
        process.exit(1);
    }
}

run();
