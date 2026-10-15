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

## Workers AI inference

Both Workers have an `AI` binding in local, staging, and production configurations.
The shared `@demo/ai` package provides `runAgentOne(env, input)` and
`runAgentTwo(env, input)`. Both accept a text prompt, optional system instructions,
and optional JPEG/PNG images as `Uint8Array` bytes. Images are sent as base64 data
URLs to the vision model. Responses are returned directly, without streaming or
business-specific parsing; inference errors propagate to the caller.

Each Worker and environment defines `AGENT_ONE_MODEL` and `AGENT_TWO_MODEL`, both
initially set to `@cf/meta/llama-4-scout-17b-16e-instruct`. Edit the corresponding
Wrangler `vars` to change either independently. Replacement models must support
the same message format and vision when images are supplied.

For a future Nuxt server route, use the existing server-only bindings utility:

```ts
import { runAgentOne } from '@demo/ai';
import { bindings } from '../utils/bindings';

export default defineEventHandler(event => runAgentOne(bindings(event), {
    prompt: 'Explain what information appears on a prescription receipt.',
    systemInstructions: 'Answer concisely.'
}));
```

For a future Workflow step, obtain image bytes from your document source before
calling the helper inside `step.do`:

```ts
import { runAgentTwo } from '@demo/ai';

// Inside a Workflow's run method, with imageBytes loaded by your application:
const result = await step.do('analyze image', () => runAgentTwo(this.env, {
    prompt: 'Describe the visible text and details in this image.',
    images: [{ bytes: imageBytes, mimeType: 'image/jpeg' }]
}));
```

These examples are not installed routes or changes to the existing record
Workflow. The helpers are server-only scaffolding; uploads, image storage, PDF
processing, and business prompts are left for later.

Workers AI inference runs remotely even during local development. Authenticate
with `pnpm exec wrangler login` or the account/token environment variables described
below before running `pnpm dev`. Inference consumes Cloudflare account usage;
the helpers are not called automatically. See [local binding behavior](https://developers.cloudflare.com/workers/local-development/)
and [the default vision model](https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/).

For manual live verification, invoke each helper with text only, a JPEG, and a PNG
and confirm a non-streaming model response. Also confirm provider failures reach
the caller and changing one model variable leaves the other handler's selection
unchanged. No new automated tests or runtime validations are included.

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

## Session jobs

The execution page submits multipart POST `/api/sessions/:uuid/jobs`. The server
creates the job UUID. Send an `inputs` part containing JSON scalar values keyed
by workflow input ID, plus file parts named after their workflow input IDs.
Each POST creates a new job; requests are not automatically retried.

Jobs preserve the workflow snapshot and input values from submission time.
Files are stored privately in R2; job inputs contain their object keys, original
filenames, content types, and sizes. Editing a session workflow does not update
existing jobs. GET `/api/sessions/:uuid/jobs` lists newest jobs first; GET
`/api/sessions/:uuid/jobs/:jobId` returns the snapshot, inputs, and step progress.
Both endpoints are scoped to the session UUID.

`SessionWorkflow` prepares each job using durable steps and initializes pending
progress rows. A prepared job is `ready`; extract, reason, and API execution are
not implemented yet. The execution page shows history, saved details, and polls
active jobs every two seconds. A dispatch failure preserves the failed job and
uploads and returns its ID in the error's `data.jobId` field. Submitting again
creates another job.

Local R2 uses the existing shared Wrangler persistence directory. Before remote
deployment, create `demo-job-uploads-staging` and
`demo-job-uploads-production` with `pnpm exec wrangler r2 bucket create <name>`.
Both Workers must use the same bucket within each environment. If you choose
other bucket names, update both Wrangler configurations. Apply the new D1
migration before deploying jobs and then web using the existing release flow.
No file download or retry endpoint is included.
