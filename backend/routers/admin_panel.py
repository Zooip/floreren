import asyncio
import hashlib
import os
import re
import time
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from database import db_dep
from auth import require_admin
from services.svg_validator import validate_icon_svg
from services.phenology import parse_phenology
from services.storage import build_storage_from_env, storage_class
from services.icon_ai import generate_icon_variants
from services.icon_catalog import load_catalog
from services.admin_audit import log_admin_action
from services.job_runner import start_job, is_kind_running, mark_stale_jobs_interrupted  # noqa: F401
from routers.icon_generator import (
    generate_icon_svg, guess_category, derive_common_name,
    make_pot, make_ground_shadow, CANVAS,
)
import routers.icons as icons_router

import logging
logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-panel"])

HEALTH_CHECK_TIMEOUT_SECONDS = 3.0
DATABASE_HEALTH_CHECK_TIMEOUT_SECONDS = 1.0


def _health(status: str, detail: str, latency_ms: int | None = None) -> dict:
    return {"status": status, "latency_ms": latency_ms, "detail": detail}


def _error_detail(exc: Exception) -> str:
    message = str(exc).strip()
    return message or exc.__class__.__name__


async def _run_health_check(
    check: Callable[[], Awaitable[dict]],
    *,
    timeout: float | None = None,
) -> dict:
    started = time.perf_counter()
    check_timeout = HEALTH_CHECK_TIMEOUT_SECONDS if timeout is None else timeout
    try:
        result = await asyncio.wait_for(check(), timeout=check_timeout)
    except asyncio.TimeoutError:
        return _health(
            "down",
            f"Timed out after {check_timeout:g}s",
            round((time.perf_counter() - started) * 1000),
        )
    except Exception as exc:  # noqa: BLE001 — health checks must isolate failures
        return _health(
            "down",
            _error_detail(exc),
            round((time.perf_counter() - started) * 1000),
        )

    if result.get("latency_ms") is None:
        result["latency_ms"] = round((time.perf_counter() - started) * 1000)
    return result

async def _check_database(db) -> dict:
    await db.execute_fetchall("SELECT 1 as ok")
    return _health("ok", "SELECT 1 succeeded")


async def _check_bioclip_worker() -> dict:
    worker_url = (os.environ.get("BIOCLIP_WORKER_URL") or "").strip()
    if not worker_url:
        return _health("unconfigured", "BIOCLIP_WORKER_URL is not set")

    import httpx

    async with httpx.AsyncClient(timeout=HEALTH_CHECK_TIMEOUT_SECONDS) as client:
        response = await client.get(f"{worker_url.rstrip('/')}/health")

    if response.status_code >= 500:
        return _health("down", f"HTTP {response.status_code} from worker")
    if response.status_code >= 400:
        return _health("degraded", f"HTTP {response.status_code} from worker")

    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}

    worker_status = payload.get("status")
    model_loaded = payload.get("model_loaded")
    embeddings_loaded = payload.get("embeddings_loaded")
    device = payload.get("device") or "unknown"

    status = "ok" if response.is_success else "degraded"
    if worker_status and worker_status != "ok":
        status = "degraded"
    if model_loaded is False or embeddings_loaded is False:
        status = "degraded"

    detail_bits = [f"device={device}"]
    if model_loaded is not None:
        detail_bits.append(f"model_loaded={bool(model_loaded)}")
    if embeddings_loaded is not None:
        detail_bits.append(f"embeddings_loaded={bool(embeddings_loaded)}")
    if worker_status:
        detail_bits.append(f"status={worker_status}")
    return _health(status, "; ".join(detail_bits))


def _missing_env(names: tuple[str, ...]) -> list[str]:
    return [name for name in names if not (os.environ.get(name) or "").strip()]


async def _check_storage() -> dict:
    missing = _missing_env(storage_class().required_env)
    if missing:
        return _health("unconfigured", "Missing " + ", ".join(missing))

    status, detail = await asyncio.to_thread(build_storage_from_env().check_health)
    return _health(status, detail)


async def _check_llm_config() -> dict:
    from llm_config import LLM_API_KEY, LLM_CHAT_URL, LLM_MODEL

    if not LLM_API_KEY:
        return _health("unconfigured", "NOUS_API_KEY is not set")

    host = urlparse(LLM_CHAT_URL).netloc or "custom endpoint"
    return _health("ok", f"Configured for {LLM_MODEL} via {host}; no live call made")


async def _check_email_config() -> dict:
    if not (os.environ.get("RESEND_API_KEY") or "").strip():
        return _health("unconfigured", "RESEND_API_KEY is not set")
    return _health("ok", "Resend API key configured; no live call made")


def _slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9_]", "", text.lower().replace(" ", "_").replace("-", "_"))
    return s or "plant"


async def _icon_base_id(db, latin: str) -> str:
    """The `generated_icons.id` for a species, derived from its LATIN name.

    This used to be derived from the Dutch common name, which is not unique and
    is frequently absent. When it was absent the code fell back to
    ``derive_common_name(latin)`` — which returns the *genus* — so every species
    in a genus collapsed onto one id: Acer palmatum, Acer campestre and Acer
    platanoides all became ``gen_acer``. Generation then does
    ``DELETE FROM generated_icons WHERE id = ?`` before inserting, so the last
    species in the batch silently overwrote the icons just made for the others.
    All three were counted as generated; two ended up with no icon of their own.
    That is why a run reported success and left plants without icons. Two species
    sharing a Dutch common name collided the same way, and `_slug` drops every
    character outside [a-z0-9_], so names differing only in diacritics folded
    together too.

    The latin name is what `_target_species` dedupes on and what `sci` matching
    resolves against, so keying on it makes the id as unique as the target set.

    Slug collisions between genuinely different latin names are still possible
    (punctuation is stripped), so an id already held by a *different* species
    gets a short digest suffix rather than stealing the row.
    """
    base = f"gen_{_slug(latin)}"
    norm = icons_router._normalize(latin)
    rows = await db.execute_fetchall(
        "SELECT sci FROM generated_icons WHERE id = ?", (base,)
    )
    if rows and icons_router._normalize(rows[0]["sci"] or "") != norm:
        return f"{base}_{hashlib.sha1(norm.encode('utf-8')).hexdigest()[:6]}"
    return base


async def _generate_icon_assets(name_nl: str, latin: str, base_id: str) -> dict:
    """Draw one species' icon pair, AI first with a procedural fallback.

    Returns the two SVGs, the category, which engine produced them, and — when
    the AI attempts failed — the last error. That error used to be swallowed by
    a bare ``except Exception: continue``, so a species that failed AI generation
    every single run just kept getting a generic procedural icon, and procedural
    icons deliberately do not count as covered (see `_existing_sci`). The species
    therefore reappeared in the "missing" count forever with nothing anywhere
    explaining why. Reporting the error is what makes that state actionable.

    SVG validation and the procedural renderer are CPU-bound and synchronous, so
    they run in a worker thread. On a shared-cpu-1x machine a long generation run
    otherwise holds the event loop for stretches at a time, and Fly's health
    check (30s interval, 5s timeout) is what notices — see `_put_icon`.
    """
    for attempt in range(3):
        try:
            if attempt:
                # Back off before retrying. These used to fire back-to-back, so
                # a struggling endpoint got three immediate hits and the run
                # spent minutes per species collecting the same failure (#890).
                await asyncio.sleep(2 ** attempt)
            ai = await generate_icon_variants(name=name_nl, sci=latin)
            plant = ai["plant_svg"]
            # Composite the plant onto the standard pot / ground shadow, then
            # validate the finished icon (same pot as every curated icon).
            potted, bare = await asyncio.gather(
                asyncio.to_thread(validate_icon_svg, _compose_icon(plant, potted=True)),
                asyncio.to_thread(validate_icon_svg, _compose_icon(plant, potted=False)),
            )
            return {
                "potted": potted,
                "bare": bare,
                "cat": ai.get("cat") or guess_category(latin) or "unknown",
                "source": "ai",
                "ai_error": None,
            }
        except Exception as exc:  # noqa: BLE001 — timeout / empty / invalid → retry
            ai_error = f"{type(exc).__name__}: {exc}"

    cat = guess_category(latin) or guess_category(name_nl) or "houseplant"
    potted, bare = await asyncio.gather(
        asyncio.to_thread(generate_icon_svg, name=name_nl, sci=latin, cat=cat,
                          form="potted", icon_id=base_id),
        asyncio.to_thread(generate_icon_svg, name=name_nl, sci=latin, cat=cat,
                          form="bare", icon_id=base_id),
    )
    return {
        "potted": potted,
        "bare": bare,
        "cat": cat,
        "source": "procedural",
        "ai_error": ai_error,
    }


async def _put_icon(storage, key: str, svg: str) -> str:
    """Upload one SVG to R2 without blocking the event loop.

    `Storage.put` is synchronous boto3. Called straight from the job runner it
    parked the whole event loop for each upload — two per icon, dozens per run —
    on a shared-cpu-1x machine. Fly health-checks `/health` every 30s with a 5s
    timeout, so one slow upload is enough to make the machine look dead; Fly
    restarts it, and the restart marks the in-flight job `interrupted`. That is
    the "Stopped early" the panel kept reporting.
    """
    return await asyncio.to_thread(storage.put, key, svg.encode("utf-8"), "image/svg+xml")


def _compose_icon(plant_svg: str, *, potted: bool) -> str:
    """Wrap an AI-generated plant fragment in the canonical 100x100 <svg>, on top
    of the standard curated pot (potted) or a ground shadow (bare). This keeps the
    pot pixel-identical to the curated icons — the AI only ever draws the plant."""
    base = make_pot(50, 46) if potted else make_ground_shadow(50)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}" '
        f'width="{CANVAS}" height="{CANVAS}">\n{base}\n{plant_svg}\n</svg>'
    )


def _is_procedural_icon(entry: dict) -> bool:
    return entry.get("source") == "procedural"


async def _existing_sci(db) -> set[str]:
    """Latin names already covered by curated OR AI-generated icons.

    Procedural generated icons are fallback placeholders. They make a plant render,
    but they should not block a later AI retry or make the admin preview report
    "0 missing" for species that still only have generic fallback art.
    """
    catalog = await load_catalog(db)
    return {
        icons_router._normalize(e.get("sci", ""))
        for e in catalog
        if e.get("sci") and not _is_procedural_icon(e)
    }


def _sort_clause(sort: str, direction: str, allowed: dict[str, str], default: str, default_dir: str = "asc") -> str:
    """Build a safe ORDER BY clause from a whitelist.

    Sort keys arrive from the admin UI, so never interpolate them directly.
    Only known keys map to SQL fragments; unknown keys fall back to the default.
    """
    key = sort if sort in allowed else default
    safe_dir = direction.lower() if direction and direction.lower() in {"asc", "desc"} else default_dir
    return f"{allowed[key]} {safe_dir.upper()}"


