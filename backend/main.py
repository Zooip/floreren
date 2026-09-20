import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
import asyncio

from services.calendar_feed_log_redaction import CalendarFeedAccessLogFilter

logging.basicConfig(level=logging.INFO)
logging.getLogger("uvicorn.access").addFilter(CalendarFeedAccessLogFilter())
_log = logging.getLogger("floreren")

# Let the app finish booting (and the worker finish loading its model) before
# the first catalog reconcile — it is a safety net, never a startup dependency.
_BIOCLIP_SYNC_STARTUP_DELAY_S = 120

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import init_pool, close_pool, get_db
from routers import users, locations, plants, objects, care, maps, ground_zones
from routers import plant_care, species, spots, icons
from routers import admin, alerts, weed_catalog, weed_sightings, auth, calendar
from routers import care_rhythm, calendar_subscription
from routers import admin_panel
from routers import warnings as warnings_router
from routers import plant_id as plant_id_router
from routers import household
from routers import weather as weather_router
from routers import chat as chat_router
from routers import bug_report as bug_report_router
from routers import notifications as notifications_router
from routers import plant_photos as plant_photos_router
from routers import watchdog as watchdog_router
from routers import export as export_router
from routers import game as game_router
from routers import discoveries as discoveries_router
from routers import quiz as quiz_router
from routers import study as study_router
from routers import share as share_router
from routers import atlas as atlas_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()

    # Mark any admin jobs that were left in running/pending state as interrupted.
    from services.job_runner import mark_stale_jobs_interrupted
    async with get_db() as _db:
        await mark_stale_jobs_interrupted(_db)

    # Preload BioCLIP in background (first load downloads from HF Hub, ~60s).
    # Skipped when BIOCLIP_WORKER_URL is set — on Fly we offload to the remote
    # GPU worker and don't ship torch/open_clip in the image.
    async def _preload_bioclip():
        try:
            from services.bioclip_id import get_service

            def _load():
                svc = get_service()
                svc.load_model()
                svc.load_embeddings()
                return svc

            loop = asyncio.get_event_loop()
            svc = await loop.run_in_executor(None, _load)
            _log.info("BioCLIP preloaded: %d species on %s", len(svc._species_ids), svc._device)
        except Exception as exc:
            _log.warning("BioCLIP preload failed (lazy-load on request): %s", exc)

    if not os.environ.get("BIOCLIP_WORKER_URL"):
        asyncio.ensure_future(_preload_bioclip())

    # Keep the worker's identification catalog in step with plant_species (#866).
    # Species created from a PlantNet-corrected identify are queued
    # (embedded_at IS NULL); the commit handler drains the queue immediately and
    # this loop is the safety net — it also repairs drift after a worker rebuild
    # by diffing against /coverage. Set BIOCLIP_SYNC_INTERVAL_S=0 to disable.
    sync_task: asyncio.Task | None = None

    async def _bioclip_catalog_sync_loop(interval_s: int):
        from services.bioclip_catalog_sync import reconcile

        await asyncio.sleep(_BIOCLIP_SYNC_STARTUP_DELAY_S)
        while True:
            try:
                async with get_db() as _db:
                    result = await reconcile(_db)
                if result.get("embedded") or result.get("requeued"):
                    _log.info("BioCLIP catalog sync: %s", result)
            except Exception as exc:
                _log.warning("BioCLIP catalog sync failed: %s", exc)
            await asyncio.sleep(interval_s)

    _sync_interval = int(os.environ.get("BIOCLIP_SYNC_INTERVAL_S", "21600"))
    if os.environ.get("BIOCLIP_WORKER_URL") and _sync_interval > 0:
        sync_task = asyncio.ensure_future(_bioclip_catalog_sync_loop(_sync_interval))

    yield
    if sync_task is not None:
        sync_task.cancel()
    await close_pool()


app = FastAPI(title="Floreren", version="0.1.0", lifespan=lifespan)

_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|https://floreren\.app|https://www\.floreren\.app|https://.*fly\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — catches all unhandled exceptions so the API
# always returns a proper JSON error with CORS headers instead of a raw 500.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    _log.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={"Access-Control-Allow-Origin": "*"},
    )

# Liveness for Fly.io. Deliberately does NOT touch the database.
#
# It used to run `SELECT 1`, which turned every database outage into a total
# one: the check failed, Fly pulled the machine out of rotation, and the edge
# answered every request with an empty 503 — no body, no CORS headers, so the
# browser reported it as a CORS error and the real cause (a spent Neon quota)
# was invisible from the app.
#
# A restart cannot fix an unreachable database, so liveness must not depend on
# one. It answers one question: is this process still serving? Keeping the
# machine in rotation lets the API return a real error with real headers, which
# a client can read and explain.
#
# It also queried the database every 30 seconds, round the clock, which by
# itself was enough to stop Neon's compute ever auto-suspending. See
# `/health/ready` for the database check.
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/ready")
async def health_ready():
    """Readiness: can this process actually reach the database?

    For humans and uptime monitors, not for Fly's rotation. Returns 503 with a
    readable body rather than failing the liveness check.
    """
    try:
        async with get_db() as db:
            await db.execute_fetchall("SELECT 1")
    except Exception as exc:
        _log.warning("Readiness check failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "unavailable"},
        )
    return {"status": "ok", "database": "ok"}


# Prewarm target: the frontend fires this (fire-and-forget, unauthenticated)
# when the identify camera opens, so a sleeping Fly machine (~9s cold start,
# min_machines_running=0) is awake by the time the photo is taken. No DB
# touch — waking the process is the whole point.
@app.get("/api/ping")
async def ping():
    return {"ok": True}


# Mount routers
app.include_router(users.router, prefix="/api")
app.include_router(locations.router, prefix="/api")
app.include_router(plants.router, prefix="/api")
app.include_router(objects.router, prefix="/api")
app.include_router(care.router, prefix="/api")
app.include_router(maps.router, prefix="/api")
app.include_router(ground_zones.router, prefix="/api")
app.include_router(plant_care.router, prefix="/api")
app.include_router(species.router, prefix="/api")
app.include_router(spots.router, prefix="/api")
app.include_router(icons.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(admin_panel.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(weed_catalog.router, prefix="/api")
app.include_router(weed_sightings.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(care_rhythm.router, prefix="/api")
app.include_router(calendar_subscription.router, prefix="/api")
app.include_router(warnings_router.router, prefix="/api")
app.include_router(plant_id_router.router, prefix="/api")
app.include_router(household.router, prefix="/api")
app.include_router(weather_router.router, prefix="/api")
app.include_router(chat_router.router, prefix="/api")
app.include_router(bug_report_router.router, prefix="/api")
app.include_router(notifications_router.router, prefix="/api")
app.include_router(plant_photos_router.router, prefix="/api")
app.include_router(watchdog_router.router, prefix="/api")
app.include_router(export_router.router, prefix="/api")
app.include_router(game_router.router, prefix="/api")
app.include_router(discoveries_router.router, prefix="/api")
app.include_router(quiz_router.router, prefix="/api")
app.include_router(study_router.router, prefix="/api")
# Public share pages live at the root (floreren.app/s/* rewrites here), not /api.
app.include_router(share_router.router)
# Public garden atlas — anonymous browse surface for opt-in gardens (/api/atlas).
app.include_router(atlas_router.router, prefix="/api")

# Serve the built frontend (production mode)
_frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"

if _frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        candidate = _frontend_dist / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_frontend_dist / "index.html")
