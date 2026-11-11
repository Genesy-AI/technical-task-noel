# Improvements

## Tooling

- **Frontend lint config was dead on arrival.** The initial commit shipped `.eslintrc.cjs` with ESLint 9, which only reads `eslint.config.js`, so `pnpm lint` never ran. Migrated to the new config format with the same rules (branch `chore/setup`).
- **Frontend lint: 24 `no-explicit-any` errors in existing code**, now visible since lint runs: `src/api/mutations/useApiMutation.ts` (14), `src/api/utils.ts` (6), `src/globalTypes.d.ts` (3, the `$TSFixMe` aliases), `src/api/types/leads/bulkImport.ts` (1). Fixed on the same branch: unused `$TSFixMe` aliases deleted, function constraints use `never[]`/`unknown`, mutation types inferred in one conditional, bulk-import `errors[].lead` typed as the input lead. Backend `index.ts:220` still types that field as `any` (backend is not linted).
- **Frontend build fails on existing code:** `src/api/mutations/useApiMutation.ts:64` builds a lead without `emailVerified`, which the lead type requires. Fixed: the placeholder lead now sets `emailVerified: null`. This only affects lead creation; it is not the cause of the README "email verification stalls" bug.

- **`backend/prisma/dev.db` is committed, and it is the only copy of the sample data.** Every local run of the app changes the file (e.g. verify-emails writes `emailVerified`). It is binary, so its diffs can't be reviewed and two branches that both run the app will conflict on it. There's no seed script, and the migrations create tables but no rows, so untracking it today would leave a fresh clone with an empty leads table. Proposal:
  - add `prisma/seed.ts`, generated from the current rows by a script, not typed by hand
  - register it as `prisma.seed` in `package.json`
  - add `prisma/*.db` to `.gitignore` and `git rm --cached` the file
  - update the README setup steps

  The T1 commit includes `dev.db` with the verification results from testing (decided).

## Email verification (T1, branch `fix/t1-email-verification-hangs`)

**Root cause.** `verifyEmail` had `startToCloseTimeout: '1 second'` and no retry policy. Temporal's default policy retries forever, so a slow verifier (the `jane.smith` stub sleeps 20s) timed out and retried with no end. The route `await`ed each workflow in turn, so one stuck lead blocked the whole request.

**Fixed:**
- Activity timeout is 5s with `retry: { maximumAttempts: 3, initialInterval: 1s, backoffCoefficient: 2 }`. The worst case per lead is about 18s. A lead that can't be verified is reported in `errors` instead of hanging.
- `workflowExecutionTimeout: '30 seconds'` on each run, so the request can't hang even when no worker picks the workflow up (e.g. the worker crashed, or a stale process is polling).
- Leads are verified in parallel, so a request takes as long as its slowest lead, not the sum.
- **Decision A:** the workflow ID is now deterministic, `verify-email-${lead.id}`. It used to append `Date.now()`, which broke the idempotency convention.
- The Temporal connection is closed in `finally`.
- The per-lead logic moved from the route to `utils/verifyLeadEmails.ts`, which receives the Temporal and Prisma calls as arguments so it can be unit-tested.
- **Every error is reported.** If saving the result fails after a verification error, both errors are returned for that lead (one `errors` entry each) and both are logged. Before, the save error replaced the verification error.
- **Unknown lead IDs are reported** as `Lead not found` in `errors`. Before, they were dropped without any record.
- **Response counts:** `verifiedCount` is now the number of emails confirmed valid. The new `failedCount` covers every other requested lead: invalid email, check failed, already in progress, or not found. Before, `verifiedCount` also counted invalid emails, so "Verified 2 emails" could include a ❌.
- Error text is generic: `Email verification failed`. `WorkflowFailedError` also covers workflow timeouts and cancellation, so "after 3 attempts" wasn't always true.
- The UI shows "Verifying…" and disables the button while the request runs. Toasts say "N emails verified" and "N emails failed verification", followed by the reason for each lead that couldn't be checked. Before, there was only a success toast, even when everything failed.
- **Decision C:** `workflows/activities/utils.ts` and the two workflow barrel files are now formatted with Prettier.
- Added `@temporalio/testing` (devDependency, approved). The workflow test runs on the time-skipping test server and fails if the retry policy is removed. The helper tests fail if the "already in progress" guard or the valid-only count is broken. Both were checked by breaking the logic on purpose.

