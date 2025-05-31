# Bedrock Access Gateway

This guide helps AI agents (such as OpenAI Codex) understand the repository and contribute effectively.

## Repository Layout

- `/src/fastify-api` – primary Fastify service in TypeScript
  - `src/routes` – HTTP endpoints
  - `src/services` – business logic and AWS SDK wrappers
  - `test` – TAP-based tests
- `/docs` – user documentation
- `/scripts` – deployment helpers

Avoid modifying files under `assets` or `docs` unless updating documentation. New features should target the Fastify TypeScript codebase.

## Supported Models
The gateway supports reasoning with *Claude 3.7 Sonnet*, *Claude 4 Sonnet*, *Claude 4 Opus* and **DeepSeek R1**.

## Features

- [x] Support streaming response via server-sent events (SSE)
- [x] Support Model APIs
- [x] Support Chat Completion APIs
- [x] Support Tool Call
- [x] Support Embedding API
- [x] Support Multimodal API
- [x] Support Cross-Region Inference
- [x] Support Reasoning (**new**)

## Code Standards

- Use TypeScript and the Fastify framework for backend code
- Write functional React components with hooks if UI code is added
- Keep components small and focused with proper prop typing
- Follow existing file naming and code style conventions

## Pull Requests

1. Include a clear description of the change
2. Reference related issues
3. Ensure all tests pass
4. Include screenshots for UI changes
5. Keep PRs focused on a single concern

## Programmatic Checks

From `src/fastify-api` run the following before submitting changes:

```bash
npm run lint       # Lint check
npm run type-check # TypeScript type checking
npm run build      # Build verification
```

Run tests with:

```bash
npm test                      # run all tests
npm test -- path/to/test.ts   # run a specific test file
npm test -- --coverage        # run tests with coverage
```
