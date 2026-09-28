# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Floreren house style

- **Titles** lead with an emoji: `🐛 …` for bugs, `✨ …` for features/enhancements.
- **New issues** default to `bug,needs-triage` (or `enhancement,needs-triage`); triage
  later adds a `difficulty: …` label and `ready` or `needs-plan` (see `triage-labels.md`).
- **Auto-close on merge:** put `Closes #<n>` in the PR body — don't close manually.
- **Don't start** `needs-triage` / `needs-info` issues; work `ready` / `needs-plan` issues
  that aren't already `in-progress`.

## Plans vs issues — how `to-prd` / `to-issues` behave here

- A **full, multi-phase plan** lives as a markdown file in `.hermes/plans/` and gets
  **one umbrella tracking issue** linking to it, with a checklist mirroring its phases.
  The plan file is the source of truth; the issue is how the work is claimed and merged.
- Smaller specs and design docs live in `docs/plans/`.
- `to-issues` should **keep a coupled epic as a single issue** (one agent owns it end to
  end) and only fan out into separate issues when the slices are genuinely independent —
  different files, no ordering. See `how-we-work.md` §3.
