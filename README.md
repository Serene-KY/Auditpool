# Auditpool

pnpm monorepo skeleton: API (Fastify) + Web (Next.js) + shared package.

---

## Structure

```
Auditpool/
├── apps/
│   ├── api/          # Node.js + TypeScript + Fastify (GET /health)
│   └── web/          # Next.js TypeScript (home page "Auditpool")
├── packages/
│   └── shared/       # Shared types/schemas (empty)
├── package.json      # Root scripts
├── pnpm-workspace.yaml
├── eslint.config.mjs
└── .prettierrc
```

---

## Requirements

- Node.js 18+
- pnpm (`npm install -g pnpm`)

---

## Setup

```bash
# Install dependencies
pnpm install

# Run dev (api + web concurrently)
pnpm dev
```

- **API** runs on http://localhost:3001 — test: `curl http://localhost:3001/health`
- **Web** runs on http://localhost:3000 — open in browser to see "Auditpool"

---

## Scripts

| Command    | Description                          |
|-----------|--------------------------------------|
| `pnpm dev` | Start api + web in parallel          |
| `pnpm build` | Build all packages                   |
| `pnpm test` | Run tests                            |
| `pnpm lint` | ESLint + Prettier check              |

---

## Env

Use `.env` files per app if needed:

- `apps/api/.env` — e.g. `PORT=3001`
- `apps/web/.env.local` — Next.js env vars
