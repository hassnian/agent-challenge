# Synapse

Synapse is a personal research agent built with **ElizaOS**.
It helps turn open-ended questions into structured, evidence-backed research sessions.

## Project Structure

```text
.
├── src/                  # agent source
├── client/               # optional frontend
├── nos_job_def/          # job definitions
├── scripts/              # utility scripts
├── Dockerfile
├── .env.example
└── README.md
```

## What this repo contains

- ElizaOS agent runtime
- custom research workflow plugin
- optional client app in `./client`
- Dockerfile for containerized runs

## Prerequisites

- Node.js 23+
- Bun
- Docker

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/hassnian/agent-challenge
cd agent-challenge
cp .env.example .env
bun install
```

### 2. Configure `.env`

Minimum required envs:

```env
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://your-endpoint/v1
OPENAI_SMALL_MODEL=your-model-name
OPENAI_LARGE_MODEL=your-model-name
SERVER_PORT=3000
```

Optional embedding envs:

```env
OPENAI_EMBEDDING_URL=https://your-embedding-endpoint/v1
OPENAI_EMBEDDING_API_KEY=your_embedding_key
OPENAI_EMBEDDING_MODEL=your-embedding-model
OPENAI_EMBEDDING_DIMENSIONS=1024
```

Search envs (at least one search provider is required):

```env
TAVILY_API_KEY=your_tavily_key
SERPER_API_KEY=your_serper_key
JINA_API_KEY=your_jina_key
```

Notes:
- use an **OpenAI-compatible** endpoint
- `OPENAI_BASE_URL` should usually end in `/v1`
- set `OPENAI_SMALL_MODEL` and `OPENAI_LARGE_MODEL` to the model name exposed by your provider
- at least one of `TAVILY_API_KEY` or `SERPER_API_KEY` is required for web research
- `JINA_API_KEY` is optional, but helps with reading source pages via `r.jina.ai`

### 3. Run locally

```bash
bun run dev
```

Open:

```text
http://localhost:3000
```

## Run with Docker

Build:

```bash
docker build -t hassnian/nosana-eliza-agent:latest .
```

Run:

```bash
docker run --rm -it -p 3000:3000 --env-file .env hassnian/nosana-eliza-agent:latest
```

## Notes

- If the app is running in API mode, `/` may not render a UI.
- Useful health/API endpoints include:
  - `/api/server/ping`
  - `/api/agents`
- The Docker image used for deployment is:
  - `hassnian/nosana-eliza-agent:latest`

## License

MIT — see [LICENSE](./LICENSE)
