---
description: Start a README task. Load the handoff, propose a branch, state assumptions, map callers and conflicts. Makes no edits.
argument-hint: <task, e.g. "T1 email verification bug">
allowed-tools: Bash(git branch *), Bash(git status *)
---

Current branch: !`git branch --show-current`
Working tree: !`git status --short`

Task: $ARGUMENTS

Follow CLAUDE.md. Do not edit any files in this step.

1. **Context.** Read `CLAUDE.md` and `.claude/handoff.md`. If the handoff file is missing or empty, say so and continue. In at most 3 bullets, list anything from the handoff that affects this task.
2. **Branch.** Propose `fix/<slug>` or `feat/<slug>`. If we're on `main`, ask me to confirm, then create it with `git checkout -b`. If the working tree isn't clean, stop and tell me what is uncommitted.
3. **Assumptions (rule 1).** Give a numbered list so I can challenge each one by number:
   - Assumptions about requirements, behaviour and UX.
   - The files you plan to touch. Mark anything outside `backend/src/**` or `frontend/src/**` as **needs approval (rule 3)**.
   - The verification plan: the gate, a test that can fail on a logic change, and how we'll see it working in the UI or with curl.
4. **Read first (rule 8).** Search both packages for the callers and definitions this task affects. If the lead shape changes, list every place it's defined.
5. **Conflicts (rule 7).** List any places where the codebase contradicts itself, with `file:line` and the options. If there are any, stop and ask me before going further.

End with: "Ready to implement? Challenge any assumption by number."
