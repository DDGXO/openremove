# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

The OpenRemove team takes the security of this project seriously. If you discover a security vulnerability, please do **NOT** open a public issue.

### How to Report

Please report security issues privately via GitHub Security Advisories or by emailing:
`security@dgxohq.com` (or directly to repository maintainers).

When reporting, please include:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or proof-of-concept (PoC) code to reproduce the issue.
- Operating system, Node.js version, and environment details.

### Response Timeline

- **Acknowledgment**: You will receive an acknowledgment within 48 hours of reporting.
- **Assessment**: The maintainers will investigate and provide regular updates on the remediation status.
- **Fix & Disclosure**: Once a fix is validated, a patched release will be published alongside a coordinated security advisory.

---

## Security Principles in OpenRemove

- **Local Execution**: All image processing and neural network inference occur 100% locally on the host machine.
- **Temporary Data Handling**: Uploaded files and intermediate masks in `tmp/` are strictly isolated per-session and cleaned up upon request completion.
- **Input Validation**: Uploaded payload sizes, MIME types, and filenames are sanitized to prevent path traversal or arbitrary file execution.
