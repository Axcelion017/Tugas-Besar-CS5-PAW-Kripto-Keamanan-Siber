<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Migrated Hermes Memory

Next.js 16 + React 19 environment strictly enforces React Compiler rules: avoid Date.now()/Math.random() in component body (move helpers outside component scope); avoid synchronous setState in useEffect (defer client storage reads with setTimeout(..., 0) to avoid hydration mismatch and react-hooks/set-state-in-effect). When expanding mock schemas, always merge localStorage data with default records and use optional chaining (?.) because user browsers retain stale objects missing new fields.

In JagaMedis (Next.js App Router), avoid middleware URL rewrites for in-dashboard dynamic route 404s because they break RSC flight streaming and eject users from the dashboard layout; use in-page not-found states with components/ui/Skeleton.tsx, loading.tsx, and error.tsx boundaries.

Zod v4 enforces clean single-argument parameter objects: pass `{ message: "..." }` uniformly across primitives (`z.string({ message: ... })`, `z.number({ message: ... })`, `z.enum([...], { message: ... })`); do not use Zod v3 `required_error`, `invalid_type_error`, or `errorMap` which cause TypeScript overload errors (TS2769 / TS2353). In JagaMedis, database modeling strictly separates searchable metadata (ICD-10, timestamps, IDs) from client-side encrypted payloads (`encrypted_payload`, `iv_hex`, `hmac_digest`).

Zod v4 in Next.js 16/TypeScript requires uniform `{ message: "..." }` across string/number/enum schemas; Zod v3 `{ required_error }`, `{ invalid_type_error }`, and enum `{ errorMap }` cause TS2769 overload errors. In Server Actions, parse FormData checkboxes as `val === "true" || val === "on"` and call `redirect()` outside try/catch blocks because it throws an internal NEXT_REDIRECT error.

In Zod v4, use `{ message: "..." }` uniformly across primitives and `z.enum`; deprecated v3 `{ required_error }` and `errorMap` cause TypeScript TS2769 overload errors. Shared server state (e.g. session store) must live in separate non-action files (e.g. `lib/auth/sessionStore.ts`) rather than `"use server"` files so both Server Actions and Route Handlers can import without compiler errors.