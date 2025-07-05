# ZenDoc - Code Documentation in Minutes

<p align="center">
  <img src="/assets/cover.jpeg" width="200" alt="Zen Doc Logo" />
</p>

<p align="center">
  <strong>Auto-generate full documentation sites from your codebase using AI + Astro + Lingo.dev — all with a single command.</strong>
</p>

<p align="center">
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/build-passing-brightgreen.svg" alt="Build Status" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-bun-blueviolet" alt="Bun Runtime" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License" /></a>
</p>

---

## ✨ Features

- 🛠 One-command setup: `npx zen-doc generate`
- 🧠 AI-generated docs from components, utils, APIs (using Google Gemini)
- 🌐 Optional translation via Lingo.dev
- ⚡ Astro-powered static Markdown documentation
- 🔐 Credit system w/ Stripe + Autumn (useautumn.com)
- 🧹 Ignores unnecessary folders (e.g., node_modules, dist)
- 🔄 Re-run anytime with saved config
- 🔌 Supports all major package managers (npm, yarn, pnpm, bun)

---

## 🚀 Quick Start

```bash
npx zen-doc init
npx zen-doc generate
```

✅ A full documentation site will be created in the /docs folder.

### 📦 Development Setup

```bash
git clone https://github.com/leen-neel/zen-doc.git
cd zen-doc
bun install
bun link
```
