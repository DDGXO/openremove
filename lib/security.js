const { isIP } = require('node:net');
const fs = require('fs');
const sharp = require('sharp');

const IMAGE_FORMAT_EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', bmp: 'bmp' };
const IMAGE_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

function getClientIp(req) {
    const clean = (raw) => {
        if (!raw) return null;
        let v = String(raw).trim();
        const p = v.lastIndexOf(':');
        if (p > 0 && isIP(v.slice(0, p)) === 4) v = v.slice(0, p);
        return isIP(v) ? v : null;
    };
    return clean(req.headers['cf-connecting-ip'])
        || clean(req.headers['x-real-ip'])
        || (req.headers['x-forwarded-for'] || '').split(',').map(clean).find(Boolean)
        || '0.0.0.0';
}

function rateLimit({ windowMs, max, name = 'rl', globalKey = null }) {
    const buckets = new Map();
    const resetAt = new Map();
    setInterval(() => {
        const now = Date.now();
        for (const [k, ts] of resetAt) {
            if (ts < now) { buckets.delete(k); resetAt.delete(k); }
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const key = globalKey || getClientIp(req);
        const now = Date.now();
        let entries = (buckets.get(key) || []).filter((t) => now - t < windowMs);
        let reset = resetAt.get(key) || (now + windowMs);
        const headerReset = Math.ceil(reset / 1000);

        if (entries.length >= max) {
            res.set({
                'X-RateLimit-Limit': String(max),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(headerReset),
                'Retry-After': String(Math.max(1, Math.ceil((reset - now) / 1000)))
            });
            return res.status(429).json({
                status: false,
                error: 'Too many requests. Please try again in a few moments.'
            });
        }

        entries.push(now);
        buckets.set(key, entries);
        resetAt.set(key, reset);
        res.set({
            'X-RateLimit-Limit': String(max),
            'X-RateLimit-Remaining': String(Math.max(0, max - entries.length)),
            'X-RateLimit-Reset': String(headerReset)
        });
        return next();
    };
}

const CSP_GENERAL = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "media-src 'self'",
    "worker-src 'self'"
].join('; ');

function securityHeaders(req, res, next) {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': CSP_GENERAL,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    });
    return next();
}

async function validateImageFile(filePath, maxPixels = 40 * 1024 * 1024) {
    let metadata;
    try {
        metadata = await sharp(filePath, { limitInputPixels: Math.ceil(maxPixels * 1.1) }).metadata();
    } catch (err) {
        const e = new Error('File is not a readable image.');
        e.code = 'EINVALID_IMAGE';
        throw e;
    }

    const ext = IMAGE_FORMAT_EXT[metadata.format];
    if (!ext) {
        const e = new Error(`Unsupported image format${metadata.format ? `: ${metadata.format}` : ''}.`);
        e.code = 'EUNSUPPORTED_FORMAT';
        throw e;
    }

    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (!width || !height || width > maxPixels / 4 || height > maxPixels / 4) {
        const e = new Error('Image dimensions are invalid or too large.');
        e.code = 'EBAD_DIMENSIONS';
        throw e;
    }

    const pixels = width * height;
    if (pixels > maxPixels) {
        const e = new Error(`Image is too large (${pixels}px). Maximum allowed is ${maxPixels}px.`);
        e.code = 'ETOO_LARGE';
        throw e;
    }

    return { ext, width, height, format: metadata.format };
}

function getImageMime(ext) {
    return IMAGE_MIME[String(ext).toLowerCase().replace(/^\./, '')] || null;
}

function safeErrorMessage(err) {
    if (err && typeof err.message === 'string' && /EINVALID|EUNSUPPORTED|EBAD|ETOO|job/i.test(err.message)) {
        return err.message;
    }
    return 'Processing failed. Please try again.';
}

module.exports = {
    getClientIp,
    rateLimit,
    securityHeaders,
    CSP_GENERAL,
    validateImageFile,
    getImageMime,
    IMAGE_FORMAT_EXT,
    IMAGE_MIME,
    safeErrorMessage
};