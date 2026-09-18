# Changelog

All notable changes to OpenRemove will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-09-18

### Added
- Configurable security and scaling environment variables in `.env.example`: `ALLOWED_ORIGINS`, `MAX_IMAGE_PIXELS`, `TMP_FILE_TTL_MIN`, `JOB_TTL_MIN`, and `MAX_QUEUE`.

### Changed
- Upgraded `sharp` to `0.35.4` resolving all upstream libvips (CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591) and libheif vulnerabilities.

### Security
- **Strict File Upload Validation (`lib/security.js`):** Magic bytes and metadata verification via Sharp (jpeg/png/webp/gif/bmp) with dimensions capped at 40 MP to prevent image bomb attacks.
- **Private `/tmp/:name` Endpoint:** Replaced public static directory serving with a private sandboxed route enforcing `Content-Security-Policy: default-src 'none'; sandbox`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`.
- **Sliding-Window Rate Limiting:** Dual per-IP and global bucket rate limits on `/api/upload`, `/api/process-stream`, and `/api/status` to prevent DoS and XFF IP-spoofing bypasses.
- **Automated Retention & PII Sweeper:** Auto-purge for temporary upload files (30m TTL) and queued job maps (15m TTL).
- **HTTP Security Headers & CORS:** Enforced HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, disabled `X-Powered-By`, and configurable `ALLOWED_ORIGINS` whitelist.
- **SSE Error Sanitization & Queue Capping:** Sanitized internal server error traces and bounded queue capacity (`MAX_QUEUE`) with 503 rejection on overload.
- **Decoupled Gateway Timeout:** 8-second fetch abort controller for remote model gateway calls.

---

## [1.0.3] - 2026-09-18

### Added
- Real-time FIFO inference queue manager with live queue position broadcasting and wait time estimation (SSE).
- Real-time System Status monitor page (`/status`) and live JSON telemetry API (`/api/status`).
- Dynamic service downtime notice banner for automated outage reporting.
- Dedicated documentation and policy pages without modals (`/how-to-use`, `/api-docs`, `/faq`, `/privacy`, `/contributing`).
- Responsive mobile navigation drawer with floating overlay.
- Lossless 1:1 original resolution retention badge.
- GitHub repository navigation button and icon in frontend header linking directly to `https://github.com/DDGXO/openremove`.
- ONNX Session Anti-Spinning flag (`intra_op.allow_spinning: '0'`) to eliminate idle CPU 100% core pinning.

### Changed
- Migrated primary AI segmentation backbone to **BRIA RMBG-1.4 ONNX** (`1024x1024`).
  - **Memory Footprint:** Slashed peak C++ memory spike by ~87% (from ~5.28 GB down to ~691 MB), enabling lightweight deployments on low-spec LXC/Docker containers and budget VPS.
  - **Inference Speed:** Accelerated CPU execution speed by ~7x (reduced duration from 17-24s down to 2.3-3.3s per image).
  - **Edge Quality:** Clean continuous alpha probability maps directly embedded from model output without harsh binary stepped thresholding.
- Consolidated model structure into a single unified file path: `models/model.onnx` (removed legacy `models/lite` and `models/standard` folders).
- Updated image normalization to standard RMBG range `[-0.5, 0.5]` (`(pixel / 255.0) - 0.5`).

---

## [1.0.1] - 2026-09-18


### Added
- Standalone Model Inference Server (`model-server.js`) on port `5000` with `POST /inference` and `GET /health` endpoints.
- Remote Model Gateway support in `server.js` via `BACKEND_URL` environment variable for decoupled multi-server deployment.
- Standard `.env.example` configuration template in English covering `PORT`, `BACKEND_URL`, and `MODEL_PATH`.
- Native `joinChannel()` alpha compositing in libvips/Sharp to eliminate unmanaged 4-channel JavaScript buffer allocations.
- Automatic EXIF orientation normalization (`.rotate()`) and sRGB color space conversion for consistent segmentation across camera photos.
- Standard GitHub community files in `docs/` (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`) and `.github/` (Issue and PR templates).
- Easter egg ASCII terminal robot and crawler rules in `public/robots.txt`.

### Changed
- Refactored model inference to run inside an isolated worker child process (`inference-worker.js`), ensuring 100% of memory is immediately reclaimed by the OS upon task completion.
- Unified output destination directly to `tmp/` and removed standalone `/output` directory.
- Converted all server status events, logging strings, error messages, and 404 handler to English.
- Updated repository URLs across all files to `https://github.com/DDGXO/openremove`.

### Fixed
- Fixed memory ballooning caused by C++ ONNX Runtime memory arena retention on Windows x64.
- Fixed blank background removal caused by grayscale `dest-in` blending by switching to direct single-channel alpha injection.
- Fixed hardcoded local directory paths in `server.js` by using `process.env.MODEL_PATH` and relative project paths.

---

## [1.0.0] - 2026-09-18

### Added
- Initial release of OpenRemove.
- High-resolution dichotomous background removal powered by BiRefNet ONNX.
- Modern web interface with real-time SSE progress streaming and before/after split comparison slider.
- REST API endpoint (`POST /api/upload` and `GET /api/process-stream/:jobId`).
- Healthcheck endpoint (`GET /ping`).
- MIT License.