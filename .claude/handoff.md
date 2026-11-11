## T1 Email verification hangs (2026-11-11)
**Status:** done
**Branch:** fix/t1-email-verification-hangs

**Done:**
- **Root cause:** `verifyEmail` had a 1s `startToCloseTimeout` and no retry policy. Temporal's default retries forever, so the `jane.smith` stub (sleeps 20s) never finished. The route ran leads one at a time, so one stuck lead blocked the whole request.
- **Activity:** 5s timeout, 3 attempts with backoff of 1s doubling (worst case about 18s per lead).
- **Workflow:** `workflowExecutionTimeout: '30 seconds'`, so the request is bounded even if no worker picks the workflow up.
- **Route:** leads run in parallel with a deterministic workflow ID `verify-email-${lead.id}`, and the connection is closed in `finally`. The per-lead logic moved to `backend/src/utils/verifyLeadEmails.ts`, which takes the Temporal and Prisma calls as arguments so it can be unit-tested.
- **Response:**
  - `verifiedCount` counts emails confirmed valid. The new `failedCount` covers every other requested lead.
  - Every error is reported: a failed save after a failed check gives two entries.
  - Unknown IDs are reported as `Lead not found`.
  - The error text is generic: `Email verification failed`.
- **UI:** the button shows "Verifying…" and is disabled while the request runs. Toasts show "N emails verified" and "N emails failed verification", followed by the reason for each lead that couldn't be checked.
- **Tests:**
  - A workflow test on `@temporalio/testing` (new devDependency, approved) fails if the retry policy is removed.
  - Six helper tests cover each outcome, the double-error case, unknown IDs and the counts.
  - Each test was confirmed to fail when its logic was broken on purpose.
- **Formatting:** Prettier on `workflows/activities/utils.ts` and the two workflow barrel files.

**Decisions & trade-offs:**
- **Deterministic workflow ID:** the old `Date.now()` suffix broke the idempotency convention. A second request while a run is going returns "Verification already in progress".
- **Kept raw `useMutation`** in `LeadsList`, matching the other components. Moving to `useApiMutation` is deferred.
- **A failed check sets `emailVerified = false`:** the value means the latest outcome, so ❌ can now mean "invalid" or "couldn't check". "Already in progress" leaves the row unchanged.
- **The endpoint is still synchronous** (about 18s worst case). The async + WebSocket design is written up in IMPROVEMENTS.md.
- **`backend/prisma/dev.db` is committed** with verification results from testing (leads 1–6), by decision. There's no seed script yet.

**Open:** none for T1. Deferred items are in IMPROVEMENTS.md.

**Gate:** backend ✅ (32 tests) · frontend ✅ (19 tests)

**Flags → IMPROVEMENTS candidates** (all recorded in IMPROVEMENTS.md):
- **Synchronous endpoint:** the request is held up to ~18s, risking timeouts and showing no per-lead progress. Proposal: return `202`, push per-lead results over a WebSocket, and store a status.
- **No `last_verified_at`:** ❌ doesn't say when it was checked or whether the check ran at all. Proposal: a `lastVerifiedAt` column, and later a `verificationStatus`.
- **Unbounded parallelism:** N leads start N workflows, which will break once the verifier adds rate limits. Proposal: cap concurrency.
- **Activity ignores cancellation:** timed-out attempts keep running and use worker slots. Proposal: heartbeat, or pass an `AbortSignal` to a real client.
- **Orphaned dev servers:**
  - Every nodemon restart left an orphan holding :4000 with stale code; it happened four times this session.
  - The cause is that nodemon stops only the `sh -c` wrapper, while the `node` child survives with the in-process worker.
  - Proposal: signal handlers that call `worker.shutdown()` and `server.close()`, or a separate worker process.
- **Hidden progress indicator:** the Enrich toggle can close the dropdown that shows "Verifying…", leaving no feedback. Proposal: `toast.loading`, or a pending state on the Enrich button.
- **`leadIds` not validated:** non-numeric IDs come back as `Lead not found` with `leadId: null`. Proposal: return `400` unless every ID is a positive integer.
- **"Already in progress" counts as failed:** the toast can say "failed" for a lead whose earlier run then succeeds. Proposal: a `pending` status from the async work.
- **New Temporal `Connection` per request:** adds latency and opens a socket each time. Proposal: one client created at startup.
- **Slow gate:** the workflow test adds ~21s and downloads a test server on first run. Proposal: cache the binary in CI, and move the slow case to an integration run if needed.
- **`dev.db` in git:** a binary that every run changes, and the only copy of the sample data. Proposal: a generated seed script, then ignore `*.db`.
- **Mutation hooks:** all components use raw `useMutation`. Proposal: move them all to `useApiMutation` in one pass.

**Next session:** start the next README task with `/task-start`. Kill any orphaned `ts-node ./src/index.ts` on :4000 before testing (`ss -ltnp | grep :4000`).
