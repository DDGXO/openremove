# Contributing to OpenRemove

Thank you for your interest in contributing to OpenRemove. We welcome contributions from developers, researchers, and designers.

---

## How to Contribute

### Reporting Bugs
- Search existing [Issues](https://github.com/DDGXO/openremove/issues) to verify if the bug has already been reported.
- If not, create a new issue using our **Bug Report** template.
- Provide clear reproduction steps, sample images (if applicable), operating system details, and relevant error logs.

### Suggesting Features
- Open an issue using the **Feature Request** template.
- Describe the problem you want to solve, the proposed solution, and any potential alternatives considered.

### Submitting Code (Pull Requests)

Follow these steps to submit changes:

1. **Fork the Repository**:
   Click the **Fork** button on GitHub to create your own copy of the repository (`https://github.com/DDGXO/openremove`).

2. **Clone Locally**:
   ```bash
   git clone https://github.com/<your-username>/openremove.git
   cd openremove
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

5. **Make Changes**:
   - Write clean, readable, and well-structured code.
   - Maintain the minimalist, dependency-light SaaS aesthetic for UI changes.
   - Keep AI model inference logic decoupled and isolated.

6. **Test Changes**:
   - Verify server startup: `node server.js`
   - Test image background removal with various image formats (JPG, PNG, WEBP, JFIF).
   - Ensure the `/ping` endpoint and SSE stream respond properly without memory leaks.

7. **Commit & Push**:
   ```bash
   git add .
   git commit -m "feat: add descriptive commit message"
   git push origin feature/your-feature-name
   ```

8. **Open a Pull Request**:
   - Navigate to the original repository and open a Pull Request against the `main` branch.
   - Fill out the PR template with a clear explanation of what was changed and why.

---

## Code Style & Guidelines

- **JavaScript**: Standard ES6+ syntax, asynchronous operations using `async/await`.
- **Frontend**: Clean Tailwind CSS utility classes with native CSS when necessary. Avoid heavy client-side frameworks.
- **Language**: All codebase documentation, comments, and public interfaces must be written in **English**.
- **Privacy & Offline First**: OpenRemove must never transmit user images to external third-party cloud servers.

---

## Code of Conduct

All contributors and maintainers are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure an open, welcoming, and harassment-free environment for everyone.
