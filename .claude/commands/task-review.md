---
description: Before committing. See it working, review the diff as a sceptical teammate, list the flags. Makes no fixes.
allowed-tools: Bash(git diff *), Bash(git status *)
---

Changed files: !`git diff --stat`
Untracked: !`git status --short`

1. **See it work.** Give me the exact steps to try the change: UI clicks, or `curl` commands against `http://localhost:4000`. If the API is running, run the curl checks yourself and show the responses. Ask me to confirm the UI part on camera.
2. **Review the diff** as a sceptical senior teammate would. Check:
   - correctness and edge cases
   - scope (rule 3): any file outside `backend/src` or `frontend/src`?
   - minimum code (rule 2): anything speculative?
   - conventions (rule 11)
   - lead-shape locations that were missed (rule 8)
   - errors that are silently swallowed (rule 12)

   Label each finding **blocking**, **suggestion** or **nit**, with `file:line`. Don't fix anything yet. I'll decide.
3. **Flags (rule 12).** List the uncertainties, skipped records, deferred work and trade-offs from this task. Phrase each one as a candidate entry for IMPROVEMENTS.md: problem, then impact, then proposal. `/task-end` will record them.
4. Finish with a verdict: **ready to commit** or **fix first**, and the reason.