def _add_search(where: list[str], params: list[object], q: str | None, columns: list[str]) -> None:
    term = (q or "").strip()
    if not term:
        return
    clauses = []
    for column in columns:
        clauses.append(f"LOWER(COALESCE({column}, '')) LIKE LOWER(?)")
        params.append(f"%{term}%")
    where.append("(" + " OR ".join(clauses) + ")")


def _where_sql(where: list[str]) -> str:
    return " WHERE " + " AND ".join(where) if where else ""


#: Response keys holding a moment in time. Every one of them comes out of a
#: TIMESTAMP column that stores naive UTC.
_TIME_KEYS = ("created_at", "updated_at", "done_at", "last_activity", "ts", "committed_at")


def _iso_utc(value):
    """Render a naive-UTC timestamp as an unambiguous ISO-8601 instant.

    Postgres renders `TIMESTAMP::text` as "2026-08-15 14:30:00.123456" — no
    zone marker. The browser's `new Date(...)` reads that as *local* time, so
    every admin timestamp displayed an hour or two off: a job that ran at 16:30
    Amsterdam showed as 14:30, and the elapsed clock on a job adopted after a
    page reload started at "2h 00s" because its start time parsed two hours into
    the past. Appending the zone is the whole fix — the browser then converts to
    the viewer's local time correctly.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        moment = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    text = str(value).strip()
    if not text:
        return text
    if text.endswith("Z") or "+" in text[10:] or text[10:].count("-") > 0:
        return text  # already carries a zone
    return text.replace(" ", "T", 1) + "Z"


def _admin_row(row) -> dict:
    data = dict(row)
    if "is_admin" in data:
        data["is_admin"] = bool(data["is_admin"])
    for key in _TIME_KEYS:
        if key in data:
            data[key] = _iso_utc(data[key])
    return data


async def _fetch_admin_page(
    db,
    *,
    select_sql: str,
    from_sql: str,
    where: list[str],
    params: list[object],
    order_by: str,
    limit: int,
    offset: int,
) -> dict:
    where_sql = _where_sql(where)
    total_row = (await db.execute_fetchall(
        f"SELECT COUNT(*) as n {from_sql}{where_sql}",
        tuple(params),
    ))[0]
    rows = await db.execute_fetchall(
        f"{select_sql} {from_sql}{where_sql} ORDER BY {order_by} LIMIT ? OFFSET ?",
        tuple(params + [limit, offset]),
    )
    return {"rows": [_admin_row(r) for r in rows], "total": int(total_row["n"])}


@router.get("/admin-panel/me")
async def admin_me(admin=Depends(require_admin)):
    return {"email": admin["email"], "is_admin": True}


@router.get("/admin-panel/health")
async def admin_health(admin=Depends(require_admin), db=Depends(db_dep)):
    checks: dict[str, tuple[Callable[[], Awaitable[dict]], float | None]] = {
        "database": (lambda: _check_database(db), DATABASE_HEALTH_CHECK_TIMEOUT_SECONDS),
        "bioclip": (_check_bioclip_worker, None),
        "r2": (_check_storage, None),
        "llm": (_check_llm_config, None),
        "email": (_check_email_config, None),
    }
    results = await asyncio.gather(
        *(_run_health_check(check, timeout=timeout) for check, timeout in checks.values()),
        return_exceptions=True,
    )

    response: dict[str, dict] = {}
    for service, result in zip(checks.keys(), results):
        if isinstance(result, Exception):
            response[service] = _health("down", _error_detail(result))
        else:
            response[service] = result
    return response


def _worker_headers() -> dict[str, str]:
    token = (os.environ.get("BIOCLIP_WORKER_TOKEN") or "").strip()
    return {"X-Worker-Token": token} if token else {}


async def _fetch_bioclip_coverage() -> dict:
    worker_url = (os.environ.get("BIOCLIP_WORKER_URL") or "").strip()
    if not worker_url:
        return {
            "status": "unconfigured",
            "detail": "BIOCLIP_WORKER_URL is not set",
            "embedded_species": 0,
            "species_ids": [],
        }

    import httpx

    try:
        async with httpx.AsyncClient(timeout=HEALTH_CHECK_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{worker_url.rstrip('/')}/coverage",
                headers=_worker_headers(),
            )
    except Exception as exc:  # noqa: BLE001 - coverage should degrade gracefully
        return {
            "status": "down",
            "detail": _error_detail(exc),
            "embedded_species": 0,
            "species_ids": [],
        }

    if response.status_code >= 400:
        return {
            "status": "down",
            "detail": f"HTTP {response.status_code} from worker",
            "embedded_species": 0,
            "species_ids": [],
        }

    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}

    raw_ids = payload.get("species_ids") or []
    species_ids: list[int] = []
    for sid in raw_ids:
        try:
            species_ids.append(int(sid))
        except (TypeError, ValueError):
            continue

    ready = bool(payload.get("ready", True))
    status = "ok" if ready else "degraded"
    detail = payload.get("detail") or f"{len(species_ids)} species embedded"
    return {
        "status": status,
        "detail": detail,
        "embedded_species": int(payload.get("species_count") or len(species_ids)),
        "species_ids": species_ids,
    }


async def _identify_outcomes(db, start_date) -> dict:
    """Did the identify actually land? (#866 phase 3)

    Counts committed identifies in the window and splits them by whether the
    user kept what the engine led with. `misses` — a BioCLIP identify where the
    user committed a *different* species — is the number that should fall as the
    catalog sync feeds real corrections back in. `missed_species` ranks what to
    add next: the species users had to reach past BioCLIP to find.

    Best-effort: the columns arrive with migration 0068, so an unmigrated DB (or
    a slim test fixture) reports zeros rather than 500ing the whole dashboard.
    """
    empty = {
        "committed": 0, "bioclip_accepted": 0, "bioclip_misses": 0,
        "miss_rate": None, "missed_species": [],
    }
    try:
        totals = await db.execute_fetchall("""
            SELECT
              COUNT(*) as committed,
              COUNT(*) FILTER (
                WHERE engine = 'bioclip' AND chosen_species_id = top_species_id
              ) as accepted,
              COUNT(*) FILTER (
                WHERE engine = 'bioclip'
                  AND (top_species_id IS NULL OR chosen_species_id != top_species_id)
              ) as misses
            FROM identify_log
            WHERE committed_at IS NOT NULL AND created_at >= $1::date
        """, (start_date,))
    except Exception:
        return empty

    row = dict(totals[0]) if totals else {}
    accepted = int(row.get("accepted") or 0)
    misses = int(row.get("misses") or 0)
    bioclip_total = accepted + misses

    # Counts stand on their own; if the ranked list can't be built (join over a
    # table this deployment doesn't have yet) the numbers still report.
    try:
        missed_rows = await db.execute_fetchall("""
        SELECT il.chosen_species_id as species_id,
               ps.latin_name, ps.common_name_nl,
               COUNT(*) as count
        FROM identify_log il
        LEFT JOIN plant_species ps ON ps.id = il.chosen_species_id
        WHERE il.committed_at IS NOT NULL
          AND il.created_at >= $1::date
          AND il.engine = 'bioclip'
          AND il.chosen_species_id IS NOT NULL
          AND (il.top_species_id IS NULL OR il.chosen_species_id != il.top_species_id)
        GROUP BY il.chosen_species_id, ps.latin_name, ps.common_name_nl
        ORDER BY count DESC, ps.latin_name
        LIMIT 20
        """, (start_date,))
    except Exception:
        missed_rows = []

    return {
        "committed": int(row.get("committed") or 0),
        "bioclip_accepted": accepted,
        "bioclip_misses": misses,
        # None rather than 0 when nothing was committed — "no data" and "never
        # misses" must not look the same on the dashboard.
        "miss_rate": round(misses / bioclip_total, 3) if bioclip_total else None,
        "missed_species": [
            {
                "species_id": r["species_id"],
                "latin_name": r["latin_name"],
                "common_name_nl": r["common_name_nl"],
                "count": r["count"],
            }
            for r in missed_rows
        ],
    }


def _has_text(value) -> bool:
    return bool(str(value or "").strip())


def _small_plant_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "species": row.get("species"),
        "species_id": row.get("species_id"),
        "icon_key": row.get("icon_key"),
        "plant_type": row.get("plant_type"),
    }


@router.get("/admin-panel/coverage")
async def admin_coverage(admin=Depends(require_admin), db=Depends(db_dep)):
    plant_rows = [dict(r) for r in await db.execute_fetchall(
        "SELECT id, name, species, species_id, icon_key, plant_type, is_active FROM plants"
    )]
    active_plants = [p for p in plant_rows if bool(p.get("is_active"))]
    archived_plants = [p for p in plant_rows if not bool(p.get("is_active"))]

    species_rows = [dict(r) for r in await db.execute_fetchall(
        "SELECT id, common_name_nl, common_name_en, latin_name, phenology_json, care_thresholds FROM plant_species"
    )]

    # The whole catalog — curated *and* AI-generated. This used to read
    # `load_manifest()`, which is only the curated JSON file on disk, so every
    # plant wearing a `gen_*` icon counted as a "stale icon key". Coverage was
    # reporting the output of the Generate icons tool as breakage: run the tool,
    # watch the stale count go up.
    catalog = await load_catalog(db)
    valid_icon_ids = {entry.get("id") for entry in catalog if entry.get("id")}

    active_stale_icon_rows = [
        _small_plant_row(p)
        for p in active_plants
        if _has_text(p.get("icon_key")) and p.get("icon_key") not in valid_icon_ids
    ]
    archived_stale_icon_rows = [
        _small_plant_row(p)
        for p in archived_plants
        if _has_text(p.get("icon_key")) and p.get("icon_key") not in valid_icon_ids
    ]
    missing_species_link_rows = [
        _small_plant_row(p) for p in active_plants if p.get("species_id") is None
    ]

    from species_service import _localized_name_missing

    # Species linked to at least one active garden plant (any household) — these
    # are the gaps a user actually sees, so they're flagged for prioritisation.
    active_species_ids = {
        int(p["species_id"]) for p in active_plants if p.get("species_id") is not None
    }

    species_stats = {
        "total": len(species_rows),
        "missing_latin_name": 0,
        "missing_common_name_nl": 0,
        "missing_common_name_en": 0,
        "missing_phenology": 0,
        "missing_facts_nl": 0,
        "missing_facts_en": 0,
        "missing_thresholds": 0,
    }
    incomplete_species = 0
    species_gap_rows: list[dict] = []
    for row in species_rows:
        latin = row.get("latin_name")
        missing_latin = not _has_text(latin)
        # Stricter than _has_text: a name that merely echoes the Latin name is a
        # gap too, matching what the "Backfill localized names" tool repairs.
        missing_nl = _localized_name_missing(row.get("common_name_nl"), latin)
        missing_en = _localized_name_missing(row.get("common_name_en"), latin)
        missing_thresholds = not _has_text(row.get("care_thresholds"))
        phenology = parse_phenology(row) or {}
        missing_phenology = not phenology
        missing_facts_nl = not _has_text(phenology.get("interesting_facts_nl"))
        missing_facts_en = not _has_text(phenology.get("interesting_facts_en"))

        if missing_latin:
            species_stats["missing_latin_name"] += 1
        if missing_nl:
            species_stats["missing_common_name_nl"] += 1
        if missing_en:
            species_stats["missing_common_name_en"] += 1
        if missing_thresholds:
            species_stats["missing_thresholds"] += 1
        if missing_phenology:
            species_stats["missing_phenology"] += 1
        if missing_facts_nl:
            species_stats["missing_facts_nl"] += 1
        if missing_facts_en:
            species_stats["missing_facts_en"] += 1

        has_gap = any((
            missing_latin, missing_nl, missing_en, missing_thresholds,
            missing_phenology, missing_facts_nl, missing_facts_en,
        ))
        if has_gap:
            incomplete_species += 1
            if len(species_gap_rows) < 200:
                species_gap_rows.append({
                    "id": row.get("id"),
                    "common_name_nl": row.get("common_name_nl"),
                    "common_name_en": row.get("common_name_en"),
                    "latin_name": latin,
                    "in_use": row.get("id") is not None and int(row["id"]) in active_species_ids,
                    "missing_name_nl": missing_nl,
                    "missing_name_en": missing_en,
                    "missing_latin": missing_latin,
                    "missing_facts_nl": missing_facts_nl,
                    "missing_facts_en": missing_facts_en,
                    "missing_thresholds": missing_thresholds,
                    "missing_phenology": missing_phenology,
                })
    # In-use gaps sort first so the user's own plants surface at the top.
    species_gap_rows.sort(key=lambda r: (not r["in_use"], str(r.get("common_name_nl") or "").lower()))
    species_stats["incomplete"] = incomplete_species

    # Queue depth for the incremental catalog sync (#866). Best-effort: the
    # column arrives with migration 0067, so a DB that hasn't migrated yet (or a
    # test fixture with a slim plant_species) reports "unknown" rather than 500.
    try:
        pending_embedding = (await db.execute_fetchall(
            "SELECT COUNT(*) as n FROM plant_species "
            "WHERE embedded_at IS NULL AND id_enabled = TRUE "
            "  AND latin_name IS NOT NULL AND latin_name != ''"
        ))[0]["n"]
    except Exception:
        pending_embedding = None

    bioclip_worker = await _fetch_bioclip_coverage()
    embedded_ids = set(bioclip_worker.get("species_ids") or [])
    db_missing_ids = set()
    db_missing_rows: list[dict] = []
    active_missing_bioclip = 0
    if bioclip_worker.get("status") == "ok":
        for row in species_rows:
            sid = row.get("id")
            if sid is not None and _has_text(row.get("latin_name")) and int(sid) not in embedded_ids:
                db_missing_ids.add(int(sid))
                if len(db_missing_rows) < 50:
                    db_missing_rows.append({
                        "id": int(sid),
                        "common_name_nl": row.get("common_name_nl"),
                        "latin_name": row.get("latin_name"),
                    })
        active_missing_bioclip = sum(
            1 for p in active_plants
            if p.get("species_id") is not None and int(p["species_id"]) in db_missing_ids
        )

    return {
        "plants": {
            "active_total": len(active_plants),
            "missing_species_link": len(missing_species_link_rows),
            "missing_species_link_rows": missing_species_link_rows[:50],
        },
        "species": species_stats,
        "species_gaps": species_gap_rows,
        "icons": {
            "active_missing_icon": sum(1 for p in active_plants if not _has_text(p.get("icon_key"))),
            "active_stale_icon_key": len(active_stale_icon_rows),
            "archived_stale_icon_key": len(archived_stale_icon_rows),
            "missing_plant_type": sum(1 for p in active_plants if not _has_text(p.get("plant_type"))),
            "active_stale_icon_rows": active_stale_icon_rows[:50],
            "archived_stale_icon_rows": archived_stale_icon_rows[:50],
        },
        "bioclip": {
            "status": bioclip_worker.get("status"),
            "detail": bioclip_worker.get("detail"),
            "embedded_species": bioclip_worker.get("embedded_species", 0),
            "db_species_missing_from_bioclip": len(db_missing_ids),
            "active_plants_missing_from_bioclip": active_missing_bioclip,
            "missing_species_rows": db_missing_rows,
            # Species queued for the incremental /embed-text sync (#866). The
            # sync loop drains this on its own; the count is here so a stuck
            # queue (worker down, names failing the sanity check) is visible.
            "pending_embedding": pending_embedding,
        },
    }


@router.post("/admin-panel/bioclip/sync")
async def admin_bioclip_sync(admin=Depends(require_admin), db=Depends(db_dep)):
    """Reconcile the worker's reference catalog with plant_species now (#866).

    Same operation the background loop runs every few hours — exposed so a drift
    spotted on this page can be fixed without waiting for the next tick."""
    from services.bioclip_catalog_sync import reconcile

    return await reconcile(db)


@router.get("/admin-panel/overview")
async def admin_overview(admin=Depends(require_admin), db=Depends(db_dep)):
    total_accounts = (await db.execute_fetchall("SELECT COUNT(*) as n FROM accounts"))[0]["n"]
    total_plants = (await db.execute_fetchall(
        "SELECT COUNT(*) as n FROM plants WHERE is_active = 1"
    ))[0]["n"]
    total_maps = (await db.execute_fetchall("SELECT COUNT(*) as n FROM maps"))[0]["n"]
    missing_icons = (await db.execute_fetchall(
        "SELECT COUNT(*) as n FROM plants WHERE is_active = 1 AND icon_requested = TRUE"
    ))[0]["n"]

    recent_accounts = await db.execute_fetchall("""
        SELECT a.id, a.name, a.email, a.is_admin, a.created_at::text, h.name as household_name,
               (SELECT COUNT(*) FROM plants p
                WHERE p.household_id = a.household_id AND p.is_active = 1) as plant_count
        FROM accounts a
        JOIN households h ON a.household_id = h.id
        ORDER BY a.created_at DESC
        LIMIT 10
    """)

    new_accounts = await db.execute_fetchall("""
        SELECT 'account_registered' as kind, a.name as label, h.name as household,
               a.created_at::text as ts
        FROM accounts a JOIN households h ON a.household_id = h.id
        ORDER BY a.created_at DESC LIMIT 5
    """)
    new_plants = await db.execute_fetchall("""
        SELECT 'plant_added' as kind, p.name as label, h.name as household,
               p.created_at::text as ts
        FROM plants p JOIN households h ON p.household_id = h.id
        WHERE p.is_active = 1
        ORDER BY p.created_at DESC LIMIT 5
    """)
    icon_requests = await db.execute_fetchall("""
        SELECT 'icon_requested' as kind, p.name as label, h.name as household,
               p.created_at::text as ts
        FROM plants p JOIN households h ON p.household_id = h.id
        WHERE p.icon_requested = TRUE
        ORDER BY p.created_at DESC LIMIT 5
    """)

    activity = sorted(
        [_admin_row(r) for r in new_accounts] +
        [_admin_row(r) for r in new_plants] +
        [_admin_row(r) for r in icon_requests],
        key=lambda x: x["ts"] or "",
        reverse=True,
    )[:10]

    return {
        "total_accounts": total_accounts,
        "total_plants": total_plants,
        "total_maps": total_maps,
        "missing_icons": missing_icons,
        "recent_accounts": [_admin_row(r) for r in recent_accounts],
        "recent_activity": activity,
    }

@router.get("/admin-panel/growth-metrics")
async def admin_growth_metrics(
    days: int = Query(30, ge=1, le=365),
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Daily growth metrics over the last N days: signups, plants added, care logs, active households."""
    from collections import defaultdict
    from datetime import date, timedelta

    # Generate complete date series
    # Deliberately UTC: analytics buckets, not a gardening day.
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    date_series = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]

    # --- 1. Signups per day ---
    signups_raw = await db.execute_fetchall("""
        SELECT DATE(created_at) as d, COUNT(*) as n
        FROM accounts
        WHERE created_at >= $1::date
        GROUP BY DATE(created_at)
        ORDER BY d
    """, (start_date,))
    signups_map = {str(r["d"])[:10]: r["n"] for r in signups_raw}

    # --- 2. Plants added per day ---
    plants_raw = await db.execute_fetchall("""
        SELECT DATE(created_at) as d, COUNT(*) as n
        FROM plants
        WHERE is_active = 1 AND created_at >= $1::date
        GROUP BY DATE(created_at)
        ORDER BY d
    """, (start_date,))
    plants_map = {str(r["d"])[:10]: r["n"] for r in plants_raw}

    # --- 3. Care logs per day ---
    care_raw = await db.execute_fetchall("""
        SELECT DATE(done_at) as d, COUNT(*) as n
        FROM care_log
        WHERE done_at >= $1::date
        GROUP BY DATE(done_at)
        ORDER BY d
    """, (start_date,))
    care_map = {str(r["d"])[:10]: r["n"] for r in care_raw}

    # --- 4. Active households (≥1 care log) per day ---
    active_raw = await db.execute_fetchall("""
        SELECT DATE(cl.done_at) as d, COUNT(DISTINCT p.household_id) as n
        FROM care_log cl
        JOIN plants p ON cl.plant_id = p.id
        WHERE cl.done_at >= $1::date
        GROUP BY DATE(cl.done_at)
        ORDER BY d
    """, (start_date,))
    active_map = {str(r["d"])[:10]: r["n"] for r in active_raw}

    # --- 5. Plant identifications per day ---
    identify_raw = await db.execute_fetchall("""
        SELECT DATE(created_at) as d, COUNT(*) as n
        FROM identify_log
        WHERE created_at >= $1::date
        GROUP BY DATE(created_at)
        ORDER BY d
    """, (start_date,))
    identify_map = {str(r["d"])[:10]: r["n"] for r in identify_raw}

    # Build the response — fill in zeros for missing dates. Keys are coerced to
    # 'YYYY-MM-DD' strings: asyncpg returns DATE() as a datetime.date object
    # (SQLite returns a string), so without the coercion the lookups below
    # silently miss and every day reads 0 in production.
    signups = [{"date": d, "count": signups_map.get(d, 0)} for d in date_series]
    plants_added = [{"date": d, "count": plants_map.get(d, 0)} for d in date_series]
    care_logs = [{"date": d, "count": care_map.get(d, 0)} for d in date_series]
    active_households = [{"date": d, "count": active_map.get(d, 0)} for d in date_series]
    identifies = [{"date": d, "count": identify_map.get(d, 0)} for d in date_series]

    # --- Who is identifying: top households over the current window ---
    top_identifiers_raw = await db.execute_fetchall("""
        SELECT h.name as household, COUNT(*) as count
        FROM identify_log il
        JOIN households h ON h.id = il.household_id
        WHERE il.created_at >= $1::date
        GROUP BY h.name
        ORDER BY count DESC, h.name
        LIMIT 10
    """, (start_date,))
    top_identifiers = [{"household": r["household"], "count": r["count"]} for r in top_identifiers_raw]

    # --- Deltas: current period vs previous period of same length ---
    previous_start = start_date - timedelta(days=days)

    # Compute previous period totals using separate queries
    prev_signups_raw = await db.execute_fetchall("""
        SELECT COUNT(*) as n FROM accounts
        WHERE created_at >= $1::date AND created_at < $2::date
    """, (previous_start, start_date))
    prev_plants_raw = await db.execute_fetchall("""
        SELECT COUNT(*) as n FROM plants
        WHERE is_active = 1 AND created_at >= $1::date AND created_at < $2::date
    """, (previous_start, start_date))
    prev_care_raw = await db.execute_fetchall("""
        SELECT COUNT(*) as n FROM care_log
        WHERE done_at >= $1::date AND done_at < $2::date
    """, (previous_start, start_date))
    prev_active_raw = await db.execute_fetchall("""
        SELECT COUNT(DISTINCT p.household_id) as n
        FROM care_log cl
        JOIN plants p ON cl.plant_id = p.id
        WHERE cl.done_at >= $1::date AND cl.done_at < $2::date
    """, (previous_start, start_date))
    prev_identify_raw = await db.execute_fetchall("""
        SELECT COUNT(*) as n FROM identify_log
        WHERE created_at >= $1::date AND created_at < $2::date
    """, (previous_start, start_date))
    # Distinct active households in the CURRENT window — same unit as prev_active.
    # (The old code compared active-*days* here against distinct-*households* in
    # the previous window, so the delta was meaningless.)
    cur_active_raw = await db.execute_fetchall("""
        SELECT COUNT(DISTINCT p.household_id) as n
        FROM care_log cl JOIN plants p ON cl.plant_id = p.id
        WHERE cl.done_at >= $1::date
    """, (start_date,))

    current_signups = sum(v["count"] for v in signups)
    current_plants = sum(v["count"] for v in plants_added)
    current_care = sum(v["count"] for v in care_logs)
    current_identifies = sum(v["count"] for v in identifies)
    current_active = cur_active_raw[0]["n"]

    prev_signups = prev_signups_raw[0]["n"]
    prev_plants = prev_plants_raw[0]["n"]
    prev_care = prev_care_raw[0]["n"]
    prev_identifies = prev_identify_raw[0]["n"]
    prev_active = prev_active_raw[0]["n"]

    identify_outcomes = await _identify_outcomes(db, start_date)

    return {
        "days": days,
        "metrics": {
            "signups": signups,
            "plants_added": plants_added,
            "care_logs": care_logs,
            "active_households": active_households,
            "identifies": identifies,
        },
        "deltas": {
            "signups": current_signups - prev_signups,
            "plants_added": current_plants - prev_plants,
            "care_logs": current_care - prev_care,
            "active_households": current_active - prev_active,
            "identifies": current_identifies - prev_identifies,
        },
        "top_identifiers": top_identifiers,
        "identify_outcomes": identify_outcomes,
    }


