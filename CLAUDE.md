# Floreren — Plant Care PWA

Mobile-first PWA for Leon & Lisbeth (Amsterdam) to track plants, log care, and visualise their garden and indoor spaces. Built to eventually support other users with their own gardens.

**Agents: read `docs/agents/how-we-work.md` before your first change.** It is short. It covers how a change ships (a green PR auto-merges and deploys), what to ask Leon about first, and how parallel agents claim work and use worktrees.

## Dev

All commands run from the repo root:

```
npm run dev          # starts both frontend (port 5173) and backend (port 1415)
npm run dev:frontend
npm run dev:backend
```

Verify features in a desktop browser. Mobile testing not required during development.

**Frontend verification must run `npm run build` (Vite/rolldown), not just `tsc`.** `tsc` is lenient about JSX nesting (e.g. an unbalanced `</div>`) that Vite's rolldown parser rejects, so `tsc` can pass while the production build — and the Vercel deploy — fails. CI runs the build as the `Frontend · tsc + build` check; reproduce locally with `cd frontend && npm run build`.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| State | Zustand — `useFloreren` (FlorerStore) |
| Backend | FastAPI + Python + asyncpg (Neon PostgreSQL) |
| PWA | vite-plugin-pwa |

### Database

- **Postgres only** — SQLite was dropped; the backend requires `DATABASE_URL` (asyncpg) even for local dev. Set in `backend/.env`. Leftover `backend/*.db` SQLite files are unused.
- **Neon branches**: prod (Fly `DATABASE_URL` secret) uses the `production` branch (`ep-weathered-lake-al5q450z`); local dev uses the `dev` branch (`ep-crimson-darkness-alvzvh16`, created 2026-06-10 as a copy of production). Refresh dev data via "Reset from parent" in the Neon console. Alembic migrations reach **both** branches without anyone running them by hand: prod at every Fly deploy, dev via `.github/workflows/dev-migrate.yml` on every push to master that touches `backend/alembic/**`. That workflow also has a "Run workflow" button (`workflow_dispatch`) for the rare manual catch-up. **Only Leon can press it** — an agent's GitHub token has no `actions: write`, so `POST /actions/workflows/{id}/dispatches` returns `403 Resource not accessible by integration`. An agent that needs dev migrated outside the automatic path asks Leon to press the button; it cannot do it itself, and it does not get the credential instead — `DEV_DATABASE_URL` lives only in GitHub Actions. The workflow refuses to run unless the URL is the known dev endpoint. Never point `backend/.env` at the production branch.
- Routers use the legacy aiosqlite-style call surface via `services/db_adapter.py` (`DbAdapter`), which converts `?` placeholders to `$N`. **asyncpg is strict about parameter types**: pass `datetime`/`date` objects (naive UTC for `TIMESTAMP` columns), never `.isoformat()` strings, and `int` for INTEGER columns — strings/floats raise `DataError` at runtime (see #142).
- Schema migrations: Alembic (`backend/alembic/`); prod runs `alembic upgrade head` on every Fly deploy.

## Project structure

```
Floreren/
  frontend/src/
    pages/          # route-level components
    components/
      map/          # map view (read-only garden/indoor display)
      editor/       # layout editor (draw zones, rooms, walls)
      sheets/       # bottom sheet panels
      sun/          # sun position + heatmap overlays
    store/          # useFloreren.ts (Zustand)
    utils/          # coordinate math, sun calc, shadow geometry
    hooks/
  backend/
    routers/        # FastAPI route modules
    services/       # business logic (species_knowledge, garden_log, db_adapter, …)
    database/       # asyncpg pool + db_dep FastAPI dependency
    alembic/        # schema migrations
    models.py       # Pydantic response models
    main.py
```

## Routes

| Path | Page |
|---|---|
| `/maps` | Map list |
| `/maps/:id/edit-layout` | Layout editor |
| `/map/:slug` | Garden/indoor map view |
| `/dashboard` | Daily care overview |
| `/plants` | Plant list |
| `/calendar` | Planning calendar |
| `/settings` | Settings |

## Map system

### Map types

Every map has a `type: 'outdoor' | 'indoor'`:

- **garden** — outdoor space. Has `lat`, `lon`, compass `bearing` (direction the map's "up" points), and real-world dimensions. Sun overlay and shadow simulation apply.
- **indoor** — floor plan with rooms, walls, doors, windows. No GPS, no sun features.

### SVG canvas

- The SVG `viewBox` comes from `map.viewbox` in the DB — never hardcode it.
- The SVG scales to fill its container using `preserveAspectRatio="xMidYMid meet"` (letterbox).
- In landscape-mobile (`@media (orientation: landscape) and (max-height: 500px)`), `.landscape-mobile-hide` hides the BottomNav and the MapTopBar so the map fills the viewport.
- Scale is `PX_PER_M = 46` (46 px = 1 m). This will become per-map; do not assume it is fixed.

### MapPage layout (floating chrome)

The MapPage is a full-bleed map with four floating components on top:

- `MapTopBar` (top-left) — garden name + ⌄ menu (switch / settings)
- `MapActionCluster` (top-right) — icon-only actions, shrinks to 4 icons on mobile + ⋯ for the rest
- `GardenBiodiversityCard mode="pill"` (top-right, below cluster) — outdoor only; click opens full card as modal
- `MapBottomSheet` — peek state shows care-needs count; expanded shows `CareNeedsList` or, in sun mode, `SunControls`

The right-side sidebar and the top pill-toolbar were removed on 2026-05-27. See `docs/plans/2026-05-27-mappage-redesign-design.md`.

### Coordinate system

SVG coordinates are the source of truth. `screenToSVG()` converts pointer events to SVG space. Do not apply manual rotation transforms when computing coordinates.

### Shadow casters

Shadow casters are derived per-map from canvas data via `deriveAllShadowCasters()` in `utils/gardenFromCanvas.ts`. The function combines fence casters, structure casters (both computed from zones), and per-map `shadowCasters` stored in canvas data. The editor supports adding/editing/deleting shadow casters per map. Sun overlays (`SunDebugOverlay`, `SunDirectionArrow`, `SunHeatmap`, `DebugSvfOverlay`) now take `gardenBounds` (and bearing/lat/lon where relevant) as required per-map props — there is no hardcoded garden constant left. The remaining hardcoded scale is `PX_PER_M = 46` in `gardenStructures.ts`; it is still assumed fixed across maps.

## New garden onboarding

When a user creates a new garden, the minimum required fields are:
- Name
- Dimensions (width × depth in metres)
- GPS location (lat/lon) — for sun position
- Compass bearing of the map's "up" direction

Indoor maps only need a name and dimensions.

## Users

JWT-based auth (`jose` library, `sub=account_id`). Accounts belong to one Household. Leon's garden: Amsterdam, 52.3715°N 4.8499°E.

## Languages (NL/EN)

The app is fully bilingual Dutch/English; `accounts.language` ('nl'|'en') drives the UI. Rules for **every** user-facing feature (2026-07 language audit — a big NL/EN-mixing cleanup — is the origin of all of these):

- **Frontend strings go through the typed catalog** — `useT()` + `src/i18n/{translations,en,nl}.ts`. The `Translations` type forces en/nl parity. Never hardcode user-facing text in JSX: CI runs an i18n guard (`npm run lint:i18n`, `frontend/eslint.i18n.config.js`). Pre-existing offenders are baselined in that config's ignore list — when you touch a baselined file, translate its strings and remove it from the list; the list must only shrink.
- **Backend never invents Dutch sentences.** User-facing `HTTPException` details must be localized to the request's `?lang=` (see `_msg()` in `routers/plant_id.py`); long-term prefer machine-readable error codes translated client-side. The frontend must branch on HTTP status (the api client attaches `.status` to thrown errors), never on message text.
- **Bilingual data is written bilingual.** Species/content columns come in `*_nl`/`*_en` pairs; LLM generation must always produce both languages in one call. Never cross-fill languages silently at read time — generate the missing language instead, and only persist genuinely bilingual pairs (see `get_species_fun_fact`).
- **Language flows explicitly**: `/plants/identify` and `/plants/identify/commit` take `?lang=`; commit returns localized `name_suggested` (`name_nl_suggested` is deprecated). The public share page (`/s/{token}`) renders in the **sharer's** account language.
- **Place names are endonyms** (reverse geocode without `accept-language`): one stored `place_name` serves both languages.
- **Verify new UI in English too.** Development is Dutch-first, so English-mode bugs are invisible unless you flip your account language to `en` and click through the feature once.

## Deployment

**Stack:** frontend → **Vercel** (`floreren.app`), backend → **Fly.io** (`api.floreren.app`). Cloudflare is **DNS + the bioclip tunnel only** — there is **no Cloudflare Workers/Pages** build for this repo. (If a "Workers Builds" check ever reappears on a PR, a Cloudflare Git integration got reconnected by accident — disconnect it in Cloudflare → Workers & Pages, don't add a wrangler config.)

### Backend — Fly.io

App: `floreren-api`, region `ams`, `shared-cpu-1x` / 256 MB. Neon Postgres (connection string in Fly secrets). Release command runs `alembic upgrade head` on every deploy.

```bash
# Set a secret (auto-restarts machines)
flyctl secrets set KEY=value -a floreren-api --remote-only

# Deploy (builds Docker image, rolls new machines)
flyctl deploy -a floreren-api --remote-only

# Liveness — is the process serving? (no DB; this is what Fly's check polls)
curl https://floreren-api.fly.dev/health

# Readiness — can it reach Neon? 503 + {"database":"unavailable"} when not
curl https://floreren-api.fly.dev/health/ready
```

Fly binary: `~/.fly/bin/flyctl` (export PATH). Never use `--local-only` — always `--remote-only`.

**Liveness must never touch the database.** It used to run `SELECT 1`, which
made a Neon outage a total outage: the check failed, Fly pulled the machine
from rotation, and the edge returned an empty 503 with no CORS headers — so the
browser blamed CORS and the real cause was invisible. A restart cannot fix an
unreachable database. Use `/health/ready` for that, and read it as a report,
not as rotation input.

### Neon compute — what actually burns it

Neon bills **compute-time**, not queries, and suspends only while **no
connection is open**. Two things used to guarantee it never suspended, and
together they exhausted a month's quota in about 4½ idle days (2026-09-18):

| cause | effect |
|---|---|
| `create_pool(min_size=1)` | one connection held open forever |
| `/health` running `SELECT 1` | a query every 30s, round the clock |

Both are fixed (`min_size=0`, DB-free liveness). `min_machines_running = 1`
stays as it is — it is there so in-process admin jobs are not killed mid-run,
and with an idle pool a running machine now costs Neon nothing. When adding
anything that polls on a timer, remember it wakes Neon for minutes, not
milliseconds: `BIOCLIP_SYNC_INTERVAL_S` (6h) and the digest cron are the only
periodic DB touches left.

Key Fly secrets:
| Secret | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET` | JWT signing key |
| `BIOCLIP_WORKER_URL` | `https://bioclip.floreren.app` — remote GPU worker |
| `BIOCLIP_WORKER_TOKEN` | Shared secret sent as `X-Worker-Token`; the worker rejects `/identify`, `/embed-image`, `/embed-text` and `/coverage` without it. Must match the Windows worker's env var of the same name. |
| `BIOCLIP_SYNC_INTERVAL_S` | Catalog-sync loop interval (default `21600` = 6h; `0` disables). |
| `NOUS_API_KEY` | LLM calls (care thresholds, species, icon generation) via Nous Portal. Models are pinned to dated builds in `backend/llm_config.py` — DeepSeek V4 Pro `-0813` for general calls, Flash for phenology/fun facts — and overridable per environment via `LLM_MODEL` etc. A bare id like `deepseek-v4-pro` is *not* "latest"; the gateway resolves it to a fixed older snapshot, so pin the date. |
| `RESEND_API_KEY` | Transactional email |
| `PLANTNET_API_KEY` | PlantNet fallback identification |
| `R2_*` | Cloudflare R2 for image uploads |

Image storage is chosen by `STORAGE_BACKEND` (`services/storage.py`): `r2` (default, the `R2_*` secrets above) or `local` for self-hosting — files under `LOCAL_STORAGE_DIR`, served by the backend itself at the path of `LOCAL_STORAGE_PUBLIC_BASE_URL` (e.g. `https://example.com/media`). Production on Fly leaves it unset.

### Frontend — Vercel

```bash
cd frontend
npx vercel deploy --prod --yes           # deploys production build
npx vercel alias <deploy-url> floreren.app  # point domain to new deploy
```

## Error icon

- **`frontend/public/icons/error-plant.svg`** — custom error icon (burning plant in terracotta pot with flames and smoke). Used by `ErrorBoundary.tsx` as fallback when a page crashes.
- Registered in `manifest.json` for offline/icon consistency.
- Replaces the old plain 🌱 emoji that showed on error pages.

## Bulk archive (Plants page)

- **Select mode** on `/plants`: toggle with "Selecteer" button in header (desktop & mobile).
- Checkboxes appear on each PlantCard; selected cards get a visible outline.
- Floating bottom bar shows count, "Annuleren" and "Archiveer (N)" buttons.
- **Backend**: `POST /api/plants/bulk-archive` with `{ plant_ids: number[] }` body. Soft-deletes (`is_active = false`).
- **Route order critical**: the lettered path `bulk-archive` MUST be defined **before** `{plant_id}` in `backend/routers/plants.py`, or FastAPI matches the param route and returns 405.
- Frontend: `api.client.ts` → `bulkArchive()`, `useFloreren.ts` → `bulkArchivePlants()`, `Plants.tsx` → select mode + floating bar.

### BioCLIP Worker

Runs **natively on Windows** (Leon's desktop, AMD Ryzen 7 5800X, RTX 2070, 16 GB), bound to **`127.0.0.1:8001`** (loopback only — cloudflared reaches it via localhost) — no WSL. Health: `GET /health` → `{"status":"ok","model_loaded":true,"embeddings_loaded":true,"device":"cuda"}` (health is unauthenticated).

**Auth:** `/identify`, `/embed-image`, `/embed-text` and `/coverage` require the `X-Worker-Token` header to match the worker's `BIOCLIP_WORKER_TOKEN` env var (set as a persistent user env var via `setx`, inherited by the scheduled task; mirrors the Fly secret of the same name). If `BIOCLIP_WORKER_TOKEN` is unset on the worker, auth is disabled (dev fallback). GPU inference is serialized behind an async lock and runs in a threadpool so health checks stay responsive.

The Fly backend offloads plant identification to this worker via `BIOCLIP_WORKER_URL`. When the env var is set (production), `main.py` skips local BioCLIP preloading — the backend image does not include torch/open_clip.

**Catalog sync (#866).** The reference set (`backend/data/bioclip/species_embeddings.npy`) is no longer only rebuilt by a manual `scripts/precompute_embeddings.py` run. `plant_species.embedded_at IS NULL` marks a species as queued (new rows — e.g. a species first seen through a PlantNet correction — start that way), and `services/bioclip_catalog_sync.py` pushes the queue to the worker's `POST /embed-text`, which appends to the live matrix and persists it atomically. It runs on every identify commit, every `BIOCLIP_SYNC_INTERVAL_S` from `main.py`, and on demand via `POST /admin-panel/bioclip/sync`; the periodic pass also diffs against `/coverage` and re-queues anything the worker lost. Full-catalog rebuilds (prompt changes, model swaps) are still the batch script's job.

**User-confirmed anchors (#866).** `user_confirmed_embeddings` holds real photos labelled by their owner; `_blend_scores` matches new photos against them image-to-image, strongly enough to rescue a species the text ranking missed. `services/user_refs.py` is the single write path: `/identify/commit` and every journal photo of a species-linked plant (the embedding the photo sanity-check already computes) go through `add_anchor`, which dedupes near-identical photos (cosine ≥ 0.98) and caps a species at 20 anchors, evicting the oldest. Anchors are retracted when the photo is deleted or the plant is re-identified as something else — a stale anchor keeps pulling future photos towards a label the user rejected. Note the identify read path caches anchors for 5 minutes, so a retraction takes effect within that window.

**Identify telemetry (#866).** `identify_log` records what the engine led with (`top_species_id`/`top_confidence`) and, once `/identify/commit` runs with the `identify_id` the identify response returned, what the user actually kept (`chosen_species_id`/`chosen_source`/`committed_at`). `GET /admin-panel/growth-metrics` rolls that into `identify_outcomes`: accepted vs missed BioCLIP identifies, the miss rate, and the species users had to reach past BioCLIP to find — the ranked list of what the catalog still lacks.

**Runtime / startup** (migrated WSL → Windows-native 2026-06-07):

| Item | Detail |
|---|---|
| Python env | uv-managed venv `backend\.venv` on **Python 3.12** (Win Python 3.14 has no torch wheels) |
| Key deps | `torch 2.6.0+cu124` + torchvision, `open-clip-torch`, fastapi, uvicorn, **`python-multipart`** (required by the `UploadFile` endpoints) |
| Launcher | `C:\Users\leon_\Scripts\start-floreren-workers.ps1` — `Start-Process` on the venv python, hidden, port 8001 |
| Autostart | scheduled task **"Floreren Workers"** (AtLogon + AtStartup); (re)register via `C:\Users\leon_\Scripts\register-task.ps1` **elevated** (AtStartup needs admin) |
| Worker log | `C:\Users\leon_\Scripts\bioclip-worker.log` (+ `.err`) |

### Cloudflare Tunnel (bioclip.floreren.app)

Permanent named tunnel exposing the BioCLIP worker securely to the internet. Setup:

| Component | Detail |
|---|---|
| Tunnel name | `bioclip-worker` |
| Tunnel ID | `d3e07eaa-19d7-43a7-9314-5526adb16173` |
| Domain | `bioclip.floreren.app` |
| DNS | CNAME → `d3e07eaa-19d7-43a7-9314-5526adb16173.cfargotunnel.com` (proxied) |
| Service | Windows service `Cloudflared` — auto-starts at boot |
| Config path | `C:\Windows\System32\config\systemprofile\.cloudflared\config.yml` |
| Ingress | `bioclip.floreren.app` → `http://localhost:8001`, default → 404 |

**Config file** (`config.yml`):
```yaml
tunnel: d3e07eaa-19d7-43a7-9314-5526adb16173
credentials-file: C:\Windows\System32\config\systemprofile\.cloudflared\d3e07eaa-19d7-43a7-9314-5526adb16173.json

ingress:
  - hostname: bioclip.floreren.app
    service: http://localhost:8001
  - service: http_status:404
```

**Windows service management:**
```cmd
sc query Cloudflared       # check status
sc stop Cloudflared        # stop
sc start Cloudflared       # start
taskkill /F /IM cloudflared.exe   # force kill if hung
```

**Tunnel lifecycle** (if re-creating from scratch):
```cmd
cloudflared tunnel login                  # one-time: browser auth, saves cert.pem
cloudflared tunnel create bioclip-worker  # creates credentials JSON
cloudflared tunnel route dns bioclip-worker bioclip.floreren.app
cloudflared service install               # registers as Windows service
```

Credentials (`cert.pem`, `config.yml`, `<tunnel-id>.json`) must live in BOTH:
- `%USERPROFILE%\.cloudflared\` (for `cloudflared tunnel` CLI commands)
- `C:\Windows\System32\config\systemprofile\.cloudflared\` (for the `LocalSystem` service)

### DNS

`floreren.app` on Cloudflare (NS: `emerie.ns.cloudflare.com`, `garrett.ns.cloudflare.com`). Apex → Vercel. `api.floreren.app` → Fly. `bioclip.floreren.app` → Cloudflare Tunnel (CNAME proxied).

## Agent skills

Matt Pocock's engineering + productivity skills are installed globally
(`~/.claude/skills/`). `docs/agents/how-we-work.md` §7 maps each skill to a workflow
step; the three configs below tell those skills Floreren's specifics.

### Issue tracker

Issues live in GitHub Issues (`leo4226/groei-app`). See `docs/agents/issue-tracker.md`.

### Triage labels

`needs-triage`, `needs-info`, `ready`, `needs-plan`, `wontfix`, plus `difficulty: …` and the `in-progress` claim. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` (glossary) at repo root; ADRs/specs archived in
`docs/archive/`, active plans & designs in `docs/plans/` (there is no `docs/adr/`). See
`docs/agents/domain.md`.
