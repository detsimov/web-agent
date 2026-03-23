# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — lint with Biome (`biome check`)
- `npm run format` — auto-format with Biome (`biome format --write`)

No test runner is configured yet.

## Architecture

Next.js 16 app (App Router) with React 19, TypeScript, Tailwind CSS v4, and React Compiler enabled. Uses Biome for linting/formatting (not ESLint/Prettier).

**LLM chat proxy** — the core feature is a server-side chat API that proxies requests through OpenRouter:

- `src/app/api/chat/route.ts` — POST endpoint. Validates requests with Zod, delegates to `chat()`, returns completions. Error responses use `AppError`.
- `src/lib/chat.ts` — wraps `@openrouter/sdk` to send chat completions and normalize the response into `ChatCompletion`.
- `src/lib/openrouter.ts` — singleton OpenRouter client, configured via `OPEN_ROUTER_API_KEY` env var.
- `src/lib/error/AppError.ts` — error class carrying HTTP status and error code for structured API error responses.

**Path alias:** `@/*` maps to `./src/*`.

**Environment:** requires `OPEN_ROUTER_API_KEY` (see `src/env.d.ts`).