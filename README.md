# OpenRemove

A high-performance, self-hosted, offline AI background removal application and REST API powered by BiRefNet and Microsoft ONNX Runtime.

---

## Overview

Commercial background removal APIs often enforce restrictive quotas, usage tracking, recurring subscription models, or privacy concerns regarding cloud data transfers.

OpenRemove provides a self-hosted, private alternative designed for local hardware execution. It isolates subjects and removes backgrounds using state-of-the-art dichotomous image segmentation without relying on external cloud APIs or third-party telemetry.

---

## Key Features

- **BiRefNet Segmentation**: High-resolution dichotomous segmentation for fine edge preservation, hair matting, and foreground isolation.
- **Local Execution**: Runs 100% offline via Microsoft ONNX Runtime (C++ engine) with AVX2 CPU acceleration.
- **Comparison Viewer**: Built-in before/after split slider powered by CSS clipping.
- **Real-Time Progress Streaming**: Server-Sent Events (SSE) provide live progress percentages and execution stages.
- **Clipboard & Drag-and-Drop**: Supports direct image paste (`Ctrl + V`) and file selection.
- **REST API**: Simple endpoints for integration with bot services, scripts, and automated workflows.

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
│   ├── lite/                   # BiRefNet Lite ONNX model weights
│   └── standard/               # BiRefNet Standard ONNX model weights
├── public/
│   ├── index.html              # Web application interface
│   ├── robots.txt              # Crawler permissions
│   └── .well-known/
│       └── security.txt        # Vulnerability disclosure policy
├── tmp/                        # Temporary uploaded images & outputs
├── inference-worker.js         # Isolated worker for memory-safe inference
├── model-server.js             # Standalone Model Engine API service
├── server.js                   # Web gateway & REST API server
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
- BiRefNet ONNX Model weights (`model.onnx`)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/DDGXO/openremove.git
cd openremove
npm install
```

### 2. Model Weights

- **BiRefNet Lite (Pre-included)**: Included in the repository under `models/lite/model.onnx` for out-of-the-box offline inference.
- **BiRefNet Standard (Optional high-precision)**: Download from [emrikol/birefnet-matting-onnx](https://huggingface.co/emrikol/birefnet-matting-onnx) on Hugging Face and place in `models/standard/model.onnx`.

### 3. Environment Variables Configuration

Copy the template to create your local `.env` file:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for the web gateway interface and REST API |
| `BACKEND_URL` | `http://localhost:5000` | URL or domain of the backend model engine |
| `MODEL_PATH` | `./models/lite/model.onnx` | Custom path to ONNX model weights |

---

### 4. Running the Server

#### Option A: Standalone Mode (All-in-One)
Run the web application and local AI inference pipeline together on a single server:

```bash
npm start
```

- **Web Interface**: `http://localhost:3000`
- **Healthcheck**: `http://localhost:3000/ping`

#### Option B: Decoupled Mode (Microservice Architecture)
Run the Model Inference Engine on a dedicated compute machine and the Web Gateway on a separate node:

1. **Start Model Engine Server** (Port `5000` on compute machine):
   ```bash
   npm run start:engine
   ```

2. **Start Web Gateway** (pointing to Backend Model Server):
   ```bash
   BACKEND_URL=http://localhost:5000 npm run start:web
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
  "statusText": "Starting BiRefNet AI inference on CPU...",
  "log": "[17:50:12] ONNX InferenceSession running on CPU (AVX2 mode)..."
}
```

`event: complete`
```json
{
  "status": true,
  "durationMs": 10250,
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

- **[BiRefNet](https://github.com/ZhengPeng7/BiRefNet)**: Dichotomous image segmentation research by [ZhengPeng7](https://github.com/ZhengPeng7) (MIT License).
- **[Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime)**: Cross-platform inference engine.
- **[Sharp & libvips](https://github.com/lovell/sharp)**: High-speed Node.js image processing library.
- **[Hugging Face Community](https://huggingface.co/)**: Open-source model weights hosting and conversions.

---

## License

This project is licensed under the [MIT License](LICENSE).
