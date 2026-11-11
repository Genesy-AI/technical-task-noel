# CLAUDE.md — TinyEnginy

TinyEnginy is a take-home that mirrors Enginy's B2B sales platform: a leads table, CSV import, email verification, enrichment and templated outreach messages. The tasks and provider specs are in [README.md](README.md). Treat this as production code: small, reviewable diffs, with every trade-off stated.

## Stack and layout

- `backend/`: Express 5 (port 4000), Prisma with SQLite (`prisma/dev.db`), and Temporal.
  - All routes live in `src/index.ts`.
  - The Temporal worker (`src/worker.ts`, task queue `myQueue`) runs inside the API process.
  - Temporal workflows are in `src/workflows/workflows.ts`; activities are in `src/workflows/activities/`.
  - Message templating is in `src/utils/messageGenerator.ts`.
- `frontend/`: React 18, Vite, Tailwind 4, TanStack Query and axios.
  - Components are in `src/components/`.
  - API endpoints are in `src/api/modules/leads.ts`, with one type file per endpoint in `src/api/types/leads/<endpoint>.ts`.
  - The CSV parser is in `src/utils/csvParser.ts`.
- `docs/`: sample CSVs and UI wireframes.
- Temporal runs on `localhost:7233` (start it with `temporal server start-dev`). Node version comes from `.nvmrc` (v22), so run `nvm use` in each package.

## Rules

1. **State assumptions before every task.** Before editing, list your assumptions, the files you plan to touch, and how you'll verify the change. Don't guess at requirements, provider behaviour or UX. Ask instead.
2. **Write the minimum code.** No speculative abstractions, no extra config, no "future-proofing" the task doesn't need. There are two exceptions, because the README requires them:
   - the provider adapter layer for phone enrichment
   - a scalable list of fields for message composition
3. **Scope is `backend/src/**` and `frontend/src/**`.** Anything else needs my explicit approval first. That includes `package.json` and lockfiles, `prisma/schema.prisma` and migrations, `prisma/dev.db`, configs, `docs/`, `README.md` and `.claude/` (except `.claude/handoff.md`, see rule 6). When you ask, say why.
4. **Don't stop until the gate passes.** The gate is defined in the Commands section below. If you can't make it pass, say so and include the failing output.
5. **Use the model only for judgment calls.** Anything deterministic belongs in code: parsing, validation, provider order, retries, field lists. Never hand-edit generated output or data that a script or test could produce.
6. **One session per task. Keep the context clean.** Start a fresh session (`/clear`) for each README task or other unrelated piece of work. Within a task, use `/compact <focus>` rather than letting auto-compact pick what to keep. Also start fresh when you've reversed course more than once or are going in circles. Before clearing or compacting, write a handoff note to `.claude/handoff.md` covering what's done, what's open, gate status and flagged issues (rule 12), then start the next session from that note. The handoff file is committed as a record of the process, so keep it accurate and readable by reviewers.
7. **Stop and ask when the codebase conflicts with itself.** Don't pick a side yourself. Describe the conflict with file references and options, then wait for my decision. Known conflicts so far:
   - The frontend's `update` calls `PUT /leads/:id`, but the backend exposes `PATCH`, which also maps `name` to `firstName`.
   - `backend/.env.sample` uses MySQL, but the app uses SQLite.
   - The country-code handling in the CSV import isn't specified anywhere.
8. **Read all callers and exports before adding a helper.** Search both packages for an existing equivalent first (`grep -rn` in `backend/src` and `frontend/src`). Shared shapes such as the lead fields are defined in several places: the Prisma model, `messageGenerator.ts`'s `Lead`, `csvParser.ts`'s `CsvLead`, and `frontend/src/api/types/leads/*`. Update all of them together.
9. **Every new test needs at least one case that fails on a logic change.** No tests that only snapshot or check that something renders. Before you call a test done, temporarily break the logic and confirm the test fails.
10. **Run the gate after each significant step:** a schema change, a new route or workflow, a component change. Running it only at the end isn't enough.
11. **Follow existing conventions:**
    - **Prettier:** no semicolons, single quotes, `trailingComma: es5`, 2-space indent, 110-column lines.
    - **Backend routes:** validate `req.body` first and return `400` with `{ error }`. Wrap the work in `try/catch` that returns `500` with `{ error }`. Batch endpoints return `{ success, <count>, errors: [{ leadId, leadName, error }] }`.
    - **Temporal:** call activities through `proxyActivities` with an explicit `startToCloseTimeout` and `retry` policy. Workflow IDs must be deterministic per lead (for example `enrich-phone-${leadId}`) to keep runs idempotent.
    - **Frontend API:** add the endpoint to `leadsApi` using `endpoint<Output, Input>(method, path)`. Put its types in `src/api/types/leads/<endpoint>.ts` as `Leads<Endpoint>Input` and `Leads<Endpoint>Output`, and call mutations through `useApiMutation`.
    - **Components:** functional React with Tailwind classes, named exports (`export const X`), and `react-hot-toast` for user feedback.
    - **Tests:** Vitest, with `describe` and `it('should …')` placed next to the code as `*.test.ts`. The backend runs in a `node` environment and the frontend in `jsdom`.
12. **Flag, don't skip.** Report every uncertainty, skipped record, dropped CSV row, failed provider call, unhandled edge case or deferred item in your reply. Add it to the running list for `IMPROVEMENTS.md`. Never silently swallow an error or work around it.

## Commands

The gate must be green before you stop (rule 4) and after each significant step (rule 10):

```zsh
# backend
cd backend && pnpm typecheck && pnpm vitest run
# frontend
cd frontend && pnpm lint && pnpm build && pnpm vitest run
```

Other commands:

- **Dev:** `temporal server start-dev`; then `pnpm run dev` in `backend/` and again in `frontend/`.
- **Prisma:** after a schema change (needs approval, see rule 3), run `pnpm migrate:dev`, then `pnpm gen:prisma`.
- **Watch mode:** `pnpm test` starts Vitest in watch mode. Agents must use `pnpm vitest run`.

## Git

- Work on a feature branch, never on `main`. Use one branch or commit per README task so reviewers can follow each piece.
- Commit only when I ask.
