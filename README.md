# ZYVO — Scalable Ride-Hailing Backend

ZYVO is a scalable backend for a modern ride-hailing platform, architected as a **Modular Monolith** using TypeScript, Fastify, Prisma, PostgreSQL, and Redis.

---

## Architecture Overview

ZYVO adopts a **Modular Monolith** architecture:
- **Single Deployable Unit**: One Fastify application (`apps/api`) serving all business domains via unified HTTP routing.
- **Strict Domain Boundaries**: Business modules (`auth`, `users`, `riders`, `vehicles`, `rides`, `dispatch`, `pricing`, `payments`, `wallets`, `notifications`, `ratings`, `admin`) are organized into discrete directories with dedicated routes, services, and repositories.
- **Evolutionary Scalability**: Modules communicate in-process with clean interfaces, allowing high-throughput modules (e.g., dispatch or pricing) to be factored into independent microservices in the future without major architectural rewrites.

---

## Directory Structure

```text
zyvo/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── app.ts                 # Fastify app factory
│       │   ├── server.ts              # HTTP server & graceful shutdown
│       │   ├── config/env.ts          # Zod-validated environment config
│       │   ├── plugins/               # Fastify plugins (prisma, redis, security, swagger)
│       │   ├── common/                # Shared errors, utils, and response contracts
│       │   └── modules/               # Domain business modules
│       ├── test/                      # Vitest unit & integration tests
│       └── package.json
├── packages/
│   ├── database/                      # Prisma schema and client singleton
│   │   ├── prisma/schema.prisma
│   │   └── src/index.ts
│   └── shared/                        # Shared types, error classes, and constants
│       └── src/
├── infrastructure/
│   └── compose.yaml                   # Local PostgreSQL & Redis services
├── .env.example                       # Template for environment configuration
├── pnpm-workspace.yaml                # pnpm monorepo workspace definition
├── turbo.json                         # Turborepo task pipeline configuration
├── tsconfig.base.json                 # Shared base TypeScript configuration
└── AGENTS.md                          # Guidelines for future AI & human developers
```

---

## Prerequisites

- **Node.js**: >= 20.x (tested on Node v24)
- **pnpm**: >= 9.x / 10.x / 11.x
- **Docker & Docker Compose**: For local PostgreSQL and Redis

---

## Getting Started

### 1. Clone & Install Dependencies

```bash
pnpm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure the configuration matches your local environment.

### 3. Start Local Infrastructure

Start PostgreSQL and Redis containers with Docker Compose:

```bash
docker compose -f infrastructure/compose.yaml up -d
```

Verify services are running:

```bash
docker compose -f infrastructure/compose.yaml ps
```

### 4. Database Setup & Prisma Generation

Generate the Prisma client:

```bash
pnpm db:generate
```

Apply database migrations:

```bash
pnpm db:migrate
```

*(Optional) Open Prisma Studio:*

```bash
pnpm db:studio
```

### 5. Run Development Server

```bash
pnpm dev
```

The API server will start on `http://127.0.0.1:3000`.

---

## Verification & Quality Commands

| Command | Description | Status |
|---|---|---|
| `pnpm install` | Install workspace dependencies | Verified |
| `pnpm db:generate` | Generate Prisma client bindings | Verified |
| `pnpm typecheck` | Run TypeScript strict type-checking across all packages | Verified |
| `pnpm test` | Run all Vitest integration and unit tests | Verified |
| `pnpm build` | Build workspace packages and API bundle | Verified |
| `pnpm dev` | Start development server with file watching | Verified |

---

## API Endpoints & Documentation

- **Interactive Swagger UI**: [http://127.0.0.1:3000/docs](http://127.0.0.1:3000/docs)
- **Public Liveness Probe**: `GET /health`
- **Dependency Readiness Probe**: `GET /ready` (verifies PostgreSQL and Redis health)
- **API v1 Metadata**: `GET /api/v1`

### Standard Response Formats

#### Success Response
```json
{
  "success": true,
  "data": {
    "status": "ok"
  },
  "requestId": "req-1"
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "email",
        "message": "Invalid email"
      }
    ]
  },
  "requestId": "req-1"
}
```
