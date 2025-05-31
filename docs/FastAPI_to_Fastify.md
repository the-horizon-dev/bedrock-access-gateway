# Migrating from FastAPI to Fastify

This project ships with two implementations of the Bedrock Access Gateway:

- `src/api` – a Python [FastAPI](https://fastapi.tiangolo.com/) service.
- `src/fastify-api` – a TypeScript [Fastify](https://fastify.dev/) service.

The Fastify version mirrors the functionality of the original FastAPI code while
leveraging Node.js and TypeScript. If you want to migrate your own extensions or
custom logic from the Python implementation, use the following guidelines.

## 1. Match the route structure

FastAPI routers live under `src/api/routers`. The equivalent Fastify routes can
be found in `src/fastify-api/src/routes`. Each Python route has a corresponding
TypeScript file. For example:

| FastAPI file | Fastify file |
|--------------|--------------|
| `routers/chat.py` | `routes/chat.routes.ts` |
| `routers/embeddings.py` | `routes/embeddings.routes.ts` |
| `routers/model.py` | `routes/models.routes.ts` |

When adding new endpoints, create a TypeScript route plugin under
`src/fastify-api/src/routes` and register it in `server.ts`.

## 2. Translate request and response models

The Python version uses Pydantic models defined in `src/api/schema.py`. The
Fastify code uses JSON schema via `@sinclair/typebox` in
`src/fastify-api/src/schemas`. Port your Pydantic models to TypeBox definitions
to benefit from Fastify's built‑in validation.

## 3. Implement service logic

Business logic for Bedrock calls resides in `src/api/models/bedrock.py` for
FastAPI and in `src/fastify-api/src/services/bedrock.ts` for Fastify. Translate
Python functions to TypeScript, using the AWS SDK for JavaScript. The existing
service demonstrates how to handle chat completions, streaming responses and
embedding requests.

## 4. Update environment configuration

Fastify loads environment variables via `@fastify/env` (see `server.ts`). Ensure
that variables such as `API_KEY` and `AWS_REGION` are available when starting the
server.

With these pieces in place you can replicate your FastAPI features in the
Fastify TypeScript application. See the project README for how to run the
Fastify server locally.

