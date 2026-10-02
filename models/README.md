# OpenRemove Model Weights Directory

This directory stores the ONNX model checkpoints used by the OpenRemove Model Engine.

## Included Models
* `u2netp.onnx` (~4.5 MB): Included directly in the repository for lightweight inference.

---

## Download Links for Heavy Models

Place all downloaded `.onnx` files directly inside this `models/` directory:

| Model | File Name | Size | Source / Download Link |
| :--- | :--- | :--- | :--- |
| **BRIA RMBG 1.4** | `briarmbg.onnx` | ~176 MB | [HuggingFace - briaai/RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx) |
| **IS-Net** | `isnet.onnx` | ~178 MB | [HuggingFace - isnet-general-use](https://huggingface.co/spaces/ECCV2022/dis-background-removal/resolve/main/isnet-general-use.onnx) |
| **Silueta** | `silueta.onnx` | ~44 MB | [HuggingFace - silueta](https://huggingface.co/ZhengPeng7/BiRefNet/resolve/main/silueta.onnx) |
| **BEN2** | `ben2.onnx` | ~223 MB | [HuggingFace - PramaLLC/BEN2](https://huggingface.co/PramaLLC/BEN2/resolve/main/model.onnx) |
| **U-2-Netp** | `u2netp.onnx` | ~4.5 MB | [HuggingFace - u2netp](https://huggingface.co/danielgatis/rembg/resolve/main/u2netp.onnx) |

---

## Directory Structure

Ensure the files are named exactly as shown:

```text
models/
├── ben2.onnx
├── briarmbg.onnx
├── isnet.onnx
├── silueta.onnx
└── u2netp.onnx
```

## Running Models

Control which models are loaded into memory via the `ACTIVE_MODELS` environment variable:

```bash
ACTIVE_MODELS=silueta,u2netp,isnet,rmbg node model-server.js
```