@router.get("/admin-panel/users")
async def admin_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = None,
    sort: str = "created_at",
    direction: str = Query("desc", alias="dir"),
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    where: list[str] = []
    params: list[object] = []
    _add_search(where, params, q, ["a.name", "a.email", "h.name"])
    order_by = _sort_clause(
        sort,
        direction,
        {
            "name": "a.name",
            "email": "a.email",
            "household": "h.name",
            "plant_count": "plant_count",
            "map_count": "map_count",
            "last_activity": "last_activity",
            "created_at": "a.created_at",
        },
        "created_at",
        "desc",
    )
    return await _fetch_admin_page(
        db,
        select_sql="""
            SELECT
                a.id, a.name, a.email, a.is_admin, CAST(a.created_at AS TEXT) as created_at,
                h.id as household_id, h.name as household_name,
                (SELECT COUNT(*) FROM plants p
                 WHERE p.household_id = a.household_id AND p.is_active = 1) as plant_count,
                (SELECT COUNT(*) FROM maps m
                 WHERE m.household_id = a.household_id) as map_count,
                (SELECT CAST(MAX(cl.done_at) AS TEXT) FROM care_log cl
                 JOIN plants p ON cl.plant_id = p.id
                 WHERE p.household_id = a.household_id) as last_activity
        """,
        from_sql="""
            FROM accounts a
            JOIN households h ON a.household_id = h.id
        """,
        where=where,
        params=params,
        order_by=order_by,
        limit=limit,
        offset=offset,
    )


