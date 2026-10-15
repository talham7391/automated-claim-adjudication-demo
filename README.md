# Nuxt + Cloudflare Workflows + shared D1

A TypeScript pnpm workspace with Nuxt SSR and Nitro APIs in `apps/web`, durable Workflows in `apps/jobs`, Drizzle schema/queries/migrations in `packages/db`, and Zod contracts in `packages/contracts`.

## Local use

Requires Node 22.13+ and pnpm 10.

```sh
pnpm install
pnpm config:check
pnpm typecheck
pnpm test
pnpm dev
# In another terminal:
pnpm test:integration
```

`pnpm dev` builds Nuxt, applies migrations, then starts both Workers in one Wrangler process. Open http://localhost:8787. Both Workers and the migration command use the root `.wrangler/shared` persistence directory. This is a production-build local preview; rebuild/restart after edits. Do not run independent Wrangler processes with different persistence directories.

POST `/api/records` with `{ "id": "<UUID>", "title": "Example" }` creates a pending record and starts a workflow. GET `/api/records/:id` reads it. The workflow reads it, then atomically transitions pending to completed and increments `effectCount`. Repeating that query has no additional effect. Retrying POST with the same ID/title reuses the workflow instance; a different title for the same ID is rejected. If workflow creation fails after insertion, retry the same POST. The SSR home page lists records; use Refresh status after creating one.

## Environments and deployment

The checked-in IDs are **local placeholders**, not provisioned Cloudflare databases. Local emulation works with these IDs. Remote commands reject placeholders.

1. Authenticate using `pnpm exec wrangler login` (or supply `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`).
2. Create databases with `pnpm exec wrangler d1 create demo-staging` and `pnpm exec wrangler d1 create demo-production`.
3. Set each real ID in **both** `apps/web/wrangler.json` and `apps/jobs/wrangler.json` under the corresponding environment. Staging and production must use distinct IDs.
4. Run `pnpm config:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
5. Run `pnpm deploy:staging`. This builds web, checks bindings, applies migrations once, deploys jobs, then deploys web. Production uses `pnpm deploy:production` with the same ordering.
6. Run `TEST_BASE_URL=https://<staging-web-worker> pnpm test:integration` to verify deployed cross-Worker access and SSR.

Standalone migration commands are `pnpm db:migrate:local`, `pnpm db:migrate:staging`, and `pnpm db:migrate:production`. Use backward-compatible schema changes so the previously deployed web Worker continues to work while jobs deploys.

`pnpm bindings` generates each Worker's binding types from Wrangler configuration; type checking consumes those types. `pnpm db:generate` generates future SQL migrations from the Drizzle schema. The initial SQL migration and its snapshot baseline are checked in. Review generated SQL before applying it.

## Verification status

Configuration checks pass for all three environments. Remote placeholder rejection is tested. Full dependency installation, builds, generated binding types, shared-query tests, Wrangler emulation, and staging integration require dependency/network access and (for staging) an authenticated account and real database IDs. They have not been verified in the authoring sandbox because npm registry DNS resolution was blocked.

The integration test creates a unique record, waits for workflow completion, checks `effectCount = 1`, retries POST, checks there is one record, and verifies SSR output. The shared-query test executes the actual Drizzle query functions against a SQLite-backed D1 adapter and repeats the effect operation. Neither test claims to simulate a Cloudflare crash/retry; staging confirms the deployed cross-Worker binding.

This demo has no authentication. Avoid storing private data in a public deployment.

References: [multi-Worker local development](https://developers.cloudflare.com/workers/local-development/multi-workers/), [Workflow bindings](https://developers.cloudflare.com/workflows/build/workers-api/), [Nitro Cloudflare preset](https://nitro.build/deploy/providers/cloudflare).