**Open / deferred:**
- **Decision B, mutation hooks:** `LeadsList`, `MessageTemplateModal` and `CsvImportModal` call raw `useMutation`, but the convention is `useApiMutation`. `apiMutationsOptions` only defines `leads.create`. Move every mutation over in one pass rather than piecemeal.
- **The request is still synchronous.** `POST /leads/verify-emails` holds the HTTP request until every workflow finishes, about 18s when a verifier is slow. Larger batches risk proxy or browser timeouts, and the user can't see results as each lead finishes.
  - **Proposal:** the endpoint only starts the workflows (`client.workflow.start` with the deterministic IDs) and returns `202 { started, errors }` at once. `errors` covers leads already in progress or failing to start. The worker writes each result to the lead and pushes a per-lead event (`{ leadId, status: 'verified' | 'invalid' | 'failed', error? }`) to the frontend over a WebSocket. The frontend updates that row in the leads query cache.
  - **Trade-offs:** a WebSocket adds a server (e.g. `ws` or `socket.io`) and a reconnect strategy. It is worth it if enrichment workflows (e.g. phone, T4) use the same channel. Server-Sent Events would be simpler for one-way push, and polling `GET /leads` while any lead is pending needs no new infrastructure. The worker runs inside the API process today, so it can emit to sockets directly. That stops working once the worker is split out (see "Orphaned dev servers" below), and a pub/sub layer would be needed then.
  - **Depends on** a stored per-lead verification status (see the `emailVerified` bullet), so the UI can show "pending" after a reload and doesn't rely only on the socket.
- **No concurrency limit.** N leads start N workflows at once. Cap it (e.g. `p-limit`) before batches grow, and before the verifier gets a rate limit.
- **Nothing records when verification last ran.** Seen in the UI: Jane Smith's verification failed, but the row still showed ✅ from an earlier run, and nothing said when that run happened. The schema has only `emailVerified Boolean?`. `updatedAt` changes on any edit, and Temporal history is deleted after 24h (namespace retention).
  - **Decided for T1:** `emailVerified` is the latest outcome, so a failed verification (verifier errored or timed out after 3 attempts) now sets it to `false` (❌). The error toast says why. A request that hits "already in progress" leaves the value alone.
  - **Trade-off:** ❌ now means either "invalid email" or "we couldn't check". The table can't tell them apart until we store more.
  - **Next:** add a `last_verified_at` datetime column (Prisma `lastVerifiedAt DateTime?`). Set it on every completed verification, success or failure, and show it in the table next to the icon, e.g. as a tooltip or "verified 2h ago". This needs a schema change, a migration, and updates in every place the lead shape is defined. Later, a `verificationStatus` (`pending | verified | invalid | failed`) would separate "invalid" from "couldn't check" and support the async/WebSocket flow.
- **The progress indicator can be hidden.** "Verifying…" appears only inside the Enrich dropdown, and the Enrich toggle closes the dropdown while the ~18s request runs. The user then sees nothing until the toasts arrive. Proposal: show a `toast.loading` that the result toasts replace, or a pending state on the Enrich button itself.
- **`leadIds` aren't validated as integers.** `Number('abc')` gives `NaN`, which is reported as `Lead not found` with `leadId: null` in the JSON. Proposal: return `400` unless every ID is a positive integer, as the route convention says (validate `req.body` first).
- **"Already in progress" counts toward `failedCount`.** The lead wasn't checked by this request, and its row doesn't change. That's accurate for "not verified by this request", but the toast can say "failed" for a lead whose earlier run then succeeds. The async/status work below would replace this with a `pending` state.
- **The activity ignores cancellation.** After a timeout the stub keeps sleeping on the worker, because it doesn't heartbeat or watch `Context.current().cancelled`. A real verifier client should pass an `AbortSignal`.
- **A new Temporal `Connection` is opened per request.** Create one client at startup and reuse it.
- **Worker test speed:** the timeout case uses the real clock (~17s), because time-skipping doesn't skip time while an activity is running.
- **Orphaned dev servers:** the Temporal worker runs inside the API process and nothing stops it on `SIGTERM`/`SIGUSR2`. After a nodemon restart, an older process can keep port 4000 (with stale route code) while the new process's worker also polls `myQueue`. Add a signal handler that calls `worker.shutdown()` and `server.close()`, or run the worker as a separate process.
