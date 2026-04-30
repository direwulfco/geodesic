<p align="center">
  <img src="assets/banner.png" alt="Geodesic" width="880" />
</p>

<p align="center">
  Geodesic deep-scans any codebase in minutes and produces a complete architecture map, AI-ready skill file, and scored gap report — available as a native VS Code and JetBrains extension, with zero config, zero cloud upload, and a PII intercept layer that keeps your code yours.
</p>

<p align="center">
  <a href="https://github.com/hyperpaced/geodesic/actions/workflows/ci.yml"><img src="https://github.com/hyperpaced/geodesic/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=HyperPace.geodesic"><img src="https://img.shields.io/visual-studio-marketplace/v/HyperPace.geodesic?label=VS%20Code" alt="VS Code Marketplace" /></a>
</p>

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

All artifacts are written to `<repo>/geodesic-findings/` — a folder created inside the analyzed repository (gitignored automatically).

| File | Description |
|---|---|
| `architecture-map.md` | Full topology: layers, APIs, databases, auth patterns, infrastructure |
| `skill-file.geodesic.json` | Machine-readable context package for build agents and CI pipelines |
| `skill-file.geodesic.md` | Human-readable version of the skill file |
| `gap-report.md` | Scored across 7 dimensions, P0–P3 findings with exact file:line references |

---

## Crystal Store

The Crystal Store is a learning system that accumulates structural patterns across analyses. It lives in **your own GitHub repository** — Geodesic reads and writes it directly. We never see it, touch it, or host it.

```bash
# Point Geodesic at your own repo
geodesic config set crystal-store-repo https://github.com/your-org/your-crystals
geodesic config set crystal-store-token ghp_your_token

# First run clones it automatically
geodesic crystals sync
```

Crystals contain zero source code and zero PII — only structural fingerprints and reasoning patterns. Teams running Geodesic across multiple projects see compounding quality improvements as the Crystal Store grows.

---

## Installation

### VS Code, Cursor, Antigravity, VSCodium

Install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=HyperPace.geodesic) or [Open VSX Registry](https://open-vsx.org/extension/HyperPace/geodesic).

Or install from VSIX:
```bash
code --install-extension geodesic-0.1.0.vsix
```

The VSIX is self-contained — the analysis engine is bundled. No separate install required.

### JetBrains (IntelliJ, WebStorm, PyCharm, GoLand, Rider)

Install from the [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/geodesic-dev).

Or install from disk: **Settings → Plugins → ⚙ → Install Plugin from Disk…**

### CLI

```bash
npm install -g @geodesic/cli
```

---

## Quickstart (CLI)

```bash
# 1. Set your AI provider
geodesic config set provider anthropic
geodesic config set api-key sk-ant-…

# 2. Analyze a repository
geodesic analyze /path/to/your/repo

# 3. View results
open /path/to/your/repo/geodesic-findings/gap-report.md
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

Geodesic is provider-agnostic by design. Swap providers with a single config change.

---

## PHI/HIPAA compliance

- Every string value in the harvested payload is inspected before AI synthesis
- Detections are replaced with typed, reversible tokens — the AI never sees the original value
- A tamper-evident, SHA-256-linked attestation chain is written for every scrubbed value
- Uncertain detections (confidence < HIGH) are scrubbed and flagged for manual review
- The attestation chain (`geodesic-attestation.jsonl`) is a compliance deliverable — never committed to git, never synced

---

## Monorepo structure

```
packages/
├── engine/        TypeScript — all analysis logic, local REST daemon
├── vscode-ext/    VS Code extension (.vsix) — thin shell over the engine API
├── jetbrains/     JetBrains plugin — thin shell over the engine API
└── cli/           CLI wrapper — geodesic analyze
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

*Built by [HyperPace](https://hyperpace.ai)*