@router.get("/admin-panel/plants")
async def admin_plants(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = None,
    filter: str = "all",
    sort: str = "created_at",
    direction: str = Query("desc", alias="dir"),
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    where: list[str] = ["p.is_active = 1"]
    params: list[object] = []
    _add_search(where, params, q, ["p.name", "p.species", "h.name"])
    if filter == "no_icon":
        where.append("(p.icon_key IS NULL OR p.icon_key = '')")
    elif filter == "no_thresholds":
        where.append("p.care_thresholds IS NULL")
    order_by = _sort_clause(
        sort,
        direction,
        {
            "id": "p.id",
            "name": "p.name",
            "species": "p.species",
            "household": "h.name",
            "phase": "p.phase",
            "icon": "p.icon_key",
            "thresholds": "has_thresholds",
            "created_at": "p.created_at",
        },
        "created_at",
        "desc",
    )
    return await _fetch_admin_page(
        db,
        select_sql="""
            SELECT
                p.id, p.name, p.species, p.icon_key, p.phase,
                p.icon_requested,
                (p.care_thresholds IS NOT NULL) as has_thresholds,
                h.name as household_name,
                CAST(p.created_at AS TEXT) as created_at
        """,
        from_sql="""
            FROM plants p
            JOIN households h ON p.household_id = h.id
        """,
        where=where,
        params=params,
        order_by=order_by,
        limit=limit,
        offset=offset,
    )


@router.get("/admin-panel/species")
async def admin_species(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = None,
    filter: str = "all",
    sort: str = "common_name",
    direction: str = Query("asc", alias="dir"),
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    where: list[str] = []
    params: list[object] = []
    _add_search(where, params, q, ["ps.common_name_nl", "ps.latin_name"])
    if filter == "no_latin":
        where.append("(ps.latin_name IS NULL OR ps.latin_name = '')")
    elif filter == "no_thresholds":
        where.append("ps.care_thresholds IS NULL")
    order_by = _sort_clause(
        sort,
        direction,
        {
            "common_name": "ps.common_name_nl",
            "latin_name": "ps.latin_name",
            "plant_count": "plant_count",
            "thresholds": "has_thresholds",
        },
        "common_name",
        "asc",
    )
    return await _fetch_admin_page(
        db,
        select_sql="""
            SELECT
                ps.id, ps.common_name_nl, ps.latin_name,
                (ps.care_thresholds IS NOT NULL) as has_thresholds,
                (ps.latin_name IS NOT NULL AND ps.latin_name != '') as has_latin_name,
                (SELECT COUNT(*) FROM plants p
                 WHERE p.species_id = ps.id AND p.is_active = 1) as plant_count
        """,
        from_sql="FROM plant_species ps",
        where=where,
        params=params,
        order_by=order_by,
        limit=limit,
        offset=offset,
    )


@router.get("/admin-panel/activity")
async def admin_activity(admin=Depends(require_admin), db=Depends(db_dep)):
    new_accounts = await db.execute_fetchall("""
        SELECT 'account_registered' as kind, a.name as label, h.name as household,
               a.created_at::text as ts
        FROM accounts a JOIN households h ON a.household_id = h.id
        ORDER BY a.created_at DESC LIMIT 20
    """)
    new_plants = await db.execute_fetchall("""
        SELECT 'plant_added' as kind, p.name as label, h.name as household,
               p.created_at::text as ts
        FROM plants p JOIN households h ON p.household_id = h.id
        WHERE p.is_active = 1
        ORDER BY p.created_at DESC LIMIT 20
    """)
    icon_requests = await db.execute_fetchall("""
        SELECT 'icon_requested' as kind, p.name as label, h.name as household,
               p.created_at::text as ts
        FROM plants p JOIN households h ON p.household_id = h.id
        WHERE p.icon_requested = TRUE
        ORDER BY p.created_at DESC LIMIT 20
    """)
    care_logs = await db.execute_fetchall("""
        SELECT 'care_log' as kind,
               (cl.care_type || ' · ' || p.name) as label,
               h.name as household,
               cl.done_at::text as ts
        FROM care_log cl
        JOIN plants p ON cl.plant_id = p.id
        JOIN households h ON p.household_id = h.id
        ORDER BY cl.done_at DESC LIMIT 20
    """)

    all_events = (
        [_admin_row(r) for r in new_accounts] +
        [_admin_row(r) for r in new_plants] +
        [_admin_row(r) for r in icon_requests] +
        [_admin_row(r) for r in care_logs]
    )
    all_events.sort(key=lambda x: x["ts"] or "", reverse=True)
    return all_events[:50]


async def _unservable_plants(
    db,
    *,
    map_only: bool,
    household_id: int | None,
) -> list[dict]:
    """Plants needing an icon that generation structurally cannot reach.

    Generation works per *species*: `_target_species` inner-joins plant_species
    and requires a latin name, because the latin name is the icon's identity. A
    plant with no species link, or whose species has no latin name, is therefore
    invisible to the tool — no matter how many times you run it.

    That is why Settings said "3 plants still without an icon" while the admin
    panel offered to generate for 2. Neither number was wrong; they count
    different things, and the third plant was one this tool can never serve.
    Listing them turns "the numbers disagree" into "here is the one to fix, and
    how".
    """
    sql = (
        "SELECT p.id, p.name, p.species, p.species_id, p.icon_key, p.icon_requested, "
        "       ps.latin_name "
        "FROM plants p LEFT JOIN plant_species ps ON p.species_id = ps.id "
        "WHERE p.is_active = 1 "
    )
    params: list[object] = []
    if household_id is not None:
        sql += "AND p.household_id = ? "
        params.append(household_id)
    if map_only:
        sql += "AND p.map_id IS NOT NULL "
    rows = await db.execute_fetchall(sql, tuple(params)) if params else await db.execute_fetchall(sql)

    valid_ids = {e["id"] for e in await load_catalog(db) if not _is_procedural_icon(e)}
    blocked: list[dict] = []
    for row in rows:
        if not (row["icon_requested"] or icons_router._needs_real_icon(row["icon_key"], valid_ids)):
            continue
        if row["species_id"] is None:
            reason, hint = (
                "no_species_link",
                "Run the \"Link plants to a species\" tool, then generate icons "
                "again. It links the plant to a species (creating one from its "
                "name if needed), which is what an icon is keyed on.",
            )
        elif not (row["latin_name"] or "").strip():
            reason, hint = (
                "species_has_no_latin_name",
                "Its species has no latin name, which is what an icon is keyed on. "
                "Run Backfill Dutch & English names first.",
            )
        else:
            continue
        blocked.append({
            "id": row["id"], "name": row["name"], "species": row["species"],
            "reason": reason, "hint": hint,
        })
    return blocked


async def _target_species(
    db,
    *,
    scope: str,
    map_only: bool,
    household_id: int | None = None,
) -> list[dict]:
    """The plant_species rows that need an icon generated, deduped by latin name
    and excluding species already covered by a curated/generated icon.

    Counts SPECIES, not plants: several plants of one species share one icon, and
    a plant with no species link is not here at all (see `_unservable_plants`).

    scope="all"     → the whole species catalog (every species with a latin name).
    scope="in_use"  → only species linked to this admin household's active plants
                      that still lack a real/AI icon — flagged, placeholdered,
                      icon-less, procedurally generated, OR carrying a dangling
                      icon_key that no longer resolves to a real icon. map_only=True
                      further restricts to plants placed on a map.
    """
    covered = await _existing_sci(db)
    if scope == "in_use":
        valid_ids = {e["id"] for e in await load_catalog(db) if not _is_procedural_icon(e)}
        sql = (
            "SELECT ps.id, ps.common_name_nl, ps.latin_name, p.icon_key, p.icon_requested "
            "FROM plants p JOIN plant_species ps ON p.species_id = ps.id "
            "WHERE p.is_active = 1 AND ps.latin_name IS NOT NULL AND ps.latin_name != '' "
        )
        params: list[object] = []
        if household_id is not None:
            sql += "AND p.household_id = ? "
            params.append(household_id)
        if map_only:
            sql += "AND p.map_id IS NOT NULL "
        rows = await db.execute_fetchall(sql, tuple(params)) if params else await db.execute_fetchall(sql)
        rows = [r for r in rows
                if r["icon_requested"] or icons_router._needs_real_icon(r["icon_key"], valid_ids)]
    else:
        rows = await db.execute_fetchall(
            "SELECT id, common_name_nl, latin_name FROM plant_species "
            "WHERE latin_name IS NOT NULL AND latin_name != '' ORDER BY common_name_nl"
        )
    targets: list[dict] = []
    seen = set(covered)
    for row in rows:
        latin = (row["latin_name"] or "").strip()
        norm = icons_router._normalize(latin)
        if not latin or norm in seen:
            continue
        seen.add(norm)
        targets.append({"id": row["id"], "common_name_nl": row["common_name_nl"], "latin_name": latin})
    return targets


@router.get("/admin-panel/generate-icons/preview")
async def generate_icons_preview(scope: str = "all", map_only: bool = False,
                                 admin=Depends(require_admin), db=Depends(db_dep)):
    """How many icons a generate-icons run would create — generates nothing.

    `count` is SPECIES the run would draw. `blocked` is plants that need an icon
    but that generation cannot reach at all (no species link, or a species with
    no latin name) — the reason this number and Settings’ "plants still without
    an icon" legitimately differ.
    """
    household_id = admin.get("household_id")
    targets = await _target_species(db, scope=scope, map_only=map_only, household_id=household_id)
    blocked = (
        await _unservable_plants(db, map_only=map_only, household_id=household_id)
        if scope == "in_use" else []
    )
    return {
        "scope": scope, "map_only": map_only, "count": len(targets),
        "blocked": blocked, "blocked_count": len(blocked),
    }


@router.post("/admin-panel/plants/{plant_id}/regenerate-icon")
async def regenerate_plant_icon(
    plant_id: int,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Regenerate the AI icon for a single plant. Looks up the plant's species,
    calls the configured LLM, composites onto the standard pot/shadow, validates,
    uploads to R2, and re-matches the plant's icon_key."""
    storage = build_storage_from_env()

    plants = await db.execute_fetchall(
        "SELECT id, name, species, icon_key FROM plants WHERE id = ? AND is_active = 1",
        (plant_id,),
    )
    if not plants:
        raise HTTPException(404, "Plant not found or archived")
    plant = dict(plants[0])

    species_rows = await db.execute_fetchall(
        "SELECT common_name_nl, common_name_en, latin_name FROM plant_species WHERE latin_name = ?",
        (plant["species"],),
    )
    if not species_rows:
        raise HTTPException(404, f"Species '{plant['species']}' not found in catalog")
    sp = dict(species_rows[0])
    name_nl = sp["common_name_nl"] or plant["name"] or derive_common_name(sp["latin_name"])
    latin = sp["latin_name"]
    base_id = await _icon_base_id(db, latin)

    art = await _generate_icon_assets(name_nl, latin, base_id)
    cat, source = art["cat"], art["source"]

    try:
        potted_url = await _put_icon(storage, f"icons/generated/{base_id}.svg", art["potted"])
        bare_url = await _put_icon(storage, f"icons/generated/{base_id}_bare.svg", art["bare"])
    except Exception as exc:
        raise HTTPException(500, f"R2 upload failed: {exc}")

    for icon_id, form, variant_of, url in [
        (base_id, "potted", None, potted_url),
        (f"{base_id}_bare", "bare", base_id, bare_url),
    ]:
        await db.execute("DELETE FROM generated_icons WHERE id = ?", (icon_id,))
        await db.execute(
            "INSERT INTO generated_icons (id,name,sci,cat,form,variant_of,family,url,source) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (icon_id, name_nl, latin, cat, form, variant_of, "", url, source),
        )
    await db.commit()

    catalog = await load_catalog(db)
    valid_ids = {e["id"] for e in catalog}
    found = await icons_router.sync_match_icon_key(db, plant, catalog=catalog, valid_ids=valid_ids)
    if found and found in valid_ids and not found.startswith("placeholder"):
        await db.execute(
            "UPDATE plants SET icon_key = ?, icon_requested = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (found, plant_id),
        )
        await db.commit()

    await log_admin_action(db, admin, "regenerate_icon", target=f"plant_id={plant_id}", detail={"name": name_nl, "icon_id": base_id, "source": source})
    return {"plant_id": plant_id, "name": name_nl, "icon_id": base_id, "cat": cat, "source": source, "icon_key": found}


async def _sync_from_admin(db):
    """Re-match active plants after admin icon generation.

    This uses the same rules as Settings → Sync icons: missing/placeholder/
    dangling icons are assigned a real catalog key, and valid generic/shared icons
    are upgraded when an exact AI-generated icon exists for the plant.
    """
    catalog = await load_catalog(db)
    valid_ids = {e["id"] for e in catalog}
    plants = await db.execute_fetchall(
        "SELECT id, name, species, icon_key, icon_requested FROM plants WHERE is_active = 1"
    )
    matched = []
    for row in plants:
        plant = dict(row)
        found = await icons_router.sync_match_icon_key(db, plant, catalog=catalog, valid_ids=valid_ids)
        if found and found in valid_ids and not found.startswith("placeholder"):
            await db.execute(
                "UPDATE plants SET icon_key = ?, icon_requested = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (found, plant["id"]))
            matched.append({"plant_id": plant["id"], "plant_name": plant["name"], "icon_key": found})
    if matched:
        await db.commit()
    return {"matched": len(matched), "matches": matched}



@router.get("/admin-panel/backfill-facts/preview")
async def backfill_facts_preview(
    scope: str = "all",
    map_only: bool = False,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Preview: count species missing either Dutch or English facts."""
    from species_service import preview_missing_facts

    return await preview_missing_facts(
        db,
        scope=scope,
        map_only=map_only,
        household_id=admin.get("household_id"),
    )


@router.get("/admin-panel/backfill-species/preview")
async def backfill_species_preview(
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Preview: this household's active plants with no species link."""
    household_id = admin.get("household_id")
    rows = await db.execute_fetchall(
        "SELECT id, name FROM plants "
        "WHERE species_id IS NULL AND is_active = 1 AND household_id = ?",
        (household_id,),
    )
    total = await db.execute_fetchall(
        "SELECT COUNT(*) as n FROM plants WHERE is_active = 1 AND household_id = ?",
        (household_id,),
    )
    return {
        "active_total": int(total[0]["n"]),
        "missing_species": [dict(r) for r in rows],
        "missing_count": len(rows),
    }


@router.get("/admin-panel/backfill-names/preview")
async def backfill_names_preview(
    scope: str = "all",
    map_only: bool = False,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Preview: count species missing a Dutch and/or English common name."""
    from species_service import preview_missing_names

    return await preview_missing_names(
        db,
        scope=scope,
        map_only=map_only,
        household_id=admin.get("household_id"),
    )


@router.patch("/admin-panel/species/{species_id}")
async def admin_patch_species(
    species_id: int,
    body: dict,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Edit common_name_nl, common_name_en, and/or latin_name for a species."""
    from fastapi import HTTPException

    allowed = {"common_name_nl", "common_name_en", "latin_name"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    row = await db.execute_fetchall("SELECT id FROM plant_species WHERE id = ?", (species_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Species not found")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    await db.execute(
        f"UPDATE plant_species SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (*updates.values(), species_id),
    )
    await db.commit()

    updated = await db.execute_fetchall(
        "SELECT id, common_name_nl, common_name_en, latin_name FROM plant_species WHERE id = ?",
        (species_id,),
    )
    row = dict(updated[0])
    await log_admin_action(db, admin, "patch_species", target=f"species/{species_id}", detail={"fields": list(updates.keys()), **updates})
    return row


@router.get("/admin-panel/species/incomplete-names")
async def admin_incomplete_species_names(
    limit: int = Query(100, ge=1, le=500),
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """List species with incomplete localized common names (NL or EN missing).

    Use this to find species that failed LLM name generation and need manual fixes.
    """
    from species_service import _localized_name_missing, _text_or_none

    # Fetch the full catalog, compute the gaps in Python (same helper as the
    # backfill path), then apply the UI limit after filtering. Applying LIMIT in
    # SQL first can hide incomplete rows that sort after already-complete species.
    # The active_count join keeps the manual-fix list sorted by prevalence.
    rows = await db.execute_fetchall(
        """SELECT ps.id, ps.common_name_nl, ps.common_name_en, ps.latin_name,
                  COUNT(p.id) AS active_count
           FROM plant_species ps
           LEFT JOIN plants p ON p.species_id = ps.id AND p.is_active = TRUE
           GROUP BY ps.id, ps.common_name_nl, ps.common_name_en, ps.latin_name
           ORDER BY active_count DESC,
                    LOWER(COALESCE(ps.common_name_nl, ps.common_name_en, ps.latin_name, '')),
                    ps.id"""
    )

    incomplete = []
    for row in rows:
        rec = dict(row)
        latin_name = _text_or_none(rec.get("latin_name"))
        missing_nl = _localized_name_missing(rec.get("common_name_nl"), latin_name)
        missing_en = _localized_name_missing(rec.get("common_name_en"), latin_name)
        missing_latin = latin_name is None

        if missing_nl or missing_en or missing_latin:
            incomplete.append({
                "id": rec["id"],
                "common_name_nl": rec.get("common_name_nl"),
                "common_name_en": rec.get("common_name_en"),
                "latin_name": rec.get("latin_name"),
                "missing_nl": missing_nl,
                "missing_en": missing_en,
                "missing_latin": missing_latin,
                "active_count": int(rec.get("active_count") or 0),
            })

    return {"species": incomplete[:limit], "total": len(incomplete)}


@router.post("/admin-panel/species/{species_id}/regenerate-thresholds")
async def admin_regenerate_species_thresholds(
    species_id: int,
    propagate: bool = False,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Re-run threshold generation for this species. Optionally propagate to linked plants."""
    from fastapi import HTTPException
    from threshold_service import generate_thresholds
    import json as _json

    row = await db.execute_fetchall(
        "SELECT id, common_name_nl, latin_name FROM plant_species WHERE id = ?",
        (species_id,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Species not found")

    name = row[0]["common_name_nl"]
    latin = row[0]["latin_name"]

    try:
        thresholds = await generate_thresholds(name, latin)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Threshold generation failed: {exc}") from exc

    thresholds_json = _json.dumps(thresholds, ensure_ascii=False)
    await db.execute(
        "UPDATE plant_species SET care_thresholds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (thresholds_json, species_id),
    )

    plants_updated = 0
    if propagate:
        plant_rows = await db.execute_fetchall(
            "SELECT id FROM plants WHERE species_id = ? AND is_active = 1",
            (species_id,),
        )
        for p in plant_rows:
            await db.execute(
                "UPDATE plants SET care_thresholds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (thresholds_json, p["id"]),
            )
        plants_updated = len(plant_rows)

    await db.commit()
    result = {"species_id": species_id, "name": name, "propagated_to_plants": plants_updated}
    await log_admin_action(db, admin, "regenerate_species_thresholds", target=f"{name} (id={species_id})", detail={"propagate": propagate, "plants_updated": plants_updated})
    return result


@router.post("/admin-panel/species/{species_id}/regenerate-fact")
async def admin_regenerate_species_fact(
    species_id: int,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Re-run the bilingual interesting-fact generator for this species."""
    from fastapi import HTTPException
    from species_service import generate_fact_for_species
    import json as _json

    row = await db.execute_fetchall(
        "SELECT id, common_name_nl, latin_name, phenology_json FROM plant_species WHERE id = ?",
        (species_id,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Species not found")

    name = row[0]["common_name_nl"]
    latin = row[0]["latin_name"]
    phenology_str = row[0]["phenology_json"]

    try:
        facts = await generate_fact_for_species(name, latin)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Fact generation failed: {exc}") from exc

    fact_nl = (facts.get("fact_nl") or facts.get("interesting_facts_nl") or "").strip()
    fact_en = (facts.get("fact_en") or facts.get("interesting_facts_en") or "").strip()
    if not fact_nl or not fact_en:
        raise HTTPException(status_code=503, detail="LLM returned incomplete bilingual facts")

    phenology = parse_phenology(phenology_str) or {}

    phenology["interesting_facts_nl"] = fact_nl
    phenology["interesting_facts_en"] = fact_en
    await db.execute(
        "UPDATE plant_species SET phenology_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (_json.dumps(phenology, ensure_ascii=False), species_id),
    )
    await db.commit()
    await log_admin_action(db, admin, "regenerate_species_fact", target=f"{name} (id={species_id})", detail=None)
    return {"species_id": species_id, "name": name, "fact": fact_nl, "fact_en": fact_en}


class SpeciesMergeRequest(BaseModel):
    source_id: int
    target_id: int


@router.post("/admin-panel/species/merge")
async def admin_merge_species(
    body: SpeciesMergeRequest,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Repoint all plants from source species to target, then delete source."""
    from fastapi import HTTPException

    if body.source_id == body.target_id:
        raise HTTPException(status_code=400, detail="Cannot merge a species into itself")

    source = await db.execute_fetchall(
        "SELECT id, common_name_nl FROM plant_species WHERE id = ?", (body.source_id,)
    )
    target = await db.execute_fetchall(
        "SELECT id, common_name_nl FROM plant_species WHERE id = ?", (body.target_id,)
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source species not found")
    if not target:
        raise HTTPException(status_code=404, detail="Target species not found")

    plant_rows = await db.execute_fetchall(
        "SELECT COUNT(*) as n FROM plants WHERE species_id = ? AND is_active = 1",
        (body.source_id,),
    )
    moved = plant_rows[0]["n"]

    await db.execute(
        "UPDATE plants SET species_id = ?, updated_at = CURRENT_TIMESTAMP WHERE species_id = ?",
        (body.target_id, body.source_id),
    )
    await db.execute("DELETE FROM plant_species WHERE id = ?", (body.source_id,))
    await db.commit()

    result = {
        "merged": True,
        "source_id": body.source_id,
        "source_name": source[0]["common_name_nl"],
        "target_id": body.target_id,
        "target_name": target[0]["common_name_nl"],
        "plants_moved": moved,
    }
    await log_admin_action(db, admin, "merge_species", target=f"{source[0]['common_name_nl']} → {target[0]['common_name_nl']}", detail={"source_id": body.source_id, "target_id": body.target_id, "plants_moved": moved})
    return result


@router.get("/admin-panel/households/{household_id}")
async def admin_household_detail(
    household_id: int,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Household drill-down: accounts, maps, plants, and recent care log."""
    from fastapi import HTTPException

    hh = await db.execute_fetchall(
        "SELECT id, name, CAST(created_at AS TEXT) as created_at FROM households WHERE id = ?",
        (household_id,),
    )
    if not hh:
        raise HTTPException(status_code=404, detail="Household not found")
    hh = dict(hh[0])

    accounts = await db.execute_fetchall(
        """SELECT id, name, email, is_admin, CAST(created_at AS TEXT) as created_at
           FROM accounts WHERE household_id = ? ORDER BY created_at""",
        (household_id,),
    )

    maps = await db.execute_fetchall(
        """SELECT m.id, m.name, m.map_type,
                  (SELECT COUNT(*) FROM plants p WHERE p.map_id = m.id AND p.is_active = 1) as plant_count
           FROM maps m WHERE m.household_id = ? ORDER BY m.name""",
        (household_id,),
    )

    plants = await db.execute_fetchall(
        """SELECT p.id, p.name, p.species, p.icon_key, p.phase,
                  (p.care_thresholds IS NOT NULL) as has_thresholds,
                  CAST(p.created_at AS TEXT) as created_at
           FROM plants p WHERE p.household_id = ? AND p.is_active = 1
           ORDER BY p.created_at DESC""",
        (household_id,),
    )

    care_log = await db.execute_fetchall(
        """SELECT cl.id, p.name as plant_name, cl.care_type, CAST(cl.done_at AS TEXT) as done_at
           FROM care_log cl
           JOIN plants p ON cl.plant_id = p.id
           WHERE p.household_id = ?
           ORDER BY cl.done_at DESC LIMIT 20""",
        (household_id,),
    )

    return {
        "id": hh["id"],
        "name": hh["name"],
        "created_at": _iso_utc(hh["created_at"]),
        "accounts": [_admin_row(r) for r in accounts],
        "maps": [_admin_row(r) for r in maps],
        "plants": [_admin_row(r) for r in plants],
        "care_log": [_admin_row(r) for r in care_log],
    }


# ── Background job runner functions ──────────────────────────────────────────

async def _run_generate_icons(db, params: dict, on_progress) -> dict:
    scope = params.get("scope", "all")
    map_only = bool(params.get("map_only", False))
    limit = int(params.get("limit", 25))
    household_id = params.get("household_id")

    storage = build_storage_from_env()
    targets = await _target_species(
        db,
        scope=scope,
        map_only=map_only,
        household_id=int(household_id) if household_id is not None else None,
    )
    total_targets = len(targets)
    if limit and limit > 0:
        targets = targets[:limit]

    await on_progress(0, len(targets))
    generated, skipped, fallbacks = [], [], []
    for i, row in enumerate(targets):
        latin = row["latin_name"]
        name_nl = row["common_name_nl"] or derive_common_name(latin)
        base_id = await _icon_base_id(db, latin)

        art = await _generate_icon_assets(name_nl, latin, base_id)

        try:
            potted_url = await _put_icon(storage, f"icons/generated/{base_id}.svg", art["potted"])
            bare_url = await _put_icon(storage, f"icons/generated/{base_id}_bare.svg", art["bare"])
        except Exception as exc:
            skipped.append({
                "id": row["id"], "name": name_nl, "latin": latin,
                "reason": "r2_upload_failed",
                "error": str(exc),
                "hint": "Check the R2_* secrets on Fly — Health shows R2 storage status.",
            })
            await on_progress(i + 1, len(targets))
            continue

        for icon_id, form, variant_of, url in [
            (base_id, "potted", None, potted_url),
            (f"{base_id}_bare", "bare", base_id, bare_url),
        ]:
            await db.execute("DELETE FROM generated_icons WHERE id = ?", (icon_id,))
            await db.execute(
                "INSERT INTO generated_icons (id,name,sci,cat,form,variant_of,family,url,source) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (icon_id, name_nl, latin, art["cat"], form, variant_of, "", url, art["source"]),
            )
        generated.append({
            "id": row["id"], "name": name_nl, "latin": latin,
            "icon_id": base_id, "cat": art["cat"], "source": art["source"],
        })
        if art["source"] == "procedural":
            # Not a failure — the plant renders — but a generic icon does not
            # count as covered, so this species comes back next run. Surface it
            # so a permanently-failing species is visible instead of silently
            # inflating the "still missing" count forever.
            fallbacks.append({
                "id": row["id"], "name": name_nl, "latin": latin,
                "reason": "ai_failed_used_generic_art",
                "error": art["ai_error"],
                "hint": "Generic art was stored so the plant renders. Retry later, "
                        "or use Regenerate plant icon for a single species.",
            })
        await on_progress(i + 1, len(targets))

    sync_result = await _sync_from_admin(db)
    # Plants this tool structurally cannot serve. Reported on the run, not only
    # in the preview, so "2 generated" next to Settings' "3 still without an
    # icon" explains itself instead of looking like a miscount.
    blocked = (
        await _unservable_plants(
            db, map_only=map_only,
            household_id=int(household_id) if household_id is not None else None,
        )
        if scope == "in_use" else []
    )
    return {
        "generated": generated, "count": len(generated),
        "blocked": blocked, "blocked_count": len(blocked),
        "ai_count": sum(1 for g in generated if g["source"] == "ai"),
        "skipped": skipped, "skipped_count": len(skipped),
        "fallback_count": len(fallbacks),
        # All three feed the same "what needs attention" disclosure in the UI.
        "skipped_details": skipped + fallbacks + blocked,
        "sync_result": sync_result,
        "scope": scope, "map_only": map_only,
        "remaining": max(0, total_targets - len(generated)),
    }


async def _run_backfill_thresholds(db, params: dict, on_progress) -> dict:
    import json as _json
    from threshold_service import generate_thresholds as _gen_thresholds

    rows = await db.execute_fetchall(
        "SELECT id, name, species FROM plants WHERE care_thresholds IS NULL AND is_active = 1"
    )
    total = len(rows)
    await on_progress(0, total)
    succeeded = 0
    failures = []
    for i, row in enumerate(rows):
        try:
            thresholds = await _gen_thresholds(row["name"], row["species"])
            await db.execute(
                "UPDATE plants SET care_thresholds = ? WHERE id = ?",
                (_json.dumps(thresholds), row["id"]),
            )
            succeeded += 1
        except Exception as exc:
            failures.append({
                "id": row["id"],
                "name": row["name"],
                "reason": "threshold_generation_failed",
                "error": str(exc),
                "hint": "Usually the LLM call — check NOUS_API_KEY under Health, then re-run.",
            })
        await on_progress(i + 1, total)
    # `failures` used to be built and then dropped, so the panel could only say
    # "N failed" with no way to find out why. The details ride along now.
    return {
        "processed": total, "succeeded": succeeded, "failed": len(failures),
        "skipped_details": failures,
    }


async def _run_backfill_care_schedules(db, params: dict, on_progress) -> dict:
    from routers.plants import _seed_care_schedules

    # Candidates are plants with NO water schedule row at all — not "no *active*
    # one". A plant whose water schedule is switched off has one; the seeder
    # will not resurrect it (that was a deliberate choice), so counting it as
    # needing seeding made it a candidate that could never be satisfied.
    rows = await db.execute_fetchall(
        """SELECT p.id, p.name, p.care_thresholds FROM plants p
           WHERE p.care_thresholds IS NOT NULL AND p.is_active = 1
           AND p.id NOT IN (
               SELECT DISTINCT plant_id FROM care_schedules WHERE care_type = 'water'
           )"""
    )
    total = len(rows)
    await on_progress(0, total)
    seeded = 0
    failures: list[dict] = []
    for i, row in enumerate(rows):
        try:
            outcome = await _seed_care_schedules(db, row["id"], row["care_thresholds"])
            if outcome in ("created", "refined"):
                seeded += 1
            else:
                # The seeder ran without error but made no schedule. This used
                # to be counted as a success, which is why the pending count
                # never moved.
                failures.append({
                    "id": row["id"],
                    "name": row["name"],
                    "reason": outcome,
                    "hint": (
                        "Its care thresholds have no usable water_interval_days — "
                        "run Backfill thresholds, or set a watering interval on the plant."
                        if outcome in ("no_water_interval", "bad_thresholds")
                        else "It already has a water schedule; nothing to seed."
                    ),
                })
        except Exception as exc:
            # Was a server-side log line only — invisible from the admin panel,
            # where the run just reported a seeded count lower than the checked
            # count with no explanation.
            logger.warning("Care schedule seed failed for plant %s: %s", row["id"], exc)
            failures.append({
                "id": row["id"],
                "reason": "schedule_seed_failed",
                "error": str(exc),
                "hint": "Usually malformed care_thresholds — re-run Backfill thresholds first.",
            })
        await on_progress(i + 1, total)
    return {"checked": total, "seeded": seeded, "skipped_details": failures}


async def _run_backfill_facts(db, params: dict, on_progress) -> dict:
    from species_service import backfill_missing_facts

    limit = int(params.get("limit", 50))
    scope = str(params.get("scope", "all"))
    map_only = bool(params.get("map_only", False))
    household_id = params.get("household_id")
    return await backfill_missing_facts(
        db,
        limit=limit,
        scope=scope,
        map_only=map_only,
        household_id=int(household_id) if household_id is not None else None,
        on_progress=on_progress,
    )


async def _run_backfill_names(db, params: dict, on_progress) -> dict:
    from species_service import backfill_missing_names

    limit = int(params.get("limit", 50))
    scope = str(params.get("scope", "all"))
    map_only = bool(params.get("map_only", False))
    household_id = params.get("household_id")
    return await backfill_missing_names(
        db,
        limit=limit,
        scope=scope,
        map_only=map_only,
        household_id=int(household_id) if household_id is not None else None,
        on_progress=on_progress,
    )


async def _run_backfill_species(db, params: dict, on_progress) -> dict:
    """Link active plants that have no species_id to a species row.

    A plant with no species link is invisible to icon generation, to the facts
    and names backfills, and to BioCLIP coverage — every one of those works per
    species. It is the single upstream gap that makes several tools quietly
    unable to help a plant, which is why the icon card can list three plants it
    "cannot reach".

    `get_or_create_species` matches an existing species on any of its names and
    otherwise creates one from the plant's own name, so this is usually a link
    rather than a new row.

    There was already an endpoint for this — POST /admin/backfill-species — and
    it had never worked: `get_or_create_species` was never imported there, so
    every plant failed with a NameError that the loop swallowed into a failure
    list nothing displayed. Nothing in the UI called it either. It is gone; this
    runs through the job system like every other tool, scoped to the household.
    """
    from species_service import get_or_create_species

    household_id = params.get("household_id")
    sql = ("SELECT id, name, species FROM plants "
           "WHERE species_id IS NULL AND is_active = 1 ")
    sql_params: list[object] = []
    if household_id is not None:
        sql += "AND household_id = ? "
        sql_params.append(int(household_id))
    rows = await db.execute_fetchall(sql, tuple(sql_params)) if sql_params else await db.execute_fetchall(sql)

    total = len(rows)
    await on_progress(0, total)
    linked = 0
    failures: list[dict] = []
    for index, row in enumerate(rows):
        # The user-entered species text is the better hint when present; the
        # plant's display name is the fallback.
        lookup = (row["species"] or "").strip() or row["name"]
        try:
            species_id = await get_or_create_species(db, lookup)
            await db.execute(
                "UPDATE plants SET species_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (int(species_id), row["id"]),
            )
            linked += 1
        except Exception as exc:  # noqa: BLE001 — one bad plant must not stop the run
            failures.append({
                "id": row["id"],
                "name": row["name"],
                "reason": "species_lookup_failed",
                "error": f"{type(exc).__name__}: {exc}",
                "hint": "Usually the LLM call behind the species lookup — check "
                        "NOUS_API_KEY under Health, then re-run.",
            })
        await on_progress(index + 1, total)

    return {
        "processed": total, "linked": linked, "failed": len(failures),
        "skipped_details": failures,
    }


async def _run_backfill_photo_embeddings(db, params: dict, on_progress) -> dict:
    """Re-embed journal photos that were stored while the BioCLIP worker was down.

    `check_photo` returns None when the worker is unreachable, and
    `_run_photo_check` then stores nothing — no embedding, no anchor. The photo
    itself uploads and displays perfectly, so a photo round done while the
    Windows machine is asleep looks like a complete success and silently
    produces none of the identification or game value it exists for.

    The images are in R2, so this is recoverable: fetch each photo that has no
    embedding, run the same check, and take the same anchor decision that the
    upload path would have taken.

    Fails fast when the worker is unreachable rather than walking the whole
    backlog turning every row into a skip — the failure that matters is
    "your worker is off", said once.
    """
    import httpx

    from services.photo_check import check_photo
    from services.user_refs import add_anchor

    household_id = params.get("household_id")

    # ── Pass 1: photos already embedded, but never anchored ──────────────────
    #
    # An embedding is only kept as a species anchor if the plant had a species
    # link at upload time. Link the species afterwards and the existing photos
    # stay embedded and unanchored forever — the upload path has long since run,
    # and the re-embed pass below skips them because they DO have an embedding.
    # That is the gap: photograph first, link later, and those photos never
    # train identification.
    #
    # This needs no worker. The embedding is already in the row; only the
    # anchor decision was missed, and it can be taken now.
    adoptable = await db.execute_fetchall(
        """SELECT pp.id, pp.url, pp.plant_id, pp.embedding, p.name AS plant_name,
                  p.species_id
             FROM plant_photos pp
             JOIN plants p ON p.id = pp.plant_id
            WHERE pp.embedding IS NOT NULL
              AND p.species_id IS NOT NULL
              AND NOT pp.species_mismatch
              AND p.household_id = ?
              AND NOT EXISTS (
                    SELECT 1 FROM user_confirmed_embeddings u
                     WHERE u.source_plant_id = pp.plant_id
                       AND u.source_photo_url = pp.url)
         ORDER BY pp.taken_at DESC""",
        (household_id,),
    )
    adopted = 0
    for row in adoptable:
        embedding = row["embedding"]
        if isinstance(embedding, memoryview):
            embedding = bytes(embedding)
        outcome = await add_anchor(
            db, row["species_id"], embedding,
            photo_url=row["url"], plant_id=row["plant_id"],
        )
        if outcome == "added":
            adopted += 1

    # ── Pass 2: photos with no embedding at all (worker was down) ────────────
    rows = await db.execute_fetchall(
        """SELECT pp.id, pp.url, pp.plant_id, p.name AS plant_name, p.species_id
             FROM plant_photos pp
             JOIN plants p ON p.id = pp.plant_id
            WHERE pp.embedding IS NULL AND p.household_id = ?
         ORDER BY pp.taken_at DESC""",
        (household_id,),
    )
    total = len(rows)
    await on_progress(0, total)
    if total == 0:
        return {
            "checked": 0, "embedded": 0, "anchored": adopted,
            "adopted": adopted, "skipped_details": [],
        }

    embedded = 0
    anchored = 0
    failures: list[dict] = []

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for i, row in enumerate(rows):
            url = row["url"]
            try:
                if not url:
                    failures.append({
                        "id": row["id"], "name": row["plant_name"], "reason": "no_url",
                        "hint": "The photo row has no stored URL; nothing to fetch.",
                    })
                    continue
                resp = await client.get(url)
                resp.raise_for_status()
                image_bytes = resp.content
            except Exception as exc:
                logger.warning("Photo %s could not be fetched: %s", row["id"], exc)
                failures.append({
                    "id": row["id"], "name": row["plant_name"],
                    "reason": "download_failed", "error": str(exc),
                    "hint": "The image is missing from R2 or the URL is stale.",
                })
                await on_progress(i + 1, total)
                continue

            result = await check_photo(image_bytes, row["species_id"])
            if result is None:
                # One unreachable worker means every remaining row fails the same
                # way. Stop and say so, instead of a run that reports 0 embedded.
                raise RuntimeError(
                    "The BioCLIP worker is unreachable, so no photo can be embedded. "
                    "Check https://bioclip.floreren.app/health and that the "
                    "'Floreren Workers' task is running, then run this again — "
                    f"{embedded} of {total} photos were embedded before it stopped"
                    f", and {adopted} already-embedded photos became references "
                    "(that part needs no worker and is saved)."
                )

            await db.execute(
                """UPDATE plant_photos SET bioclip_species_id = ?, bioclip_confidence = ?,
                   species_mismatch = ?, embedding = ? WHERE id = ?""",
                (result["bioclip_species_id"], result["bioclip_confidence"],
                 result["species_mismatch"], result["embedding"], row["id"]),
            )
            await db.commit()
            embedded += 1

            # Same guard as the upload path: only anchor a label we can trust.
            if row["species_id"] and not result["species_mismatch"]:
                outcome = await add_anchor(
                    db, row["species_id"], result["embedding"],
                    photo_url=url, plant_id=row["plant_id"],
                )
                if outcome == "added":
                    anchored += 1
            elif row["species_id"] and result["species_mismatch"]:
                failures.append({
                    "id": row["id"], "name": row["plant_name"],
                    "reason": "species_mismatch",
                    "hint": "Embedded, but not used as a reference: BioCLIP thinks this is a different species.",
                })
            elif not row["species_id"]:
                failures.append({
                    "id": row["id"], "name": row["plant_name"],
                    "reason": "no_species_link",
                    "hint": "Embedded and usable by the game, but it cannot train identification until the plant is linked to a species.",
                })
            await on_progress(i + 1, total)

    return {
        "checked": total, "embedded": embedded, "anchored": anchored + adopted,
        "adopted": adopted, "skipped_details": failures,
    }


async def _run_backfill_plant_types(db, params: dict, on_progress) -> dict:
    await on_progress(0, 1)
    rows = await db.execute_fetchall(
        "SELECT id, name, icon_key FROM plants "
        "WHERE is_active = 1 AND plant_type IS NULL AND icon_key IS NOT NULL"
    )
    from services.icon_catalog import load_catalog as _load_catalog
    catalog = await _load_catalog(db)
    cat_map = {e["id"]: e.get("cat", "houseplant") for e in catalog if e.get("id")}
    updated = 0
    details: list[dict] = []
    skipped_details: list[dict] = []
    for row in rows:
        cat = cat_map.get(row["icon_key"])
        if cat:
            await db.execute(
                "UPDATE plants SET plant_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (cat, row["id"]),
            )
            updated += 1
            details.append({
                "id": row["id"],
                "name": row["name"],
                "icon_key": row["icon_key"],
                "plant_type": cat,
            })
        else:
            skipped_details.append({
                "id": row["id"],
                "name": row["name"],
                "icon_key": row["icon_key"],
                "reason": "icon_key_not_in_catalog",
                "message": "Icon key is not present in the icon catalog",
            })
    await on_progress(1, 1)
    return {
        "found": len(rows),
        "updated": updated,
        "skipped": len(skipped_details),
        "details": details,
        "skipped_details": skipped_details,
    }


_JOB_RUNNERS = {
    "generate_icons":         _run_generate_icons,
    "backfill_thresholds":    _run_backfill_thresholds,
    "backfill_care_schedules": _run_backfill_care_schedules,
    "backfill_facts":         _run_backfill_facts,
    "backfill_names":         _run_backfill_names,
    "backfill_plant_types":   _run_backfill_plant_types,
    "backfill_species":       _run_backfill_species,
    "backfill_photo_embeddings": _run_backfill_photo_embeddings,
}


class StartJobRequest(BaseModel):
    kind: str
    params: dict = {}


@router.post("/admin-panel/jobs")
async def start_admin_job(
    body: StartJobRequest,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    runner = _JOB_RUNNERS.get(body.kind)
    if runner is None:
        raise HTTPException(status_code=400, detail=f"Unknown job kind: {body.kind!r}")
    if is_kind_running(body.kind):
        raise HTTPException(
            status_code=409,
            detail=f"A '{body.kind}' job is already queued or running",
        )
    params = dict(body.params)
    if body.kind in {"backfill_facts", "backfill_names", "generate_icons",
                     "backfill_species", "backfill_photo_embeddings"}:
        params["household_id"] = admin.get("household_id")
    started = await start_job(db, admin, body.kind, params, runner)
    job_id = started["job_id"]
    # Every tool in the panel runs through here, so this is the only place an
    # admin action can be recorded. The audit log used to see none of them: the
    # two endpoints that did call log_admin_action were the direct
    # generate-icons / backfill-facts routes, which nothing has called since the
    # panel moved to jobs (they are gone now).
    await log_admin_action(
        db, admin, "start_job",
        target=body.kind,
        detail={"job_id": job_id, "params": params},
    )
    return started


@router.get("/admin-panel/jobs")
async def list_admin_jobs(
    limit: int = Query(20, ge=1, le=100),
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    import json as _json

    rows = await db.execute_fetchall(
        """SELECT j.id, j.kind, j.status, j.progress_done, j.progress_total,
                  j.result, j.error,
                  CAST(j.created_at AS TEXT) as created_at,
                  CAST(j.updated_at AS TEXT) as updated_at,
                  a.name as admin_name
           FROM admin_jobs j
           LEFT JOIN accounts a ON j.account_id = a.id
           ORDER BY j.created_at DESC
           LIMIT ?""",
        (limit,),
    )
    result_rows = []
    for r in rows:
        row = _admin_row(r)
        result = row.get("result")
        if isinstance(result, str):
            try:
                row["result"] = _json.loads(result)
            except Exception:
                logger.warning("Failed to parse job result JSON (job kind=%s)", row.get("kind", "?"))
        result_rows.append(row)
    return result_rows


@router.get("/admin-panel/jobs/{job_id}")
async def get_admin_job(
    job_id: int,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    import json as _json

    rows = await db.execute_fetchall(
        """SELECT j.id, j.kind, j.status, j.progress_done, j.progress_total,
                  j.result, j.error,
                  CAST(j.created_at AS TEXT) as created_at,
                  CAST(j.updated_at AS TEXT) as updated_at,
                  a.name as admin_name
           FROM admin_jobs j
           LEFT JOIN accounts a ON j.account_id = a.id
           WHERE j.id = ?""",
        (job_id,),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Job not found")
    row = _admin_row(rows[0])
    result = row.get("result")
    if isinstance(result, str):
        try:
            row["result"] = _json.loads(result)
        except Exception:
            logger.warning("Failed to parse job result JSON for job %s", row.get("id", "?"))
    return row


@router.get("/admin-panel/anchors")
async def admin_anchors(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = None,
    filter: str = "all",
    sort: str = "created_at",
    direction: str = Query("desc", alias="dir"),
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """List user-confirmed image anchors for review (#940).

    Anchors are the labelled photos that can rescue a species during
    identification, so a mistaken or malicious confirmation becomes a
    permanent candidate for every household. This surface makes poisoning
    incidents visible: each row shows where the anchor came from and how many
    distinct source households back the species.
    """
    where: list[str] = []
    params: list[object] = []
    _add_search(where, params, q, ["ps.latin_name", "ps.common_name_nl", "h.name"])
    if filter == "unprovenanced":
        # Anchors whose source account is NULL can never be tied to a
        # household — under #940 they can never corroborate anything, so they
        # are the first candidates for review.
        where.append("u.source_account_id IS NULL")
    order_by = _sort_clause(
        sort,
        direction,
        {
            "id": "u.id",
            "species": "ps.latin_name",
            "household": "h.name",
            "created_at": "u.created_at",
        },
        "created_at",
        "desc",
    )
    return await _fetch_admin_page(
        db,
        select_sql="""
            SELECT
                u.id,
                u.species_id,
                u.source_account_id,
                u.source_photo_url,
                u.source_plant_id,
                ps.latin_name,
                ps.common_name_nl,
                a.household_id as source_household_id,
                h.name as source_household_name,
                a.email as source_account_email,
                (SELECT COUNT(DISTINCT a2.household_id)
                 FROM user_confirmed_embeddings u2
                 LEFT JOIN accounts a2 ON a2.id = u2.source_account_id
                 WHERE u2.species_id = u.species_id
                   AND a2.household_id IS NOT NULL) as backing_households,
                CAST(u.created_at AS TEXT) as created_at
        """,
        from_sql="""
            FROM user_confirmed_embeddings u
            JOIN plant_species ps ON ps.id = u.species_id
            LEFT JOIN accounts a ON a.id = u.source_account_id
            LEFT JOIN households h ON h.id = a.household_id
        """,
        where=where,
        params=params,
        order_by=order_by,
        limit=limit,
        offset=offset,
    )


@router.post("/admin-panel/anchors/{anchor_id}/retract")
async def admin_retract_anchor(
    anchor_id: int,
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Remove a single anchor from the identification pool (#940).

    The anchor disappears from every future blend as soon as the refs cache
    refreshes (at most _USER_REFS_CACHE_TTL_S in routers/plant_id).
    """
    from services.user_refs import retract_anchor

    removed = await retract_anchor(db, int(anchor_id))
    if not removed:
        raise HTTPException(status_code=404, detail="Anchor not found")
    await log_admin_action(
        db, admin, "retract_anchor",
        target=f"anchor/{anchor_id}",
        detail={"anchor_id": int(anchor_id)},
    )
    return {"ok": True, "anchor_id": int(anchor_id)}


@router.get("/admin-panel/audit")
async def admin_audit(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin=Depends(require_admin),
    db=Depends(db_dep),
):
    """Paginated audit log of all admin actions."""
    import json as _json

    total_row = await db.execute_fetchall("SELECT COUNT(*) as n FROM admin_audit_log")
    total = int(total_row[0]["n"])

    rows = await db.execute_fetchall(
        """SELECT al.id, al.action, al.target, al.detail,
                  CAST(al.created_at AS TEXT) as created_at,
                  a.email as admin_email, a.name as admin_name
           FROM admin_audit_log al
           LEFT JOIN accounts a ON al.account_id = a.id
           ORDER BY al.created_at DESC
           LIMIT ? OFFSET ?""",
        (limit, offset),
    )

    result_rows = []
    for r in rows:
        row = _admin_row(r)
        detail = row.get("detail")
        if isinstance(detail, str):
            try:
                row["detail"] = _json.loads(detail)
            except Exception:
                logger.warning("Failed to parse audit detail JSON for row id=%s", row.get("id", "?"))
        elif detail is None:
            row["detail"] = None
        result_rows.append(row)

    return {"rows": result_rows, "total": total}
