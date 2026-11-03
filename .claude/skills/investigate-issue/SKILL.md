---
name: investigate-issue
description: Start work on a V2 GitHub issue. Reads the issue, its comments, dependencies and linked docs, checks the live repository and board state, searches for existing code to reuse, and produces a short plan with risks and PO questions before any edit. Use at the start of every issue, or when the user says "go", "start #N" or "resume #N".
argument-hint: "<issue number>"
model: sonnet
---

# Investigate issue #$ARGUMENTS

Produce a plan for issue #$ARGUMENTS. **Don't edit any file in this step.** The rules behind each step are in AGENTS.md and CLAUDE.md.

## 1. Read the issue completely

Run every `gh` command for this repository with the agent's token, `GH_TOKEN="$(gh auth token -u velocity-claude-agent)"`.

- `gh issue view $ARGUMENTS --comments`: the scope, non-goals, acceptance criteria, testing level and documentation impact. **The comments often record PO decisions that change the scope.**
- **Dependencies:** check each blocking issue is closed (`gh issue view <N> --json state`). If one is still open, stop and report which.
- **Linked documents:** read only the documents and sections the issue or its comments name. Open `docs/ARCHITECTURE.md`, an ADR in `docs/decisions/` or the research report only when the plan depends on it.
- **Decision issues it depends on**, such as #33 and #38: if one is undecided, the dependent parts stay *pending*. Never decide them yourself.

## 2. Check the live state

- `git status`, the current branch, and `git fetch -q origin && git log --oneline -1 origin/main`. The work must start from the latest `main`, with a clean tree.
- **Open pull requests:** `gh pr list`. Look for one that already covers this issue or touches the same files.
- **Board:** only this issue's item, not the whole board: `gh project item-list 4 --owner Singlbase-Technologies-Limited --format json --limit 400 --jq '.items[]|select(.content.number==$ARGUMENTS)|{id,status}'`. No output means it isn't on the organisation's board yet, so add it. Take the Status field and option ids from `gh project field-list 4 --owner Singlbase-Technologies-Limited --format json --jq '.fields[]|select(.name=="Status")'`; never hard-code them from memory.

## 3. Find what already exists

Search before planning anything new (AGENTS.md, "Reuse before you add"):

- **Code:** grep for the domain words in the issue, using the [glossary](../../../docs/GLOSSARY.md) terms, across `crates/`, `src-tauri/`, `src/` and `scripts/`.
- **Read only what the search points to:** the files it finds, and only the parts you need.
- **V1, only when the issue names V1 behaviour:** `C:\projects\velocity-download-manager` at `e9d717a8`, for reference only, never modified. Read it to understand behaviour; don't copy aria2-specific code.

## 4. Write the plan

Keep it short. Give it to the user before editing whenever the work touches several files or the architecture:

1. **Goal:** one sentence, in the issue's terms.
2. **Steps:** each with the files it touches, and the test written first for each meaningful behaviour.
3. **Reuse:** what existing code or patterns the change builds on, and any new pattern with the reason for it.
4. **Verification:** the level the issue names, and the commands that prove each acceptance criterion.
5. **Docs to update** in the same PR.
6. **Risks and PO questions:** anything that needs a PO decision on scope, architecture, dependencies, licensing, security, settings, merges or releases. Ask with multiple-choice questions in plain words, recommended option first.

Then create the branch `<type>/$ARGUMENTS-<slug>` from the latest `main` and set the board item to *In progress*.
