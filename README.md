# OpenRemove

A high-performance, self-hosted, offline AI background removal application and REST API powered by BRIA RMBG-1.4 and Microsoft ONNX Runtime.

---

## Overview

Commercial background removal APIs often enforce restrictive quotas, usage tracking, recurring subscription models, or privacy concerns regarding cloud data transfers.

OpenRemove provides a self-hosted, private alternative designed for efficient local hardware execution. It isolates subjects and removes backgrounds using state-of-the-art dichotomous image segmentation in ~2-3 seconds on CPU with minimal memory footprint (<700MB peak RAM).

---

### Key Features

- **Multi-Model AI Engine**: Support for 5 specialized segmentation models:
  - **BRIA RMBG-1.4**: High-resolution image segmentation for fine edge preservation and hair matting.
  - **IS-Net (DIS)**: Dichotomous image segmentation for sharp, crisp boundaries on solid objects.
  - **Silueta**: Ultra-fast, lightweight BiRefNet-based inference (~0.8s on CPU).
  - **U²-NetP**: Ultra-compact 4.7 MB footprint designed for constrained memory environments.
  - **BEN2 SOTA**: Boundary-aware deep matting with refined alpha boundary accuracy.
- **Next.js 14 App Router Frontend**: Full-stack modern UI with Tailwind CSS and dark/light theme support.
- **Dual-Language i18n**: Live locale switcher supporting Indonesian (`id`) and English (`en`).
- **PWA Ready**: Offline-capable Progressive Web App manifest and installable standalone desktop/mobile UI.
- **Enterprise Decoupled Architecture**: Independent Model Inference Engine (`model-server.js`), Web API Gateway (`server.js`), and Next.js Frontend service.
- **Comparison Viewer**: Built-in before/after split slider powered by CSS clipping.
- **Real-Time Progress Streaming**: Server-Sent Events (SSE) provide live progress percentages and execution stages.
- **Clipboard & Drag-and-Drop**: Direct image paste (`Ctrl + V`) and native drag-and-drop file upload.
- **Zero Cloud Telemetry**: Fully private, air-gapped, and local-first execution.

---

## Directory Structure

```text
openremove/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   └── SECURITY.md
├── models/
│   ├── README.md               # Model download sources and instructions
│   └── u2netp.onnx             # Pre-bundled compact ONNX weights (4.7 MB)
├── public/
│   ├── .well-known/
│   │   └── security.txt        # Vulnerability disclosure policy
│   ├── apple-icon.png          # iOS touch icon
│   ├── icon.png                # PWA app icon & favicon
│   ├── llms.txt                # LLM & GEO AI crawler metadata
│   ├── logo-horizontal.png     # Brand horizontal navbar logo
│   ├── logo.png                # Standalone brand icon
│   ├── manifest.json           # PWA standalone manifest
│   ├── og-image.png            # OpenGraph social banner
│   ├── robots.txt              # Search engine & AI bot permissions
│   └── sitemap.xml             # Canonical XML sitemap
├── src/
│   ├── app/                    # Next.js 14 App Router routes
│   │   ├── api-docs/           # Interactive REST API documentation
│   │   ├── contributing/       # Contribution guide
│   │   ├── faq/                # FAQ and technical limits
│   │   ├── how-to-use/         # Step-by-step user guide
│   │   ├── privacy/            # Privacy policy & data protection
│   │   ├── status/             # Real-time multi-monitor dashboard
│   │   ├── globals.css         # Tailwind directives and custom CSS
│   │   ├── layout.js           # Root layout with JSON-LD SEO schema
│   │   └── page.js             # Interactive home page & image canvas
│   ├── components/
│   │   ├── BrandingConsole.js  # Developer console signature
│   │   └── Navbar.js           # Top navigation bar with theme and i18n
│   └── context/
│       └── LanguageContext.js  # Dual-language i18n state manager
├── tmp/                        # Temporary uploaded images & outputs (auto-swept)
├── inference-worker.js         # Isolated worker for memory-safe inference
├── model-server.js             # Standalone Model Engine API service (port 5000)
├── server.js                   # Web gateway & REST API server (port 3000)
├── package.json                # Project dependencies and scripts
├── CHANGELOG.md                # Release history and updates
├── LICENSE                     # MIT License
└── README.md                   # Project documentation
```

---

## Getting Started

### Prerequisites

- Node.js (version 18.0.0 or newer)
- npm or yarn
- ONNX model weights placed in `models/` (refer to `models/README.md`)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/DDGXO/openremove.git
cd openremove
npm install
```

### 2. Environment Variables Configuration

Copy the template to create your local `.env` file:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for the web gateway interface and REST API |
| `BACKEND_URL` | `http://localhost:5000` | URL or domain of the backend model engine |
| `FRONTEND_URL`| `http://localhost:3001` | URL of the Next.js frontend for status probe |
| `ACTIVE_MODELS`| `all` | Comma-separated list of active ONNX models |
| `MODEL_PATH` | `./models/briarmbg.onnx`| Custom path to default RMBG model weights |

---

### 3. Running the Stack

#### Step A: Start the AI Model Inference Engine
Runs the ONNX Runtime multi-model engine on port 5000:

```bash
npm run start:engine
```

#### Step B: Start the Web API Gateway
Runs the Express gateway and system monitor on port 3000:

```bash
BACKEND_URL=http://localhost:5000 npm run start:web
```

#### Step C: Start the Next.js Frontend
For local development:

```bash
npm run next:dev
```

For production deployment:

```bash
npm run next:build
npm run next:start
```

---

## API Reference

### Healthcheck

Check service status and uptime.

```http
GET /ping
GET /api/ping
```

**Response (`200 OK`)**:
```json
{
  "status": true,
  "message": "pong",
  "app": "OpenRemove",
  "timestamp": 1789722300000
}
```

---

### Upload Image

Upload an image for background removal.

```http
POST /api/upload
Content-Type: multipart/form-data
```

**Form Data**:
- `image`: Image file (JPG, PNG, WEBP, JFIF, max 25MB)

**Response (`200 OK`)**:
```json
{
  "status": true,
  "jobId": "1789722300-abc123xyz",
  "filename": "upload-1789722300-123456789.jpg"
}
```

---

### Stream Inference & Progress (SSE)

Connect to the Server-Sent Events stream to receive real-time execution progress and download URLs.

```http
GET /api/process-stream/:jobId
```

**Events**:

`event: progress`
```json
{
  "percent": 40,
  "statusText": "Executing RMBG AI background segmentation on CPU...",
  "log": "[17:50:12] ONNX InferenceSession running on CPU (AVX2 mode)..."
}
```

`event: complete`
```json
{
  "status": true,
  "durationMs": 2850,
  "originalUrl": "/tmp/upload-1789722300-123456789.jpg",
  "resultUrl": "/tmp/nobg-upload-1789722300-123456789.png",
  "downloadName": "nobg-upload-1789722300-123456789.png"
}
```

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) and our [Code of Conduct](docs/CODE_OF_CONDUCT.md) before submitting pull requests or issues.

---

## Acknowledgments

OpenRemove builds upon the work of the following open-source projects:

- **[BRIA RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4)**: State-of-the-art background removal model by BRIA AI.
- **[Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime)**: Cross-platform inference engine.
- **[Sharp & libvips](https://github.com/lovell/sharp)**: High-speed Node.js image processing library.
- **[Hugging Face Community](https://huggingface.co/)**: Open-source model weights hosting and conversions.


---

## License

This project is licensed under the [MIT License](LICENSE).
