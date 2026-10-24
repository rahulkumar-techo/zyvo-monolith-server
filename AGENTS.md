# ZYVO Engineering Guidelines for AI & Coding Agents

This repository hosts **ZYVO**, a scalable ride-hailing backend architected as a **Modular Monolith**.

All coding agents working on this codebase must adhere strictly to the following rules and design principles.

---

## 1. Modular Monolith Architecture
- **Single Deployable Unit**: The system runs as a single Fastify application (`apps/api`). Do not introduce separate worker services, standalone realtime microservices, or external daemon applications without explicit user approval.
- **Strict Module Boundaries**: Each domain resides in its dedicated directory under `apps/api/src/modules/<module-name>` (e.g., `auth`, `users`, `riders`, `vehicles`, `rides`, `dispatch`, `pricing`, `payments`, `wallets`, `notifications`, `ratings`, `admin`).
- **In-Process Communication**: Cross-module communication must happen via direct service calls or domain events, never HTTP calls to self.
- **Future Extraction Readiness**: Keep module dependencies unidirectional and avoid circular imports so individual modules can be extracted into standalone services if scale demands it in the future.

---

## 2. Layered Responsibilities
Each module should follow a clean separation of concerns:
- `routes.ts`: Thin HTTP controllers. Parse input, invoke service, return response using `sendSuccess`. No business logic.
- `schema.ts`: Zod schemas for request validation (params, query, body) and response contracts.
- `service.ts`: Core business logic, workflows, domain validations, and transaction boundaries.
- `repository.ts`: Database access queries using Prisma. Keeps Prisma queries isolated and easily testable.

---

## 3. API Contract and Error Handling
- **Consistent Response Schema**:
  - Success: `{ "success": true, "data": ..., "requestId": "..." }`
  - Error: `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] }, "requestId": "..." }`
- **Error Types**: Throw specific `AppError` subclasses (`BadRequestError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`).
- **Never Expose Internals**: Never leak stack traces, database credentials, internal SQL queries, or internal file paths in production HTTP responses.

---

## 4. Input Validation & Security
- **Validate at Boundaries**: Validate all incoming parameters, query strings, and payloads with Zod schemas.
- **Authentication & Authorization**: Always verify user identity, role permissions, and resource ownership before mutating or returning sensitive data.
- **Never Hardcode Secrets**: All secrets and environment-specific configuration must be validated through `apps/api/src/config/env.ts` and loaded from environment variables.

---

## 5. Database & Resources
- **Prisma Client**: Re-use the shared singleton exported by `@zyvo/database`. Never instantiate `new PrismaClient()` in request handlers.
- **Redis Client**: Use the shared connection provided on `fastify.redis`. Ensure timeouts and error listeners are respected.
- **Connection Hygiene**: Always release resources and close connections cleanly on shutdown.

---

## 6. Testing & Quality
- **Unit & Integration Tests**: Add automated tests using Vitest and Fastify's `inject()` API for every new endpoint or business rule.
- **Mock External Dependencies**: Tests must run hermetically without requiring live production databases or paid third-party APIs.
- **Strict TypeScript**: Maintain strict TypeScript typing (`noImplicitAny`, strict null checks). Avoid `any`; use `unknown` and proper type narrowing.
- **No Console Logs**: Use Fastify's structured Pino logger (`request.log` or `app.log`). Never use `console.log`.

---

## 7. Change Discipline
- Make the smallest possible change that solves the user's problem.
- Do not refactor unrelated working code.
- Do not add dependencies without a clear requirement.
