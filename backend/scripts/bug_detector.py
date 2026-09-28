"""Bug detector — the DISCOVER stage of the agent loop.

Runs in GitHub Actions (.github/workflows/bug-detector.yml) several times a
day. It does NOT hunt for bugs speculatively; it collects real failure
signals and turns each new one into a GitHub issue:

  1. /health endpoint failing
  2. ERROR lines in recent Fly logs (unhandled exceptions, send failures)
  3. failed GitHub Actions runs on master (deploy, CI, daily digest)

Each finding gets a stable signature embedded in the issue body
(<!-- detector-sig: ... -->) so a recurring error never files a duplicate
while its issue is still open. Issues land as `bug, needs-triage,
auto-detected` — triage routes them to `ready` / `needs-plan` per
docs/agents/how-we-work.md §3.

If NOUS_API_KEY is set, the issue title/summary is polished by the same
LLM config the backend uses (Nous Portal, DeepSeek V4 Flash); without it
the raw evidence is filed as-is. LLM failure never blocks filing.

Pure logic (parsing, signatures, dedup) is unit-tested in
tests/test_bug_detector.py; the side-effectful main() runs only in CI.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.request
from dataclasses import dataclass, field

MAX_ISSUES_PER_RUN = 3  # storm guard: a cascade files a few issues, not fifty
SIG_MARKER = "detector-sig:"
DETECTOR_LABELS = "bug,needs-triage,auto-detected"


@dataclass
class Finding:
    kind: str          # "exception" | "email" | "health" | "workflow"
    detail: str        # one-line description (first error line)
    context: str = ""  # nearby log lines / run url
    count: int = 1


# ── pure logic ───────────────────────────────────────────────────────────

_ERROR_RE = re.compile(r"ERROR[:\s]+(?:floreren[:\s]+)?(.+)")
_FILE_LINE_RE = re.compile(r'File "([^"]+)", line \d+')


def extract_error_signatures(logs: str) -> list[Finding]:
    """Collapse ERROR lines in Fly logs into unique findings with context."""
    findings: dict[str, Finding] = {}
    lines = logs.splitlines()
    for i, line in enumerate(lines):
        m = _ERROR_RE.search(line)
        if not m:
            continue
        detail = m.group(1).strip()
        # Grab the first "File ..." traceback line that follows, if any
        context = ""
        for follow in lines[i + 1 : i + 6]:
            fm = _FILE_LINE_RE.search(follow)
            if fm:
                context = fm.group(1)
                break
        kind = "exception" if "Unhandled exception" in detail else "error"
        key = _normalise(detail)
        if key in findings:
            findings[key].count += 1
        else:
            findings[key] = Finding(kind=kind, detail=detail, context=context)
    return list(findings.values())


def _normalise(text: str) -> str:
    """Strip volatile parts (numbers, hex ids) so recurrences dedupe."""
    text = re.sub(r"\b\d+\b", "N", text)
    text = re.sub(r"\b[0-9a-f]{8,}\b", "H", text)
    return text.lower().strip()


def issue_signature(f: Finding) -> str:
    raw = f"{f.kind}|{_normalise(f.detail)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def filter_new_findings(findings: list[Finding], known_sigs: set[str]) -> list[Finding]:
    return [f for f in findings if issue_signature(f) not in known_sigs]


# ── signal collection (side effects — CI only) ───────────────────────────

def check_health(url: str) -> Finding | None:
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            body = resp.read(500).decode("utf-8", "replace")
            if resp.status == 200 and '"ok"' in body:
                return None
            return Finding(kind="health", detail=f"/health returned {resp.status}: {body}")
    except Exception as e:
        return Finding(kind="health", detail=f"/health unreachable: {e.__class__.__name__}: {e}")


def failed_workflow_findings(repo: str) -> list[Finding]:
    """Workflows on master whose LATEST run (within 24h) failed.

    A failure followed by a successful re-run is stale news and is skipped —
    only a currently-red workflow is a signal.
    """
    from datetime import datetime, timedelta, timezone

    out = _gh(
        "api",
        f"repos/{repo}/actions/runs?branch=master&per_page=40",
        "--jq",
        '[.workflow_runs[] | {name, conclusion, html_url, run_started_at}]',
    )
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    latest_per_workflow: dict[str, dict] = {}
    for run in json.loads(out or "[]"):  # API returns newest first
        latest_per_workflow.setdefault(run["name"], run)

    findings = []
    for name, run in latest_per_workflow.items():
        if run["conclusion"] != "failure":
            continue
        started = datetime.fromisoformat(run["run_started_at"].replace("Z", "+00:00"))
        if started < since:
            continue
        findings.append(
            Finding(
                kind="workflow",
                detail=f"workflow '{name}' is failing on master (latest run)",
                context=run["html_url"],
            )
        )
    return findings


def existing_signatures(repo: str) -> set[str]:
    """Signatures of currently OPEN auto-detected issues."""
    out = _gh(
        "issue", "list", "-R", repo, "--label", "auto-detected", "--state", "open",
        "--json", "body", "--jq", "[.[].body]",
    )
    sigs = set()
    for body in json.loads(out or "[]"):
        m = re.search(re.escape(SIG_MARKER) + r"\s*([0-9a-f]{16})", body or "")
        if m:
            sigs.add(m.group(1))
    return sigs


def _gh(*args: str) -> str:
    res = subprocess.run(["gh", *args], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"gh {' '.join(args[:2])} failed: {res.stderr[:300]}", file=sys.stderr)
        return ""
    return res.stdout


# ── LLM polish (optional, never blocking) ────────────────────────────────

def polish_with_llm(f: Finding) -> tuple[str, str] | None:
    """Ask DeepSeek (via the backend's llm_config provider) for a crisp
    title + short analysis. Returns (title, analysis) or None on any failure."""
    key = os.environ.get("NOUS_API_KEY")
    if not key:
        return None
    url = os.environ.get("LLM_CHAT_URL", "https://inference-api.nousresearch.com/v1/chat/completions")
    model = os.environ.get("LLM_MODEL", "deepseek/deepseek-v4-flash")
    prompt = (
        "You write GitHub bug issues for the Floreren plant-care app "
        "(FastAPI backend on Fly.io, React frontend). Given this production "
        "signal, reply with JSON only: {\"title\": \"<max 90 chars, imperative, "
        "emoji 🐛 prefix>\", \"analysis\": \"<3-5 sentences: what the signal "
        "means, the suspected area of the codebase, and what an agent should "
        "verify first. No fixes, no speculation beyond the evidence.>\"}\n\n"
        f"Signal kind: {f.kind}\nDetail: {f.detail}\n"
        f"Context: {f.context or 'none'}\nOccurrences this window: {f.count}"
    )
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 500,
    }).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
        content = data["choices"][0]["message"]["content"].strip()
        content = re.sub(r"^```(json)?|```$", "", content, flags=re.M).strip()
        parsed = json.loads(content)
        return parsed["title"][:120], parsed["analysis"]
    except Exception as e:
        print(f"LLM polish skipped ({e.__class__.__name__}: {e})", file=sys.stderr)
        return None


# ── issue filing ─────────────────────────────────────────────────────────

def file_issue(repo: str, f: Finding) -> None:
    sig = issue_signature(f)
    polished = polish_with_llm(f)
    if polished:
        title, analysis = polished
    else:
        title = f"🐛 [auto] {f.detail[:100]}"
        analysis = "_No LLM analysis (NOUS_API_KEY unset or call failed) — raw evidence below._"

    body = "\n".join([
        "## Auto-detected by the bug detector",
        "",
        analysis,
        "",
        "### Evidence",
        f"- **Signal**: {f.kind}",
        f"- **Detail**: `{f.detail[:400]}`",
        f"- **Context**: {f.context or '—'}",
        f"- **Occurrences in this window**: {f.count}",
        "",
        "_Triage me: confirm it's real, set a difficulty label, then label it_",
        "_`ready` (clear enough to build) or `needs-plan` (scope it first) — see_",
        "_`docs/agents/how-we-work.md` §3._",
        "",
        f"<!-- {SIG_MARKER} {sig} -->",
    ])
    _gh("issue", "create", "-R", repo, "--title", title, "--label", DETECTOR_LABELS, "--body", body)
    print(f"Filed: {title}")


def main() -> int:
    repo = os.environ.get("GITHUB_REPOSITORY", "leo4226/groei-app")
    health_url = os.environ.get("HEALTH_URL", "https://floreren-api.fly.dev/health")
    logs_path = os.environ.get("FLY_LOGS_PATH", "")

    findings: list[Finding] = []

    health = check_health(health_url)
    if health:
        findings.append(health)

    if logs_path and os.path.exists(logs_path):
        with open(logs_path, encoding="utf-8", errors="replace") as fh:
            findings.extend(extract_error_signatures(fh.read()))

    findings.extend(failed_workflow_findings(repo))

    known = existing_signatures(repo)
    fresh = filter_new_findings(findings, known)
    skipped = len(findings) - len(fresh)

    for f in fresh[:MAX_ISSUES_PER_RUN]:
        file_issue(repo, f)
    capped = max(0, len(fresh) - MAX_ISSUES_PER_RUN)

    print(f"signals={len(findings)} already-tracked={skipped} filed={min(len(fresh), MAX_ISSUES_PER_RUN)} capped={capped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
