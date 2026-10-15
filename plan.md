# Prescription claim adjudication prototype

## Start / session page

- [x] Create a persistent anonymous session without login.
- [x] Restore the session's saved state when the visitor returns.

## Workflow builder page

- [x] Accept typed policy text and desired adjudication steps.
- [x] Convert instructions into a saved, reusable workflow schema.
- [ ] Visualize the generated workflow with plain-language step descriptions.
- [x] Support workflow revisions through text.

## Claim submission page

- [ ] Upload one prescription receipt image.
- [ ] Start a run using the saved workflow.

## Run details page

- [ ] Show live execution status and progress for each step.
- [ ] Show extracted receipt data and review findings.
- [ ] Show the final approval, rejection, or needs-review outcome with an explanation.
- [ ] Allow historic runs to be opened with their saved results; manual resolution is out of scope.

## Run history page

- [ ] List the session's past runs and their status or outcome.
- [ ] Link each run to its details page.

## Shared backend and infrastructure

- [ ] Persist sessions, policies, workflow schemas, runs, step progress, and results.
- [ ] Store receipt images for background processing.
- [ ] Execute saved workflows in background jobs that continue independently of the browser.
- [ ] Use AI for receipt OCR and extraction of data needed by subsequent steps.
- [ ] Execute policy review steps, including AI judgment/reasoning where needed.
- [ ] Persist and expose run progress and results to the pages.
- [ ] Configure and deploy the web app, background jobs, storage, and AI services using the existing Nuxt and Cloudflare foundation.

## Polish
- [ ] UI Polish
- [ ] Learn the files in greater detail
- [ ] Security review
- [ ] Favicon/manifest
- [ ] Production deploy
- [ ] Pretty README.md file
