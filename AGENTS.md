# AGENTS.md

This repo's coding-agent guidance lives in [CLAUDE.md](CLAUDE.md) — read that file first.
It covers commands (build/dev/seed/test-fixture scripts) and the architecture of the API
(`api/src`) and frontend (`frontend/src`). This file exists only so agents that look for
`AGENTS.md` specifically (Codex, Cursor, etc.) find their way there; keep guidance changes in
CLAUDE.md and let this stay a pointer to avoid the two drifting apart.

Quick-start commands (see CLAUDE.md for the full list and rationale):

```bash
npm run install:all
cd api && npm start          # Functions API on :7071
cd frontend && npm run dev   # Vite dev server on :5173, proxies /api -> :7071
npm run build                # builds both packages
```
