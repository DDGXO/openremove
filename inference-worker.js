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
        const image = sharp(inputPath).rotate();
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

        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];
        const floatArray = new Float32Array(3 * 1024 * 1024);

        for (let c = 0; c < 3; c++) {
            for (let i = 0; i < 1024 * 1024; i++) {
                const val = rawBuffer[i * 3 + c] / 255.0;
                floatArray[c * 1024 * 1024 + i] = (val - mean[c]) / std[c];
            }
        }

        const sessionOptions = {
            executionProviders: ['cpu'],
            enableCpuMemArena: false,
            enableMemPattern: false,
            executionMode: 'sequential',
            graphOptimizationLevel: 'basic',
            intraOpNumThreads: 4
        };

        const session = await ort.InferenceSession.create(modelPath, sessionOptions);
        const inputName = session.inputNames[0];
        const inputTensor = new ort.Tensor('float32', floatArray, [1, 3, 1024, 1024]);

        const results = await session.run({ [inputName]: inputTensor });
        const outputTensor = results[session.outputNames[0]];
        const maskData = outputTensor.data;

        // Sigmoid activation with smoothstep clamp defringe
        const mask1024 = Buffer.alloc(1024 * 1024);
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
            mask1024[i] = Math.round(val * 255);
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
