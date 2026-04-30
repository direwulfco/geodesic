# Geode

[![CI](https://github.com/hyperpaced/geode/actions/workflows/ci.yml/badge.svg)](https://github.com/hyperpaced/geode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/hyperpaced.geode?label=VS%20Code)](https://marketplace.visualstudio.com/items?itemName=hyperpaced.geode)

**Production-grade codebase topology analysis. PHI/HIPAA-safe. Provider-agnostic. Your data stays yours.**

Geode performs deep static analysis of any repository, scrubs all PII/PHI before touching an AI, and produces three artifacts your team actually uses — a full architecture map, a machine-readable skill file for build agents, and a scored gap report with findings down to the exact file and line.

It runs entirely on your machine. Your source code never leaves your environment intact.

---

## How it works

```
Repository
    │
    ▼
Static Harvester        — files, routes, databases, auth, deps, tests, infra
    │
    ▼
PII/HIPAA Intercept     — scrubs every string value, replaces with typed tokens
    │                     tamper-evident attestation chain written per detection
    ▼
Crystal Query           — checks your Crystal Store for a matching prior analysis
    │                     ~70% token reduction on cache hit
    ▼
AI Synthesis            — provider-agnostic, sees scrubbed data only
    │                     5-minute timeout, exponential backoff on rate limits
    ▼
Artifact Generator      — three output files, written atomically
    │
    ▼
Crystal Extractor       — updates your Crystal Store with structural patterns
                          zero source code, zero PII in crystals — ever
```

---

## Output artifacts

All artifacts are written to `<repo>/geode-findings/` — a folder created inside the analyzed repository (gitignored automatically).

| File | Description |
|---|---|
| `architecture-map.md` | Full topology: layers, APIs, databases, auth patterns, infrastructure |
| `skill-file.geode.json` | Machine-readable context package for build agents and CI pipelines |
| `skill-file.geode.md` | Human-readable version of the skill file |
| `gap-report.md` | Scored across 7 dimensions, P0–P3 findings with exact file:line references |

---

## Crystal Store

The Crystal Store is a learning system that accumulates structural patterns across analyses. It lives in **your own GitHub repository** — Geode reads and writes it directly. We never see it, touch it, or host it.

```bash
# Point Geode at your own repo
geode config set crystal-store-repo https://github.com/your-org/your-crystals
geode config set crystal-store-token ghp_your_token

# First run clones it automatically
geode crystals sync
```

Crystals contain zero source code and zero PII — only structural fingerprints and reasoning patterns. Teams running Geode across multiple projects see compounding quality improvements as the Crystal Store grows.

---

## Installation

### VS Code, Cursor, Antigravity, VSCodium

Install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=geode-dev.geode) or [Open VSX Registry](https://open-vsx.org/extension/geode-dev/geode).

Or install from VSIX:
```bash
code --install-extension geode-0.1.0.vsix
```

The VSIX is self-contained — the analysis engine is bundled. No separate install required.

### JetBrains (IntelliJ, WebStorm, PyCharm, GoLand, Rider)

Install from the [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/geode-dev).

Or install from disk: **Settings → Plugins → ⚙ → Install Plugin from Disk…**

### CLI

```bash
npm install -g @geode/cli
```

---

## Quickstart (CLI)

```bash
# 1. Set your AI provider
geode config set provider anthropic
geode config set api-key sk-ant-…

# 2. Analyze a repository
geode analyze /path/to/your/repo

# 3. View results
open /path/to/your/repo/geode-findings/gap-report.md
```

---

## Supported AI providers

| Provider | Notes |
|---|---|
| Anthropic (Claude) | Recommended |
| OpenAI (GPT-4o) | Fully supported |
| Google Gemini | Fully supported |
| Azure OpenAI | Enterprise deployments |
| Ollama | Fully local — no API key, no network calls |

Geode is provider-agnostic by design. Swap providers with a single config change.

---

## PHI/HIPAA compliance

- Every string value in the harvested payload is inspected before AI synthesis
- Detections are replaced with typed, reversible tokens — the AI never sees the original value
- A tamper-evident, SHA-256-linked attestation chain is written for every scrubbed value
- Uncertain detections (confidence < HIGH) are scrubbed and flagged for manual review
- The attestation chain (`geode-attestation.jsonl`) is a compliance deliverable — never committed to git, never synced

---

## Monorepo structure

```
packages/
├── engine/        TypeScript — all analysis logic, local REST daemon
├── vscode-ext/    VS Code extension (.vsix) — thin shell over the engine API
├── jetbrains/     JetBrains plugin — thin shell over the engine API
└── cli/           CLI wrapper — geode analyze
```

---

## Building from source

```bash
# Install dependencies
npm install

# Build all packages
npm run build --workspaces

# Run tests
npx vitest run

# Type check
npm run typecheck --workspaces

# Build VS Code extension
cd packages/vscode-ext
node esbuild.mjs --production
npx vsce package --no-dependencies
```

---

## Requirements

- Node.js 18 LTS or higher
- An API key for your chosen provider (or Ollama running locally)

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built by [HyperPace](https://hyperpaced.com)*
