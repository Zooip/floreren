import type { User, Location, Plant, PlantCreateInput, CareScheduleInput, CareLogEntry, RecentLogEntry, MapInfo, MapDetail, MapPlant, MapObject, MapItems, SecondaryMarker, ObjectCreateInput, GroundZone, PlantIcon, IconSyncResult, IconGapReport, PlantAlert, AlertSummary, PlantFactOut, RecommendationsOut, GardenSuggestionsOut, PublicGardenSummary, PublicGardenDetail } from '../types'
import { indexIconUrls } from '../utils/icons'
import { withNetworkRetry } from './retry'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// ── Generic typed API client ──

type ApiOptions = {
  body?: unknown
  form?: FormData
  params?: Record<string, string>
  signal?: AbortSignal
}

/** Machine-readable outages the API names, so the app can explain itself.
 *
 *  Not prose: the backend sends a stable code and the wording lives here, in
 *  the reader's language. A spent database quota is the one worth spotting —
 *  it is not a bug, a retry will not fix it, and it used to arrive as an
 *  indistinguishable failure that sent us looking for a bug in the app. */
export type OutageCode = 'database_quota_exceeded' | 'database_unavailable'

const OUTAGE_CODES: OutageCode[] = ['database_quota_exceeded', 'database_unavailable']

let outageListener: ((code: OutageCode) => void) | null = null

/** Register the banner. One listener: this is a single app-wide condition. */
export function onApiOutage(listener: ((code: OutageCode) => void) | null) {
  outageListener = listener
}

async function ensureOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return
  let msg = fallback
  let code: OutageCode | undefined
  try {
    const body = await res.json()
    if (body.detail) msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    if (res.status === 503 && OUTAGE_CODES.includes(body.detail)) {
      code = body.detail as OutageCode
      outageListener?.(code)
    }
  } catch { /* keep fallback */ }
  // Carry the HTTP status so callers can branch on it instead of matching
  // (language-dependent) detail strings.
  throw Object.assign(new Error(msg), { status: res.status, outage: code })
}

function buildUrl(path: string, params?: Record<string, string>) {
  return BASE + path + (params ? '?' + new URLSearchParams(params) : '')
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('floreren-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handleAuthErrors(res: Response): Promise<void> {
  if (res.status === 401) {
    localStorage.removeItem('floreren-token')
    window.location.href = '/login'
    throw Object.assign(new Error('Session expired — redirecting to login'), { status: res.status })
  }

  if (res.status === 403) {
    let detail = 'Forbidden'
    try { const body = await res.json(); if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail) } catch {}
    // Carry the HTTP status so callers can branch on it instead of matching
    // (language-dependent) detail strings — same contract as ensureOk.
    throw Object.assign(new Error(detail), { status: res.status })
  }
}

