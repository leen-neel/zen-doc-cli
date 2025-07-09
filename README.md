# ZenDoc - Code Documentation in Minutes

<p align="center">
  <img src="https://github.com/leen-neel/zen-doc-cli/blob/master/assets/logo.png?raw=true" width="200" alt="Zen Doc Logo" />
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
- 🌐 **Multi-language support** with automatic translation via Lingo.dev
- ⚡ Astro-powered static Markdown documentation with Starlight
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

## 🌐 Multi-Language Support

ZenDoc supports automatic translation of your documentation using Lingo.dev. When you run `npx zen-doc init`, you can enable translation and specify which languages you want to support.

### Supported Languages

The documentation will be automatically translated to your chosen languages and organized in the following structure:

```
docs/
├── content/
│   └── docs/
│       ├── index.mdx    # English (source) - main documentation
│       ├── components/  # English components
│       ├── pages/       # English pages
│       ├── api/         # English API docs
│       ├── lib/         # English utilities
│       ├── es/          # Spanish translations
│       ├── fr/          # French translations
│       ├── de/          # German translations
│       └── ...          # Other language translations
```

### Configuration

During the initialization process, you'll be prompted to:

1. **Enable translation**: Choose whether to enable automatic translation
2. **Lingo.dev API Key**: Provide your Lingo.dev API key for translation services
3. **Target languages**: Specify which languages to translate to (e.g., `es,fr,de`)

Example configuration (`zen.config.mjs`):

```javascript
export default {
  apiKey: "your-google-gemini-api-key",
  projectName: "My Project",
  useTranslation: true,
  lingoApiKey: "your-lingo-dev-api-key",
  languages: ["es", "fr", "de"],
};
```

### Language Support

ZenDoc supports a wide range of languages including:

- **European**: Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt), Dutch (nl), Swedish (sv), Danish (da), Norwegian (no), Finnish (fi), Polish (pl), Czech (cs), Hungarian (hu), Romanian (ro), Bulgarian (bg), Croatian (hr), Slovenian (sl), Estonian (et), Latvian (lv), Lithuanian (lt), Maltese (mt), Irish (ga), Welsh (cy)
- **Asian**: Japanese (ja), Korean (ko), Chinese (zh), Hindi (hi)
- **Other**: Russian (ru), Turkish (tr), Arabic (ar)

### 📦 Development Setup

```bash
git clone https://github.com/leen-neel/zen-doc.git
cd zen-doc
bun install
bun link
```
