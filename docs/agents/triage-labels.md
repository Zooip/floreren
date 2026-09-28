# Triage labels

Maps the canonical triage roles that Matt Pocock's skills speak in to this
repo's label strings. The workflow around them is in `how-we-work.md` §3.

| Skill role | Our label | Meaning |
|---|---|---|
| `needs-triage` | `needs-triage` | Not evaluated yet |
| `needs-info` | `needs-info` | Waiting on Leon or the reporter |
| `ready-for-agent` | `ready` | Specified enough to build; any agent takes it |
| `ready-for-human` | `needs-plan` | Real but underspecified; any agent scopes it first, then builds it |
| `wontfix` | `wontfix` | Will not be done |

When a skill says "apply the AFK-ready label", use `ready`. When it says "route to
a human", use `needs-plan`. No label names an agent type: every agent can plan and
build. The old `ready-for-agent` / `ready-for-human` labels were retired on
2026-09-28.

## Difficulty

| Label | Stars | Meaning |
|---|---|---|
| `difficulty: easy` | ⭐ | Quick, low-risk |
| `difficulty: medium` | ⭐⭐ | Moderate effort |
| `difficulty: hard` | ⭐⭐⭐ | Substantial, tricky or unknown territory |

Set one at triage. The 🐛 bug-report form lets the reporter guess; triage confirms it.

## `in-progress`: the claim

This isn't a triage state. It's a soft lock, because several agents run at once. An
agent adds it (plus a comment naming itself) when it starts, and removes it if it
abandons the work. Skip any issue that has it.
