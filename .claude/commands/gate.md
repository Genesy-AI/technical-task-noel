---
description: Run the quality gate (rules 4 and 10) and report pass or fail.
argument-hint: [backend | frontend | all]. Omit to infer it from the changed files.
allowed-tools: Bash(git status *), Bash(git diff *)
---

Scope requested: $ARGUMENTS

1. If no scope was given, use `git status --short` to work out which packages changed. If both or neither did, run `all`.
2. Check that `node -v` reports v22. If it doesn't, stop and tell me to run `nvm use`. Don't work around it.
3. Run each command on its own (not chained), from inside the package folder:
   - backend: `pnpm typecheck`, then `pnpm vitest run`
   - frontend: `pnpm lint`, then `pnpm build`, then `pnpm vitest run`
4. Report a table with one row per package: each check, ✅ or ❌, and the test count.
5. If anything fails, show only the relevant error output and stop (rule 4). Don't fix anything unless I ask. If it's obvious, say whether the failure was there before this branch or was caused by it.
