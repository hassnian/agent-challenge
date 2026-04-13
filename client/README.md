# Synapse Client

The Synapse client is a **Nuxt 4** frontend for the Synapse personal research agent.
It provides a focused UI for starting research sessions, reviewing plans, tracking progress, and reading final evidence-backed memos.

## What it does

- start a new research session from a single question
- review and approve or revise the generated research plan
- track live progress across planning, research, critique, and synthesis
- read the final memo with evidence, objections, contested points, and confidence
- browse past completed sessions in history

## Architecture

This client is designed to run **separately** from the ElizaOS backend.

- **Frontend:** Nuxt 4 app in this `client/` directory
- **Backend:** Synapse / ElizaOS server running elsewhere
- **Connection:** server-side API calls from Nuxt to the Eliza server via `ELIZA_SERVER_URL`

That means you can host the client on platforms like **Cloudflare Pages**, **Vercel**, or another web host, while keeping the ElizaOS agent runtime deployed on **Nosana**.

## Routes

- `/` — start a new research session
- `/session/:id` — active research session view
- `/history` — completed research sessions

## Requirements

- Node.js 20+
- Bun
- a running Synapse / ElizaOS backend

## Configuration

Set the backend URL with:

```bash
ELIZA_SERVER_URL=http://127.0.0.1:3000
```

Notes:
- the default fallback is `http://127.0.0.1:3000`
- this should point to the running ElizaOS server, not the Nuxt app itself
- if your backend is deployed on Nosana, set `ELIZA_SERVER_URL` to that live URL

## Install

```bash
bun install
```

## Local development

If your Eliza backend runs locally on port `3000`, start the Nuxt client on a different port such as `3001`.

```bash
# from the repo root
cd client
ELIZA_SERVER_URL=http://127.0.0.1:3000 bun run dev -- --port 3001
```

Then open:

```text
http://localhost:3001
```

## Build

```bash
cd client
bun run build
```

## Preview production build

```bash
cd client
ELIZA_SERVER_URL=http://127.0.0.1:3000 bun run preview
```

## Deployment notes

Typical submission architecture:

- **Nosana** hosts the Synapse / ElizaOS backend
- **Cloudflare / Vercel** hosts this Nuxt client
- the client talks to the Nosana backend through `ELIZA_SERVER_URL`

As long as the backend URL is reachable, the frontend can be deployed independently.

## Related files

- `client/nuxt.config.ts` — Nuxt config and runtime config
- `client/server/api/` — server routes used by the UI
- `client/server/utils/eliza.ts` — Eliza integration and session mapping
- `client/app/pages/` — main application views

## Main repo

For the full project, backend setup, Docker image, and Nosana job definitions, see the root [`README.md`](../README.md).