export async function apiRequest<T>(method: string, path: string, options: ApiOptions = {}): Promise<T> {
  const url = buildUrl(path, options.params)
  const headers = authHeaders()

  const init: RequestInit = { method, headers }
  if (options.signal) init.signal = options.signal
  if (options.form) {
    init.body = options.form
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url, init)
  await handleAuthErrors(res)
  await ensureOk(res, `Failed: ${method} ${path}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function apiBlob(path: string, options: { params?: Record<string, string> } = {}): Promise<Blob> {
  const res = await fetch(buildUrl(path, options.params), {
    method: 'GET',
    headers: authHeaders(),
  })
  await handleAuthErrors(res)
  await ensureOk(res, `Failed: GET ${path}`)
  return res.blob()
}

/** Retry transient network errors (TypeError from fetch). */
async function apiWithTimeout<T>(method: string, path: string, options: ApiOptions = {}, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await api<T>(method, path, { ...options, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Request timed out')
    }
    throw e
  } finally {
    window.clearTimeout(timeout)
  }
}

async function api<T>(method: string, path: string, options: ApiOptions = {}): Promise<T> {
  return withNetworkRetry(() => apiRequest<T>(method, path, options))
}

// ── Exported local types ──

export interface GardenWaterStatus {
  status: 'hydrated' | 'thirsty' | 'dry'
  rain_7day_mm: number
  rain_14day_mm: number
  weekly_budget_mm: number
  biweekly_budget_mm: number
  season: string
  watered_at: string | null
}

export interface GardenFertilizeStatus {
  fertilized_at: string | null
  pending_count: number
}

export interface AISuggestion {
  commonName: string
  latinName: string
  dutchName: string
  sunFit: 'perfect' | 'good' | 'acceptable'
  reasoning: string
  caveat: string | null
  companionNote: string | null
}
export interface GrowHereResponse { suggestions: AISuggestion[]; spotSummary: string }

export interface AdminAccount {
  id: number
  email: string
  name: string
  is_admin: boolean
  created_at: string
  household_name: string
}

export interface AccountMe {
  id: number
  household_id: number
  email: string
  name: string
  avatar: string | null
  is_admin: boolean
  household_name: string
  role: 'owner' | 'editor' | 'viewer'
  capabilities: {
    can_edit: boolean
    can_manage_household: boolean
  }
}

export interface AdminUserRow {
  id: number
  name: string
  email: string
  is_admin: boolean
  created_at: string
  household_id: number
  household_name: string
  plant_count: number
  map_count: number
  last_activity: string | null
}

export interface AdminActivityEvent {
  kind: string
  label: string
  household: string
  ts: string | null
}

export interface AdminOverview {
  total_accounts: number
  total_plants: number
  total_maps: number
  missing_icons: number
  recent_accounts: AdminUserRow[]
  recent_activity: AdminActivityEvent[]
}

export interface AdminGrowthMetricPoint {
  date: string
  count: number
}

export interface AdminGrowthDeltas {
  signups: number
  plants_added: number
  care_logs: number
  active_households: number
  identifies: number
}

export interface AdminTopIdentifier {
  household: string
  count: number
}

export interface AdminGrowthMetrics {
  days: number
  metrics: {
    signups: AdminGrowthMetricPoint[]
    plants_added: AdminGrowthMetricPoint[]
    care_logs: AdminGrowthMetricPoint[]
    active_households: AdminGrowthMetricPoint[]
    identifies: AdminGrowthMetricPoint[]
  }
  deltas: AdminGrowthDeltas
  top_identifiers: AdminTopIdentifier[]
}

export type AdminHealthStatus = 'ok' | 'degraded' | 'down' | 'unconfigured'

export interface AdminServiceHealth {
  status: AdminHealthStatus
  latency_ms: number | null
  detail: string
}

export interface AdminSystemHealth {
  database: AdminServiceHealth
  bioclip: AdminServiceHealth
  r2: AdminServiceHealth
  llm: AdminServiceHealth
  email: AdminServiceHealth
}

export interface AdminCoveragePlantRow {
  id: number
  name: string
  species: string | null
  species_id: number | null
  icon_key: string | null
  plant_type: string | null
}

export interface AdminCoverageSpeciesRow {
  id: number
  common_name_nl: string | null
  latin_name: string | null
}

export interface AdminCoverageSpeciesGap {
  id: number
  common_name_nl: string | null
  common_name_en: string | null
  latin_name: string | null
  in_use: boolean
  missing_name_nl: boolean
  missing_name_en: boolean
  missing_latin: boolean
  missing_facts_nl: boolean
  missing_facts_en: boolean
  missing_thresholds: boolean
  missing_phenology: boolean
}

export interface AdminCoverage {
  plants: {
    active_total: number
    missing_species_link: number
    missing_species_link_rows: AdminCoveragePlantRow[]
  }
  species: {
    total: number
    missing_latin_name: number
    missing_common_name_nl: number
    missing_common_name_en: number
    missing_phenology: number
    missing_facts_nl: number
    missing_facts_en: number
    missing_thresholds: number
    incomplete?: number
  }
  species_gaps?: AdminCoverageSpeciesGap[]
  icons: {
    active_missing_icon: number
    active_stale_icon_key: number
    archived_stale_icon_key: number
    missing_plant_type: number
    active_stale_icon_rows: AdminCoveragePlantRow[]
    archived_stale_icon_rows: AdminCoveragePlantRow[]
  }
  bioclip: {
    status: AdminHealthStatus
    detail: string | null
    embedded_species: number
    db_species_missing_from_bioclip: number
    active_plants_missing_from_bioclip: number
    missing_species_rows: AdminCoverageSpeciesRow[]
  }
}

export interface AdminSkippedDetail {
  id?: number
  species_id?: number
  name?: string
  icon_key?: string
  reason?: string
  message?: string
  error?: string
  /** What the admin can do about it, written by the backend runner. */
  hint?: string
}

/**
 * `count` is SPECIES a run would draw; `blocked` is PLANTS it cannot reach at
 * all (no species link, or a species with no latin name). Settings counts
 * plants, so the two screens legitimately differ — `blocked` is what explains
 * the gap.
 */
export interface AdminIconPreview {
  scope: string
  map_only: boolean
  count: number
  blocked: AdminSkippedDetail[]
  blocked_count: number
}

export type AdminFactsScope = 'all' | 'in_use'

export interface AdminBackfillFactsResult {
  processed: number
  updated: number
  skipped: number
  errors: Array<{ species_id: number; name: string; error: string }>
  skipped_details?: AdminSkippedDetail[]
  scope?: AdminFactsScope
  map_only?: boolean
  remaining?: number
}

export interface AdminBackfillFactsPreview {
  scope: AdminFactsScope
  map_only: boolean
  total_species: number
  missing_facts: number
  missing_facts_nl?: number
  missing_facts_en?: number
}

export interface AdminBackfillNamesPreview {
  scope: AdminFactsScope
  map_only: boolean
  total_species: number
  missing_names: number
  missing_names_nl: number
  missing_names_en: number
  missing_latin: number
}

export interface AdminBackfillPlantTypesResult {
  status?: string
  found: number
  updated: number
  skipped: number
  details?: Array<{ id: number; name: string; icon_key: string; plant_type: string }>
  skipped_details?: AdminSkippedDetail[]
}

export interface AdminPlantRow {
  id: number
  name: string

  species: string | null
  icon_key: string | null
  phase: string
  icon_requested: boolean
  has_thresholds: boolean
  household_name: string
  created_at: string
}

export interface AdminHouseholdDetail {
  id: number
  name: string
  created_at: string
  accounts: Array<{ id: number; name: string; email: string; is_admin: boolean; created_at: string }>
  maps: Array<{ id: number; name: string; map_type: string; plant_count: number }>
  plants: Array<{ id: number; name: string; species: string | null; icon_key: string | null; phase: string | null; has_thresholds: boolean; created_at: string }>
  care_log: Array<{ id: number; plant_name: string; care_type: string; done_at: string }>
}

export interface AdminSpeciesRow {
  id: number
  common_name_nl: string
  latin_name: string | null
  has_thresholds: boolean
  has_latin_name: boolean
  plant_count: number
}

export interface AdminPagedResponse<T> {
  rows: T[]
  total: number
}

export interface AdminTableParams {
  limit?: number
  offset?: number
  q?: string
  sort?: string
  dir?: 'asc' | 'desc'
  filter?: string
}

function adminTableParams(params: AdminTableParams = {}): Record<string, string> {
  const out: Record<string, string> = {}
  if (params.limit != null) out.limit = String(params.limit)
  if (params.offset != null) out.offset = String(params.offset)
  if (params.q?.trim()) out.q = params.q.trim()
  if (params.sort) out.sort = params.sort
  if (params.dir) out.dir = params.dir
  if (params.filter && params.filter !== 'all') out.filter = params.filter
  return out
}

// ── Domain namespaces ──

export const users = {
  list:        ()                                          => api<User[]>('GET', '/users'),
  locations:   ()                                          => api<Location[]>('GET', '/locations'),
  updateLocation: (id: number, data: Partial<Location>)         => api<Location>('PATCH', `/locations/${id}`, { body: data }),
  deleteLocation: (id: number, lang: 'nl' | 'en' = 'nl')         => api<{ok: boolean}>('DELETE', `/locations/${id}`, { params: { lang } }),
  setLanguage: (userId: number, language: 'nl' | 'en')   => api<User>('PATCH', `/users/${userId}/language`, { body: { language } }),
  updateUser:  (userId: number, data: { name?: string; avatar?: string }) => api<User>('PATCH', `/users/${userId}`, { body: data }),
}

export const plants = {
  list:              ()                                            => api<Plant[]>('GET', '/plants'),
  get:               (id: number)                                  => api<Plant>('GET', `/plants/${id}`),
  create:            (data: PlantCreateInput)                      => api<Plant>('POST', '/plants', { body: data }),
  update:            (id: number, data: Partial<Plant>)            => api<Plant>('PUT', `/plants/${id}`, { body: data }),
  archive:           (id: number)                                  => api<void>('DELETE', `/plants/${id}`),
  bulkArchive:       (ids: number[])                               => api<{ok: boolean; count: number}>('POST', '/plants/bulk-archive', { body: { plant_ids: ids } }),
  restore:           (id: number)                                  => api<void>('PATCH', `/plants/${id}/restore`),
  uploadPhoto:       (plantId: number, file: File)                 => { const f = new FormData(); f.append('file', file); return api<Plant>('POST', `/plants/${plantId}/photo`, { form: f }) },
  setPosition:       (plantId: number, data: { map_id: number; map_x: number; map_y: number; ground_zone_id: null }) => api<Plant>('PUT', `/plants/${plantId}/position`, { body: data }),
  setContainer:      (plantId: number, containerId: number | null) => api<Plant>('PUT', `/plants/${plantId}/container`, { body: { container_id: containerId } }),
  setGroundZone:     (plantId: number, groundZoneId: string | null, mapX: number | null, mapY: number | null) => api<Plant>('PUT', `/plants/${plantId}/ground-zone`, { body: { ground_zone_id: groundZoneId, map_x: mapX, map_y: mapY } }),
  setRadius:         (plantId: number, display_radius_cm: number | null) => api<void>('PUT', `/plants/${plantId}`, { body: { display_radius_cm } }),
  setLock:           (plantId: number, locked: boolean)            => api<void>('PATCH', `/plants/${plantId}/lock`, { params: { locked: String(locked) } }),
  duplicate:         (plantId: number)                             => api<Plant>('POST', `/plants/${plantId}/duplicate`),
  addPlacement:      (plantId: number, data: { map_id: number; map_x: number; map_y: number; ground_zone_id?: string | null; phase?: string | null }) => api<SecondaryMarker>('POST', `/plants/${plantId}/placements`, { body: data }),
  updatePlacement:   (plantId: number, placementId: number, data: { map_x?: number; map_y?: number; ground_zone_id?: string | null; phase?: string | null }) => api<SecondaryMarker>('PATCH', `/plants/${plantId}/placements/${placementId}`, { body: data }),
  deletePlacement:   (plantId: number, placementId: number)        => api<{ ok: boolean }>('DELETE', `/plants/${plantId}/placements/${placementId}`),
  alerts:            (plantId: number)                             => api<PlantAlert[]>('GET', `/plants/${plantId}/alerts`),
  warnings:          (plantId: number)                             => api<import('../types').PlantWarningStateOut>('GET', `/plants/${plantId}/warnings`),
  warningSummary:    (env: string = 'all')                         => api<import('../types').WarningSummaryOut>('GET', '/warnings/summary', { params: { env } }),
  retrySpecies:      (plantId: number)                                  => api<Plant>('POST', `/plants/${plantId}/retry-species`),
  fact:              ()                                            => api<PlantFactOut>('GET', '/plant-fact'),
  identify:          async (imageBlobs: Blob[], lang: 'nl' | 'en' = 'nl')  => { const f = new FormData(); f.append('image', imageBlobs[0], 'plant.jpg'); imageBlobs.slice(1).forEach((b, i) => f.append('extra_images', b, `angle-${i + 2}.jpg`)); return api<import('../types').IdentifyResponse>('POST', `/plants/identify?lang=${lang}`, { form: f }) },
  identifyPlantnet:  async (imageBlob: Blob, lang: 'nl' | 'en' = 'en')  => { const f = new FormData(); f.append('image', imageBlob, 'plant.jpg'); return api<import('../types').IdentifyResponse>('POST', `/plants/identify?engine=plantnet&lang=${lang}`, { form: f }) },
  commitIdentify:    (scientificName: string, photoBase64: string, lang: 'nl' | 'en' = 'nl', outcome?: { identifyId?: number | null; chosenSource?: string }) => api<import('../types').IdentifyCommitResult>('POST', `/plants/identify/commit?lang=${lang}`, { body: { scientific_name: scientificName, photo_base64: photoBase64, identify_id: outcome?.identifyId ?? null, chosen_source: outcome?.chosenSource ?? null } }),
}

export const weatherWarnings = {
  acknowledge: (warning: {
    warning_id: string
    care_type: string
    forecast_date: string
    severity: string
  }) =>
    api<{
      warning_id: string
      care_type: string
      forecast_date: string
      severity: string
      acknowledged_at: string
    }>(
      'POST',
      `/weather-warnings/${encodeURIComponent(warning.warning_id)}/acknowledgment`,
      {
        body: {
          care_type: warning.care_type,
          forecast_date: warning.forecast_date,
          severity: warning.severity,
        },
      },
    ),
  restore: (warningId: string) =>
    api<void>(
      'DELETE',
      `/weather-warnings/${encodeURIComponent(warningId)}/acknowledgment`,
    ),
}

export const photos = {
  /** Plants to walk past on a photo round, worst-photographed first. */
  round: (mapId?: number) => api<import('../types').PhotoRoundPlant[]>(
    'GET', `/photo-round${mapId != null ? `?map_id=${mapId}` : ''}`),
  list: (plantId: number) => api<import('../types').PlantPhoto[]>('GET', `/plants/${plantId}/photos`),
  upload: (plantId: number, image: Blob, opts: { note?: string; takenAt?: string; careLogId?: number } = {}) => {
    const f = new FormData()
    f.append('file', image, 'photo.jpg')
    if (opts.note) f.append('note', opts.note)
    if (opts.takenAt) f.append('taken_at', opts.takenAt)
    if (opts.careLogId != null) f.append('care_log_id', String(opts.careLogId))
    return api<import('../types').PlantPhoto>('POST', `/plants/${plantId}/photos`, { form: f })
  },
  updateNote: (photoId: number, note: string) => api<import('../types').PlantPhoto>('PATCH', `/photos/${photoId}`, { body: { note } }),
  remove: (photoId: number) => api<{ ok: boolean }>('DELETE', `/photos/${photoId}`),
  photoReminder: (plantId: number, enabled: boolean, intervalDays = 30) =>
    api<{ ok: boolean }>('PUT', `/plants/${plantId}/photo-reminder`,
      { body: { enabled, interval_days: intervalDays } }),
}


export const species = {
  /** Autocomplete for the plant edit form's species field (#886 §4.3). */
  search: (q: string, signal?: AbortSignal) =>
    api<{ results: import('../types').SpeciesSearchHit[]; total: number }>(
      'GET', '/species/search', { params: { q, per_page: '8' }, signal },
    ),
  ecology: (id: number) => api<import('../types').EcologyOut>('GET', `/species/${id}/ecology`),
  lookupLatin: (latin: string) => api<{ id: number; care_thresholds: Record<string, unknown> | null }>('GET', `/species/by-latin/${encodeURIComponent(latin)}`),
  funFact: (id: number) => api<{ fun_fact_nl: string; fun_fact_en: string }>('GET', `/species/${id}/fun-fact`),
  gardenFit: (id: number, lang: 'nl' | 'en' = 'nl') => api<Array<{ map_id: number; map_name: string; sun_fit: string | null; reason: string }>>('GET', `/species/${id}/garden-fit?lang=${lang}`),
  gardenFitBatch: (ids: number[], lang: 'nl' | 'en' = 'nl') => api<Record<string, Array<{ map_id: number; map_name: string; sun_fit: string | null; reason: string }>>>('POST', `/species/garden-fit/batch?lang=${lang}`, { body: { species_ids: ids } }),
}

export const maps = {
  list:    ()                                                                                                     => apiWithTimeout<MapInfo[]>('GET', '/maps'),
  create:  (data: { name: string; map_type?: string; lat?: number; lon?: number; bearing?: number; is_public?: boolean; photos_public?: boolean })             => api<MapInfo>('POST', '/maps', { body: data }),
  update:  (id: number, data: { name?: string; canvas_data?: string; map_type?: string; lat?: number; lon?: number; bearing?: number; streek_slug?: string | null; is_public?: boolean; photos_public?: boolean }) => api<MapInfo>('PUT', `/maps/${id}`, { body: data }),
  delete:  (id: number)                                                                                          => api<void>('DELETE', `/maps/${id}`),
  byId:    (id: number)                                                                                          => api<MapInfo>('GET', `/maps/by-id/${id}`),
  detail:  (slug: string)                                                                                        => api<MapDetail>('GET', `/maps/${slug}`),
  biodiversity: (slug: string)                                                                                   => api<import('../types').GardenBiodiversityOut>('GET', `/maps/${slug}/biodiversity`),
  plantSuggestions: (slug: string)                                                                               => api<GardenSuggestionsOut>('GET', `/maps/${slug}/plant-suggestions`),
  streekSuggestions: (slug: string)                                                                              => api<import('../types').StreekSuggestionsOut>('GET', `/maps/${slug}/streek-suggestions`),
  streken: ()                                                                                                    => api<import('../types').Streek[]>('GET', '/streken'),
  beeSupport: (slug: string)                                                                                     => api<import('../types').BeeSupportOut>('GET', `/maps/${slug}/bee-support`),
  updateCircularity: (slug: string, flags: import('../types').CircularityFlags)                                  => api<import('../types').CircularityFlags>('PUT', `/maps/${slug}/circularity`, { body: flags }),
  updateFeature: (slug: string, featureType: import('../types').GardenFeatureType, count: number)                => api<import('../types').GardenFeaturesOut>('PUT', `/maps/${slug}/features`, { body: { feature_type: featureType, count } }),
  dismissRecommendation: (slug: string, speciesId: number)                                                       => api<{ dismissed: boolean; species_id: number }>('POST', `/maps/${slug}/dismiss-recommendation`, { body: { species_id: speciesId } }),
  undismissRecommendation: (slug: string, speciesId: number)                                                     => api<{ dismissed: boolean; species_id: number }>('DELETE', `/maps/${slug}/dismiss-recommendation/${speciesId}`),
  plants:  (slug: string)                                                                                        => api<MapPlant[]>('GET', `/maps/${slug}/plants`),
  items:   (slug: string)                                                                                        => api<MapItems>('GET', `/maps/${slug}/items`),
  uploadUnderlay: (id: number, file: File) => { const f = new FormData(); f.append('file', file); return api<{ url: string }>('POST', `/maps/${id}/underlay`, { form: f }) },
}

export const objects = {
  list:        ()                                                                           => api<MapObject[]>('GET', '/objects'),
  create:      (data: ObjectCreateInput)                                                    => api<MapObject>('POST', '/objects', { body: data }),
  update:      (id: number, data: Partial<MapObject>)                                      => api<MapObject>('PUT', `/objects/${id}`, { body: data }),
  setPosition: (id: number, data: { map_x: number; map_y: number; rotation?: number })    => api<void>('PUT', `/objects/${id}/position`, { body: data }),
  archive:     (id: number)                                                                 => api<void>('DELETE', `/objects/${id}`),
  restore:     (id: number)                                                                 => api<void>('PATCH', `/objects/${id}/restore`),
}

export const groundZones = {
  list: (slug: string) => api<GroundZone[]>('GET', `/maps/${slug}/ground-zones`),
}

export const care = {
  done:           (plantId: number, careType: string, userId: number, notes?: string, water_amount?: number, scheduleId?: number) => api<{ ok: boolean; next_due: string; care_log_id: number; previous_next_due: string | null; previous_last_done: string | null; previous_last_done_by: number | null }>('POST', '/care/done', { body: { plant_id: plantId, care_type: careType, user_id: userId, notes, water_amount, schedule_id: scheduleId } }),
  skip:           (plantId: number, careType: string, userId: number)                  => api<void>('POST', '/care/skip', { body: { plant_id: plantId, care_type: careType, user_id: userId } }),
  undo:           (careLogId: number, previousNextDue: string | null, previousLastDone: string | null, previousLastDoneBy: number | null) => api<{ ok: boolean }>('POST', '/care/undo', { body: { care_log_id: careLogId, previous_next_due: previousNextDue, previous_last_done: previousLastDone, previous_last_done_by: previousLastDoneBy } }),
  deleteSchedule: (scheduleId: number)                                                  => api<void>('DELETE', `/care/schedules/${scheduleId}`),
  updateScheduleInterval: (scheduleId: number, intervalDays: number)                    => api<{ ok: boolean; schedule_id: number; interval_days: number }>('PATCH', `/care/schedules/${scheduleId}`, { body: { interval_days: intervalDays } }),
  syncSchedules: (plantId: number, schedules: CareScheduleInput[])                       => api<Plant>('PUT', `/plants/${plantId}/care-schedules`, { body: { schedules } }),
  log:            (plantId: number)                                                     => api<CareLogEntry[]>('GET', `/care/log/${plantId}`),
  householdLog:   (limit = 50, offset = 0)                                              => api<RecentLogEntry[]>('GET', '/care/log', { params: { limit: String(limit), offset: String(offset) } }),
}

export const garden = {
  latestWatering:  ()                                                    => api<{ watered_at: string | null }>('GET', '/garden/water-log/latest').then(d => d.watered_at ?? null),
  waterStatus:     ()                                                    => api<GardenWaterStatus>('GET', '/garden/water-status'),
  logWater:        (wateredAt?: string, userId?: number)                 => api<{ watered_at: string }>('POST', '/garden/water-log', { body: { watered_at: wateredAt ?? null, watered_by: userId ?? null } }).then(d => d.watered_at),
  deleteWater:     ()                                                    => api<void>('DELETE', '/garden/water-log/latest'),
  fertilizeStatus: ()                                                    => api<GardenFertilizeStatus>('GET', '/garden/fertilize-status'),
  logFertilize:    (fertilizedAt?: string, userId?: number)             => api<{ fertilized_at: string; schedules_updated: number }>('POST', '/garden/fertilize-log', { body: { fertilized_at: fertilizedAt ?? null, fertilized_by: userId ?? null } }),
  deleteFertilize: ()                                                    => api<void>('DELETE', '/garden/fertilize-log/latest'),
  growHere:        (sunHours: number, selectedMonth: number, existingPlants: string[]) => api<GrowHereResponse>('POST', '/garden/grow-here', { body: { sun_hours: sunHours, selected_month: selectedMonth, existing_plants: existingPlants } }),
  recommendations: (mapId: number, sunHours: number, month: number, svf?: number, limit?: number) =>
    api<RecommendationsOut>('GET', '/garden/recommendations', {
      params: {
        map_id: String(mapId),
        sun_hours: String(sunHours),
        month: String(month),
        ...(svf !== undefined ? { svf: String(svf) } : {}),
        ...(limit !== undefined ? { limit: String(limit) } : {}),
      },
    }),
}

export const alerts = {
  summary: () => api<AlertSummary>('GET', '/alerts/summary'),
}

// ── Public garden atlas (#804) ──
// Anonymous read-only browse surface. The backend (routers/atlas.py) strips
// account/household PII and rounds GPS to city level; no auth needed.
export type AtlasSort = 'score' | 'name' | 'newest'

export const atlas = {
  list: (params: { city?: string; month?: number; min_score?: number; sort?: AtlasSort } = {}) => {
    const qs: Record<string, string> = {}
    if (params.city?.trim()) qs.city = params.city.trim()
    if (params.month != null) qs.month = String(params.month)
    if (params.min_score != null) qs.min_score = String(params.min_score)
    if (params.sort && params.sort !== 'score') qs.sort = params.sort
    return api<PublicGardenSummary[]>('GET', '/atlas/gardens', { params: qs })
  },
  get: (slug: string) => api<PublicGardenDetail>('GET', `/atlas/gardens/${encodeURIComponent(slug)}`),
}

import type { CalendarEvent } from '../pages/calendar/calendarTypes'
import type { WaterOutlook } from '../pages/calendar/waterOutlookTypes'

export const calendar = {
  events: (
    from: string,
    to: string,
    env?: string,
    pinOverdue = false,
    includeHistory = false,
  ) => {
    const params: Record<string, string> = { from, to }
    if (env && env !== 'all') params.env = env
    if (pinOverdue) params.pin_overdue = 'true'
    if (includeHistory) params.include_history = 'true'
    return api<CalendarEvent[]>('GET', '/calendar/events', { params })
  },
  waterOutlook: () => api<WaterOutlook>('GET', '/calendar/water-outlook'),
}

export const icons = {
  catalog: async (): Promise<PlantIcon[]> => {
    const entries = await api<PlantIcon[]>('GET', '/icon-catalog')
    indexIconUrls(entries)
    return entries.slice().sort((a, b) => a.name.localeCompare(b.name))
  },
  sync:    () => api<IconSyncResult>('POST', '/icon-catalog/sync'),
  gaps:    () => api<IconGapReport>('GET', '/icon-catalog/gaps'),
  request: (plantId: number) => api<{ status: string; plant_id: number }>('PATCH', `/icon-catalog/request/${plantId}`),
}

export const gardenCare = {
  complete: (
    careType: string,
    userId: number,
    mapId: number,
    completedAt?: string,
    scheduleIds?: number[],
  ) =>
      api<{ operation_id: number; care_type: string; completed_at: string; affected_count: number }>('POST', '/care/garden/complete', {
        body: {
          care_type: careType,
          user_id: userId,
          map_id: mapId,
          completed_at: completedAt ?? null,
          schedule_ids: scheduleIds,
        },
    }),
  undo: (operationId: number) => api<{ ok: boolean }>('POST', `/care/garden/${operationId}/undo`),
}

export interface MapWateringRoundMember {
  schedule_id: number
  plant_id: number
  plant_name: string
  plant_icon_variant: string | null
  canonical_date: string
  rhythm_opt_out: boolean
}

export interface MapWateringRoundHistory {
  operation_id: number
  completed_at: string
  completed_by: number | null
  completed_by_name: string | null
  affected_count: number
  can_undo: boolean
}

export interface MapWateringRoundData {
  map_id: number
  map_name: string
  members: MapWateringRoundMember[]
  history: MapWateringRoundHistory[]
}

export const mapWateringRound = {
  get: (mapId: number) =>
    api<MapWateringRoundData>('GET', `/care/maps/${mapId}/watering-round`),
  complete: (
    mapId: number,
    completedAt: string,
    userId: number,
    scheduleIds: number[],
  ) => api<{
    operation_id: number
    care_type: string
    completed_at: string
    affected_count: number
  }>('POST', `/care/maps/${mapId}/watering-round/complete`, {
    body: {
      completed_at: completedAt,
      user_id: userId,
      schedule_ids: scheduleIds,
    },
  }),
}

export const moistureChecks = {
  resolve: (
    mapId: number,
    checkScheduleIds: number[],
    outcome: 'still_moist' | 'watered',
    completedAt: string,
    userId: number,
  ) => api<{ outcome: 'still_moist' | 'watered'; affected_count: number }>(
    'POST',
    '/care/moisture-checks/resolve',
    { body: {
      map_id: mapId,
      check_schedule_ids: checkScheduleIds,
      outcome,
      completed_at: completedAt,
      user_id: userId,
    } },
  ),
}

export const weeds = {
  listSightings:  (map_id?: number)                                => api<import('../types').WeedSightingOut[]>('GET', '/weed-sightings', { params: map_id ? { map_id: String(map_id) } : {} }),
  deleteSighting: (sighting_id: number)                            => api<void>('DELETE', `/weed-sightings/${sighting_id}`),
  getSighting:    (sighting_id: number)                            => api<import('../types').SightingDetailOut>('GET', `/weed-sightings/${sighting_id}`),
  catalog:        ()                                            => api<import('../types').WeedSpeciesListItem[]>('GET', '/weed-catalog'),
  createSighting: (body: import('../types').WeedSightingCreate) => api<import('../types').WeedSightingOut>('POST', '/weed-sightings', { body }),
}

export const auth = {
  me: () => api<AccountMe>("GET", "/auth/me"),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api<{ message: string }>("POST", "/auth/change-password", { body: data }),
}

export const dataExport = {
  bundle:     () => apiBlob('/export'),
  careLogCsv: () => apiBlob('/export/care-log.csv'),
}

export const admin = {
  accounts:             ()           => api<AdminAccount[]>('GET', '/admin/accounts'),
  deleteAccount:        (id: number) => api<void>('DELETE', `/admin/accounts/${id}`),
  deleteAccounts:       (ids: number[]) => api<{status: string; account_ids: number[]; names: string[]; households_cleared: number}>('DELETE', '/admin/accounts/bulk', { body: { account_ids: ids } }),
  backfillThresholds:   ()           => api<{ processed: number; succeeded: number; failed: number }>('POST', '/admin/backfill-thresholds'),
  backfillCareSchedules:()           => api<{ checked: number; seeded: number }>('POST', '/admin/backfill-care-schedules'),
  thresholdsPreview:     ()           => api<{ active_total: number; missing_thresholds: number; has_thresholds: number }>('GET', '/admin/backfill-thresholds/preview'),
  photoEmbeddingsPreview: ()         => api<{ total_photos: number; missing_embedding: number; embedded: number; unanchored: number }>('GET', '/admin/photo-embeddings/preview'),
  schedulesPreview:      ()           => api<{ total_with_thresholds: number; missing_schedules: number; has_schedules: number }>('GET', '/admin/backfill-care-schedules/preview'),
  backfillPlantTypes:    ()           => api<AdminBackfillPlantTypesResult>('POST', '/admin/backfill-plant-types'),
  backfillPlantTypesPreview: ()     => api<{ total_active_plants: number; missing_plant_type: number }>('GET', '/admin/backfill-plant-types/preview'),
}

export const adminPanel = {
  overview:       () => api<AdminOverview>('GET', '/admin-panel/overview'),
  growthMetrics:  (days: number = 30) => api<AdminGrowthMetrics>('GET', '/admin-panel/growth-metrics', { params: { days: String(days) } }),
  health:         () => api<AdminSystemHealth>('GET', '/admin-panel/health'),
  coverage:       () => api<AdminCoverage>('GET', '/admin-panel/coverage'),
  users:    (params: AdminTableParams = {}) => api<AdminPagedResponse<AdminUserRow>>('GET', '/admin-panel/users', { params: adminTableParams(params) }),
  plants:   (params: AdminTableParams = {}) => api<AdminPagedResponse<AdminPlantRow>>('GET', '/admin-panel/plants', { params: adminTableParams(params) }),
  species:  (params: AdminTableParams = {}) => api<AdminPagedResponse<AdminSpeciesRow>>('GET', '/admin-panel/species', { params: adminTableParams(params) }),
  activity: () => api<AdminActivityEvent[]>('GET', '/admin-panel/activity'),
  me:       () => api<{ email: string }>('GET', '/admin-panel/me'),
  backfillSpeciesPreview: () =>
    api<{ active_total: number; missing_species: Array<{ id: number; name: string }>; missing_count: number }>(
      'GET', '/admin-panel/backfill-species/preview'),
  backfillFactsPreview: (opts: { scope?: AdminFactsScope; mapOnly?: boolean } = {}) => {
    const q = new URLSearchParams()
    if (opts.scope) q.set('scope', opts.scope)
    if (opts.mapOnly) q.set('map_only', 'true')
    const qs = q.toString()
    return api<AdminBackfillFactsPreview>('GET', `/admin-panel/backfill-facts/preview${qs ? `?${qs}` : ''}`)
  },
  backfillNamesPreview: (opts: { scope?: AdminFactsScope; mapOnly?: boolean } = {}) => {
    const q = new URLSearchParams()
    if (opts.scope) q.set('scope', opts.scope)
    if (opts.mapOnly) q.set('map_only', 'true')
    const qs = q.toString()
    return api<AdminBackfillNamesPreview>('GET', `/admin-panel/backfill-names/preview${qs ? `?${qs}` : ''}`)
  },
  generateIconsPreview: (opts: { scope?: 'all' | 'in_use'; mapOnly?: boolean } = {}) => {
    const q = new URLSearchParams()
    if (opts.scope) q.set('scope', opts.scope)
    if (opts.mapOnly) q.set('map_only', 'true')
    const qs = q.toString()
    return api<AdminIconPreview>('GET', `/admin-panel/generate-icons/preview${qs ? `?${qs}` : ''}`)
  },
  household: (id: number) => api<AdminHouseholdDetail>('GET', `/admin-panel/households/${id}`),
  incompleteSpeciesNames: (limit: number = 100) =>
    api<{ species: Array<{ id: number; common_name_nl: string | null; common_name_en: string | null; latin_name: string | null; missing_nl: boolean; missing_en: boolean; missing_latin: boolean; active_count?: number }>; total: number }>('GET', `/admin-panel/species/incomplete-names`, { params: { limit: String(limit) } }),
  patchSpecies: (id: number, body: { common_name_nl?: string; common_name_en?: string; latin_name?: string }) =>
    api<{ id: number; common_name_nl: string | null; common_name_en: string | null; latin_name: string | null }>('PATCH', `/admin-panel/species/${id}`, { body }),
  regenerateSpeciesThresholds: (id: number, propagate = false) =>
    api<{ species_id: number; name: string; propagated_to_plants: number }>('POST', `/admin-panel/species/${id}/regenerate-thresholds`, { params: { propagate: String(propagate) } }),
  regeneratePlantIcon: (plantId: number) =>
    api<{ plant_id: number; name: string; icon_id: string; cat: string; source: string; icon_key: string | null }>('POST', `/admin-panel/plants/${plantId}/regenerate-icon`),
  regenerateSpeciesFact: (id: number) =>
    api<{ species_id: number; name: string; fact: string; fact_en: string }>('POST', `/admin-panel/species/${id}/regenerate-fact`),
  mergeSpecies: (source_id: number, target_id: number) =>
    api<{ merged: boolean; source_name: string; target_name: string; plants_moved: number }>('POST', '/admin-panel/species/merge', { body: { source_id, target_id } }),
  audit: (params: { limit?: number; offset?: number } = {}) => {
    const p: Record<string, string> = {}
    if (params.limit != null) p.limit = String(params.limit)
    if (params.offset != null) p.offset = String(params.offset)
    return api<{ rows: AdminAuditRow[]; total: number }>('GET', '/admin-panel/audit', { params: p })
  },
  startJob: (kind: string, params: Record<string, unknown> = {}) =>
    api<{ job_id: number; queue_position: number }>('POST', '/admin-panel/jobs', { body: { kind, params } }),
  getJob: (id: number) =>
    api<AdminJob>('GET', `/admin-panel/jobs/${id}`),
  listJobs: (limit = 20) =>
    api<AdminJob[]>('GET', '/admin-panel/jobs', { params: { limit: String(limit) } }),
  anchors: (params: AdminTableParams = {}) =>
    api<AdminPagedResponse<AdminAnchorRow>>('GET', '/admin-panel/anchors', { params: adminTableParams(params) }),
  retractAnchor: (anchorId: number) =>
    api<{ ok: boolean; anchor_id: number }>('POST', `/admin-panel/anchors/${anchorId}/retract`),
}

export interface AdminAuditRow {
  id: number
  action: string
  target: string | null
  detail: Record<string, unknown> | null
  created_at: string
  admin_email: string | null
  admin_name: string | null
}

export interface AdminAnchorRow {
  id: number
  species_id: number
  source_account_id: number | null
  source_photo_url: string | null
  source_plant_id: number | null
  latin_name: string | null
  common_name_nl: string | null
  source_household_id: number | null
  source_household_name: string | null
  source_account_email: string | null
  /** Number of distinct source households backing this species' anchors. */
  backing_households: number
  created_at: string
}

/** 'queued' means accepted and waiting behind another job — one runs at a time. */
export type AdminJobStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'interrupted'

export interface AdminJob {
  id: number
  kind: string
  status: AdminJobStatus
  progress_done: number
  progress_total: number
  result: Record<string, unknown> | null
  error: string | null
  created_at: string
  updated_at: string
  admin_name: string | null
}

export interface IconGenerateResult {
  generated: { id: number; name: string; latin: string; icon_id: string; cat: string }[]
  count: number
  skipped: { id: number; name: string; latin: string; error: string }[]
  skipped_count: number
  sync_result: { matched: number; matches: { plant_id: number; plant_name: string; icon_key: string }[] }
  scope?: string
  map_only?: boolean
  remaining?: number
}

export interface HouseholdMemberCapabilities {
  can_edit: boolean
  can_manage_household: boolean
}

export interface HouseholdMember {
  /** accounts.id — what PATCH /household/members/{id} expects. */
  id: number
  name: string
  email: string
  avatar: string | null
  created_at: string
  /** The household role: owner (manages the household), editor (can edit), viewer (read-only). */
  role: 'owner' | 'editor' | 'viewer'
  /** Server-derived capabilities for the role — what the UI may render. */
  capabilities: HouseholdMemberCapabilities
  /**
   * The legacy `users` row for this account, resolved server-side.
   * DELETE /household/members/{user_id} keys off this, not `id`. Null when the
   * account has no `users` row yet, in which case removal isn't offered.
   */
  user_id: number | null
  /** True for the account making the request. */
  is_self: boolean
}

export type CalendarGroupingCareType =
  | 'water'
  | 'fertilize'
  | 'prune'
  | 'repot'
  | 'mist'
  | 'rotate'
  | 'pest_check'
  | 'dust'

export interface CalendarGroupingRule {
  map_id: number
  care_types: CalendarGroupingCareType[]
}

export interface CalendarGroupingMap {
  id: number
  name: string
  map_type: 'outdoor' | 'indoor'
  recurring_care_types: CalendarGroupingCareType[]
  recommended_care_types: CalendarGroupingCareType[]
}

export interface CalendarGroupingPreferences {
  rules: CalendarGroupingRule[]
  maps: CalendarGroupingMap[]
  care_types: CalendarGroupingCareType[]
  map_ids: number[]
  outdoor_maps: Array<{ id: number; name: string }>
}

export type CalendarSubscriptionEnvironment = 'all' | 'outdoor' | 'indoor'

export interface CalendarSubscriptionConfig {
  environment: CalendarSubscriptionEnvironment
  map_ids: number[]
  care_types: CalendarGroupingCareType[]
  include_context: boolean
  privacy: boolean
}

export interface CalendarSubscriptionStatus {
  active: boolean
  config: CalendarSubscriptionConfig | null
  created_at: string | null
}

export interface CalendarSubscriptionCreated {
  feed_url: string
  webcal_url: string
  config: CalendarSubscriptionConfig
}

export interface CareRhythmMapOverride {
  map_id: number
  weekdays: number[]
}

export interface CareRhythmConfig {
  indoor_weekdays: number[]
  outdoor_weekdays: number[]
  map_overrides: CareRhythmMapOverride[]
}

export interface CareRhythmSettings {
  saved: boolean
  config: CareRhythmConfig
  maps: Array<{ id: number; name: string; map_type: 'outdoor' | 'indoor' }>
}

export type CareRhythmPreviewReason =
  | 'routine'
  | 'too_frequent'
  | 'opted_out'
  | 'no_routine'
  | 'not_future'
  | 'moved_earlier'
  | 'aligned'
  | 'outside_window'

export interface CareRhythmPreviewItem {
  schedule_id: number
  plant_id: number
  plant_name: string
  species_common_name_nl: string | null
  species_common_name_en: string | null
  plant_icon_variant: string | null
  map_id: number
  map_name: string
  map_type: 'outdoor' | 'indoor'
  old_date: string
  new_date: string
  movement_days: number
  status: 'moved' | 'unchanged' | 'exception'
  reason: CareRhythmPreviewReason
}

export interface CareRhythmSummary {
  total: number
  moved: number
  unchanged: number
  exceptions: number
  group_count: number
}

export interface CareRhythmPreview {
  config: CareRhythmConfig
  preview_hash: string
  items: CareRhythmPreviewItem[]
  groups: Array<{
    date: string
    map_id: number
    map_name: string
    count: number
    schedule_ids: number[]
  }>
  summary: CareRhythmSummary
}

export interface CareRhythmOperation {
  operation_id: number
  affected_count: number
  preview_hash: string
  summary: CareRhythmSummary
}

export interface CareRhythmOnboardingPreview {
  available: boolean
  baseline_date: string
  proposed_date: string | null
  movement_days: number
  reason: string
}

export const household = {
  invite:      (role?: 'editor' | 'viewer') =>
    api<{ code: string; expires_at: string; role: 'editor' | 'viewer' }>(
      'POST', '/household/invite', role ? { body: { role } } : {},
    ),
  join:        (data: { code: string; email: string; password: string; name: string; language?: 'nl' | 'en' }) => api<import('../api/auth').AuthResponse>('POST', '/household/join', { body: data }),
  members:     ()                             => api<HouseholdMember[]>('GET', '/household/members'),
  updateMember:(memberId: number, data: { name: string; avatar: string | null }) =>
    api<HouseholdMember>('PATCH', `/household/members/${memberId}`, { body: data }),
  changeRole:  (memberId: number, role: 'editor' | 'viewer') =>
    api<HouseholdMember>('PATCH', `/household/members/${memberId}/role`, { body: { role } }),
  removeMember:(userId: number)               => api<void>('DELETE', `/household/members/${userId}`),
  rename:      (name: string)                  => api<{ name: string }>('PATCH', '/household', { body: { name } }),
  calendarGrouping: ()                         => api<CalendarGroupingPreferences>('GET', '/household/calendar-grouping'),
  updateCalendarGrouping: (data: { rules: CalendarGroupingRule[] }) =>
    api<CalendarGroupingPreferences>('PUT', '/household/calendar-grouping', { body: data }),
}

export const careRhythm = {
  settings: () => api<CareRhythmSettings>('GET', '/household/care-rhythm'),
  preview: (config: CareRhythmConfig) =>
    api<CareRhythmPreview>('POST', '/care-rhythm/preview', { body: config }),
  apply: (data: { config: CareRhythmConfig; preview_hash: string }) =>
    api<CareRhythmOperation>('POST', '/care-rhythm/apply', { body: data }),
  undo: (operationId: number) =>
    api<{ ok: boolean }>('POST', `/care-rhythm/${operationId}/undo`),
  onboardingPreview: (mapId: number, intervalDays: number) =>
    api<CareRhythmOnboardingPreview>('POST', '/care-rhythm/onboarding-preview', {
      body: { map_id: mapId, interval_days: intervalDays },
    }),
}

export const calendarSubscription = {
  status: () => api<CalendarSubscriptionStatus>('GET', '/calendar/subscription'),
  create: (config: CalendarSubscriptionConfig) =>
    api<CalendarSubscriptionCreated>('POST', '/calendar/subscription', { body: config }),
  update: (config: CalendarSubscriptionConfig) =>
    api<CalendarSubscriptionStatus>('PATCH', '/calendar/subscription', { body: config }),
  revoke: () => api<void>('DELETE', '/calendar/subscription'),
  downloadSnapshot: async (config: CalendarSubscriptionConfig): Promise<Blob> => {
    const res = await fetch(buildUrl('/calendar/export.ics'), {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    await handleAuthErrors(res)
    await ensureOk(res, 'Failed: POST /calendar/export.ics')
    return res.blob()
  },
}

export interface NotificationPrefs {
  digest_enabled: boolean
  digest_time: string  // "HH:MM" — the email digest hour (Europe/Amsterdam)
  push_enabled: boolean
  quiet_start: string | null   // "HH:MM" — care pushes held inside [start, end); null = default 21:00–08:00
  quiet_end: string | null
  muted_care_types: string[]   // care_type keys silenced for push
}

export interface PlantDiscovery {
  id: number
  species_id: number | null
  common_name: string
  species_common_name_nl: string | null
  species_common_name_en: string | null
  latin_name: string | null
  thumbnail_url: string | null
  notes: string | null
  location_lat: number | null
  location_lon: number | null
  place_name: string | null
  country_code: string | null
  fun_fact_nl: string | null
  fun_fact_en: string | null
  discovered_at: string
}

export const discoveries = {
  /** `scope='mine'` limits the list to the calling account's own finds. */
  list: (scope?: 'all' | 'mine') =>
    api<PlantDiscovery[]>('GET', scope === 'mine' ? '/discover?scope=mine' : '/discover'),
  save: (data: {
    species_id?: number
    common_name: string
    latin_name?: string
    thumbnail_url?: string
    thumbnail_data?: string
    notes?: string
    location_lat?: number
    location_lon?: number
  }) => api<PlantDiscovery>('POST', '/discover', { body: data }),
  updateNotes: (id: number, notes: string | null) =>
    api<PlantDiscovery>('PATCH', `/discover/${id}`, { body: { notes } }),
  updateLocation: (id: number, location: { lat: number; lon: number }) =>
    api<PlantDiscovery>('PATCH', `/discover/${id}/location`, {
      body: { location_lat: location.lat, location_lon: location.lon },
    }),
  share: (id: number) => api<{ share_url: string }>('POST', `/discover/${id}/share`),
  delete: (id: number) => api<void>('DELETE', `/discover/${id}`),
}

export const notifications = {
  getPrefs:    ()                       => api<NotificationPrefs>('GET', '/settings/notifications'),
  updatePrefs: (prefs: NotificationPrefs) => api<NotificationPrefs>('PUT', '/settings/notifications', { body: prefs }),
  vapidKey:    ()                       => api<{ key: string }>('GET', '/push/vapid-public-key'),
  pushSubscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api<{ ok: boolean }>('POST', '/push/subscription', { body: sub }),
  pushUnsubscribe: (endpoint: string) =>
    api<{ ok: boolean }>('DELETE', '/push/subscription', { body: { endpoint } }),
  pushTest: () => api<PushTestResult>('POST', '/push/test'),
}

export interface PushTestResult {
  result: 'ok' | 'no_subscription' | 'vapid_unconfigured' | 'all_gone' | 'all_failed'
  subscriptions: number
  delivered: number
  failed: number
  pruned: number
}
