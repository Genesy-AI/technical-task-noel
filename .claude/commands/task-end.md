---
description: Close out a task. Confirm the gate, update the handoff, then propose a focused commit.
argument-hint: [optional notes to include in the handoff]
allowed-tools: Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git branch *)
---

Branch: !`git branch --show-current`
Changed files: !`git status --short`

Extra notes from me: $ARGUMENTS

1. **Gate.** Run the gate for the packages this task touched, as `/gate` does. If it's red, stop here (rule 4).
2. **Handoff (rule 6).** **Append** a section to `.claude/handoff.md`. Never overwrite earlier sections. Reviewers will read this file, so keep it accurate and concise:

   ```
   ## <Task name> (<YYYY-MM-DD>)
   **Status:** done | partial
   **Branch:** <branch>
   **Done:** <bullets: what changed and why>
   **Decisions & trade-offs:** <bullets>
   **Open:** <bullets, or "none">
   **Gate:** backend ✅/❌ (n tests) · frontend ✅/❌ (n tests)
   **Flags → IMPROVEMENTS candidates:** <the bullets from /task-review: problem → impact → proposal>
   **Next session:** <one line on where to start>
   ```

3. **Commit.** Propose one focused commit that includes the handoff update:
   - the list of files to stage (name each file; never `git add -A`)
   - a message in `type(scope): summary` form, with a short body explaining *why* and the main trade-off

   Wait for my approval before running `git add` or `git commit`.
4. After committing, remind me to run `/clear` and start the next task with `/task-start`.
