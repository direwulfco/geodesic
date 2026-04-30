# Geodesic — Auto-Topology Agent

**Deep codebase analysis with PHI/HIPAA-safe AI synthesis, Crystal learning, and scored gap reports.**

---

## What Geodesic Does

Point Geodesic at any repository and it produces three actionable artifacts in minutes:

- **Architecture Map** — full topology: layers, APIs, databases, auth patterns, infrastructure
- **Skill File** — machine-readable context package for build agents and CI pipelines (`skill-file.geodesic.json` + `.md`)
- **Gap Report** — scored assessment across 7 dimensions with prioritized P0–P3 findings and exact file/line references

---

## Key Features

- **PHI/HIPAA-safe by default** — a mandatory intercept layer scrubs all PII, PHI, and secrets before anything reaches the AI. A tamper-evident attestation chain is written for every analysis.
- **Provider-agnostic** — bring your own API key for Anthropic, OpenAI, Gemini, Azure OpenAI, or run fully local with Ollama. One config, all providers.
- **Crystal learning** — Geodesic learns from every analysis via a Crystal Store that lives in your own GitHub repository. Your data never leaves your environment. Matching prior analyses reduces token cost by ~70% and improves result quality over time.
- **Multi-repo** — analyze multiple repositories simultaneously from the sidebar. All repos share the same Crystal Store within a session.
- **Works everywhere** — one `.vsix` installs on VS Code, Cursor, Antigravity, VSCodium, and any VS Code-compatible editor.

---

## Getting Started

**1. Configure your AI provider** — open the Geodesicsic sidebar, enter your API key, and pick a provider. Settings are saved to `~/.geodesic/config.json` and never leave your machine.

**2. Add a repository** — click **Add Repository** or let Geodesic auto-detect your current workspace folder.

**3. Run analysis** — click **Analyze**. Progress is shown live in the sidebar. Results open automatically when complete.

---

## Output

All artifacts are written to `<repo>/geodesic-findings/` — a folder created inside the analyzed repository (gitignored automatically).

| File | Audience |
|---|---|
| `architecture-map.md` | Developers, architects, PMs |
| `skill-file.geodesic.json` | Build agents, CI pipelines |
| `skill-file.geodesic.md` | Developers, team briefings |
| `gap-report.md` | Developers, tech leads |

---

## Supported AI Providers

| Provider | Notes |
|---|---|
| Anthropic (Claude) | Recommended — best gap report quality |
| OpenAI (GPT-4o) | Fully supported |
| Google Gemini | Fully supported |
| Azure OpenAI | Enterprise deployments |
| Ollama | Air-gapped / fully local — no API key required |

---

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18 LTS or higher (bundled engine, no separate install needed)
- An API key for your chosen provider (or Ollama running locally)

---

## Privacy

Geodesic's PII/HIPAA intercept layer runs locally before any data leaves your machine. The AI never sees raw source code — only scrubbed, tokenized payloads. The attestation chain (`geodesic-attestation.jsonl`) is written to your home directory and is never uploaded, synced, or included in Crystal exports.
