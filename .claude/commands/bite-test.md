---
description: Prove a test can fail (rule 9). Break the logic on purpose, show the test fails, then revert.
argument-hint: <test file or behaviour to check>
allowed-tools: Bash(git diff *)
---

Target: $ARGUMENTS

1. Identify the test(s) and the production code they cover. Show me both briefly.
2. Choose the **smallest realistic logic mutation** in the production code that these tests should catch: flip a condition, drop a branch, change a boundary, return the wrong value. Tell me what you'll change before you change it.
3. Apply it with Edit. Then run only that test file: `pnpm vitest run <file>`.
4. **Revert the exact change with Edit.** Never use `git checkout` or `git restore` for this, because they would throw away other uncommitted work. Check with `git diff <file>` that only the intended changes remain, then rerun the test file and confirm it passes.
5. Report:
   - the mutation
   - which assertion failed, with its message
   - that the revert is confirmed and the tests are green again
6. If the tests **still pass** with the mutation in place, the test is weak. Revert anyway, say so plainly, and propose a stronger assertion. Never leave a mutation in the code.
