# Changelog

All notable changes to OpenRemove will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.2] - 2026-09-18

### Added
- Standard `.env.example` configuration template in English covering `PORT`, `BACKEND_URL`, and `MODEL_PATH`.
- Simplified environment configuration supporting `BACKEND_URL` for direct connection to the model inference service.

### Changed
- Removed redundant ONNX Runtime model initialization from the main web gateway startup process (`server.js`), keeping the web process lightweight.
- Updated documentation in `README.md` with environment variables table and decoupled deployment instructions.

---

## [1.0.1] - 2026-09-18

### Added
- Standalone Model Inference Server (`model-server.js`) on port `5000` with `POST /inference` and `GET /health` endpoints.
- Remote Model Gateway support in `server.js` via `MODEL_SERVER_URL` environment variable for decoupled multi-server deployment.
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
