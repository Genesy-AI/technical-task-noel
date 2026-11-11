# Improvements

## Tooling

- **Frontend lint config was dead on arrival.** The initial commit shipped `.eslintrc.cjs` with ESLint 9, which only reads `eslint.config.js`, so `pnpm lint` never ran. Migrated to the new config format with the same rules (branch `chore/setup`).
- **Frontend lint: 24 `no-explicit-any` errors in existing code**, now visible since lint runs: `src/api/mutations/useApiMutation.ts` (14), `src/api/utils.ts` (6), `src/globalTypes.d.ts` (3, the `$TSFixMe` aliases), `src/api/types/leads/bulkImport.ts` (1). Fixed on the same branch: unused `$TSFixMe` aliases deleted, function constraints use `never[]`/`unknown`, mutation types inferred in one conditional, bulk-import `errors[].lead` typed as the input lead. Backend `index.ts:220` still types that field as `any` (backend is not linted).
- **Frontend build fails on existing code:** `src/api/mutations/useApiMutation.ts:64` builds a lead without `emailVerified`, which the lead type requires. Fixed: the placeholder lead now sets `emailVerified: null`. This only affects lead creation; it is not the cause of the README "email verification stalls" bug.
