# Datedly-AI

**One prompt. One AI. A complete calendar. Almost any idea.**

Datedly AI turns a natural-language idea ("a 24-day MMA Advent calendar with
quizzes and challenges", "a 14-day Python course", "a 7-day Paris discovery
trip"...) into a complete, editable, publishable calendar, using a local AI
(Ollama).

## Architecture

| Part | Tech | Role |
| --- | --- | --- |
| `frontend/` | Next.js, TypeScript, Tailwind | Studio interface (local) and public site (GitHub Pages) |
| `backend/` | Rust, Axum, Tokio, Serde | Local studio API: storage, calendar engine, AI providers |
| Ollama | local models | Generates calendar content on your computer |
| GitHub Actions | CI + Pages | Tests every push, deploys the public site |

Generation happens **locally** (Ollama cannot be reached by GitHub). Calendars
are stored privately in `data/` (git-ignored). Future entries will never be
published in readable form before their date (phase 4).

## Run it locally

Requirements: Node 22+, Rust (stable), [Ollama](https://ollama.com) with at
least one text model (`ollama pull qwen3:8b` for example).

```bash
# 1. Backend: studio API on http://localhost:8787
cd backend
cargo run

# 2. Frontend: studio on http://localhost:3000 (second terminal)
cd frontend
npm install
npm run dev
```

## Roadmap

1. **Foundation**: architecture, Ollama detection, model selection, data models ✅
2. AI generation: prompt → plan → entries, validated JSON
3. Calendar editor: preview, edit, regenerate, drafts
4. Publishing: public pages, server-side unlocking, scheduled GitHub Actions
5. Quality: tests, security review, docs

## GitHub Pages

The `Deploy to GitHub Pages` workflow publishes the static site on every push
to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**.
