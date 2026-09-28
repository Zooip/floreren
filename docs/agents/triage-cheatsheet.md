# Triage cheat sheet

Triage turns a raw report into buildable work, or rejects it. It's done by Leon, or
by an agent he asks. Labels are in `triage-labels.md`.

1. **Read** the issue (it arrives as `needs-triage`).
2. **Unclear?** Label it `needs-info` and ask your question in a comment.
3. **Not worth doing?** Label it `wontfix` and close it.
4. **Otherwise:** set `difficulty: easy | medium | hard`, remove `needs-triage` and
   add one of these:
   - `ready`: clear enough that an agent can start coding
   - `needs-plan`: real, but the shape still needs deciding; the agent scopes it first

```bash
gh issue list --label "needs-triage" --state open
gh issue view <n> --comments
gh issue edit <n> --add-label "difficulty: medium,ready" --remove-label "needs-triage"
gh issue edit <n> --add-label "difficulty: hard,needs-plan" --remove-label "needs-triage"
gh issue edit <n> --add-label "needs-info" && gh issue comment <n> --body "Which map and zoom level?"
gh issue close <n> --comment "Out of scope for now." && gh issue edit <n> --add-label "wontfix"
```

After triage, Leon is out of the loop. An agent claims the issue, opens a PR, and a
green PR auto-merges and deploys (`how-we-work.md` §1). Triage is therefore the one
place to say "ask me before shipping this": write it in the issue.
