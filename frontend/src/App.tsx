import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useFloreren } from './store/useFloreren'
import { LanguageProvider } from './context/LanguageContext'
import BottomNav from './components/BottomNav'
import Glyph from './components/ui/Glyph'
import HelpAssistant from './components/HelpAssistant'
import PlantPickerSheet from './components/sheets/PlantPickerSheet'
import NewMapModal from './components/dashboard/NewMapModal'
import AppLoadingView from './components/ui/AppLoadingView'
import PullToRefresh from './components/ui/PullToRefresh'
import UpdateToast from './components/ui/UpdateToast'
import InstallNudge from './components/install/InstallNudge'
import type { LocalPlant } from './data/plants-dataset'
import { getToken } from './api/auth'
import { getGuest } from './api/game'
import { icons } from './api/client'
import { Analytics } from '@vercel/analytics/react'
import { ErrorBoundary } from './components/ErrorBoundary'
import OutageBanner from './components/ui/OutageBanner'
import { useT } from './context/LanguageContext'
import { defaultMapRedirectSlug } from './appMapRedirectModel'

// Route-level code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DemoGardenPage = lazy(() => import('./pages/DemoGardenPage'))
const LandingTour = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LandingTour })))
const MapPage = lazy(() => import('./pages/MapPage'))
const Plants = lazy(() => import('./pages/Plants'))
const AddPlant = lazy(() => import('./pages/AddPlant'))
const PhotoRound = lazy(() => import('./pages/PhotoRound'))
const PlantDetail = lazy(() => import('./pages/PlantDetail'))
const EditPlant = lazy(() => import('./pages/EditPlant'))
const IdentifyPlantPage = lazy(() => import('./pages/IdentifyPlant').then(m => ({ default: m.IdentifyPlantPage })))
const Settings = lazy(() => import('./pages/Settings'))
const PlanningCalendarPage = lazy(() => import('./pages/calendar/PlanningCalendarPage'))
const LayoutEditorPage = lazy(() => import('./pages/LayoutEditorPage'))
const MapSettingsPage = lazy(() => import('./pages/MapSettingsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const LogboekPage = lazy(() => import('./pages/LogboekPage'))
const GameJoinPage = lazy(() => import('./pages/GameJoinPage'))
const StudyPage = lazy(() => import('./pages/StudyPage'))
const GameHostPage = lazy(() => import('./pages/GameHostPage'))
const GamePlayerPage = lazy(() => import('./pages/GamePlayerPage'))
const DiscoveryCard = lazy(() => import('./pages/DiscoveryCard'))
const FieldJournalPage = lazy(() => import('./pages/FieldJournalPage'))
const AtlasPage = lazy(() => import('./pages/AtlasPage'))
const AtlasGardenPage = lazy(() => import('./pages/AtlasGardenPage'))

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-text-muted text-center">Laden…</div>}>
      {children}
    </Suspense>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return <>{children}</>
}

/**
 * Game routes accept a party guest as well as a logged-in account.
 *
 * Guests hold a session-scoped guest token, not a Floreren login, so RequireAuth
 * would bounce every one of them to /login the moment they joined. Sending them
 * to the join screen (with the code prefilled) is the right recovery here — not
 * to a login form they have no account for.
 */
function RequireGameAccess({ children }: { children: React.ReactNode }) {
  const { code } = useParams<{ code: string }>()
  if (getToken() || getGuest(code)) return <>{children}</>
  return <Navigate to={`/game${code ? `?code=${code}` : ''}`} replace />
}

/** Redirect /maps to the first indoor map's /map/:slug page. */
function MapRedirect() {
  const maps = useFloreren((s) => s.maps)
  const loadMaps = useFloreren((s) => s.loadMaps)
  const t = useT()
  const [ready, setReady] = useState(maps.length > 0)
  const [loading, setLoading] = useState(maps.length === 0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)

  // Load only the maps needed for this redirect. Do not wait for the app-wide
  // initial load, because unrelated users/plants requests can be slow or stuck
  // after a transient backend hiccup.
  useEffect(() => {
    if (maps.length > 0) {
      setReady(true)
      setLoading(false)
      setLoadError(null)
      return
    }

    let cancelled = false
    setReady(false)
    setLoading(true)
    setLoadError(null)

    loadMaps().then(() => {
      if (cancelled) return
      const state = useFloreren.getState()
      setReady(true)
      setLoading(false)
      setLoadError(state.maps.length === 0 ? state.error : null)
    }).catch((e) => {
      if (cancelled) return
      setReady(true)
      setLoading(false)
      setLoadError(e instanceof Error ? e.message : t.maps.loadFailed)
    })

    return () => { cancelled = true }
  }, [loadMaps, maps.length, retryKey, t.maps.loadFailed])

  // If maps are already loaded, redirect synchronously in render —
  // no flash of a loading state.
  const targetSlug = defaultMapRedirectSlug(maps)
  if (targetSlug) {
    return <Navigate to={`/map/${targetSlug}`} replace />
  }

  if (loading || !ready) {
    return <AppLoadingView title={t.maps.loading} lede={t.maps.loadingLede} />
  }

  if (loadError) {
    return (
      <div className="p-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
        <p style={{ marginBottom: 14 }}>{t.maps.loadFailed}</p>
        <button
          onClick={() => setRetryKey((v) => v + 1)}
          style={{
            padding: '10px 20px', borderRadius: 100,
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          {t.maps.retry}
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{ marginBottom: 16, color: 'var(--color-text-muted)' }}><Glyph name="map" size={48} /></div>
      <h2 style={{
        fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 24,
        color: 'var(--color-text)', margin: '0 0 8px', letterSpacing: '-0.01em',
      }}>{t.maps.noMaps}</h2>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-muted)',
        maxWidth: 280, lineHeight: 1.5, margin: '0 0 28px',
      }}>{t.maps.createFirstLede}</p>
      <button
        onClick={() => setShowCreate(true)}
        style={{
          padding: '12px 28px', borderRadius: 100,
          background: 'var(--color-primary)', color: '#fff',
          fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
          border: 'none', cursor: 'pointer',
        }}
      >
        {t.maps.createFirstMap}
      </button>
      <NewMapModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

// Pull-to-refresh is enabled only on the scrollable list pages. The map has
// its own pan/zoom gestures, and detail/editor pages load their own data.
const PULL_REFRESH_ROUTES = new Set(['/plants', '/field-journal', '/calendar', '/log'])

export default function App() {
  const load = useFloreren((s) => s.load)
  const refreshAll = useFloreren((s) => s.refreshAll)
  const isLoading = useFloreren((s) => s.isLoading)
  const hasLoaded = useFloreren((s) => s.hasLoaded)
  const error = useFloreren((s) => s.error)
  const clearError = useFloreren((s) => s.clearError)
  const showPlantPicker = useFloreren((s) => s.showPlantPicker)
  const setShowPlantPicker = useFloreren((s) => s.setShowPlantPicker)
  const navigate = useNavigate()
  const location = useLocation()
  const isPublicHome = location.pathname === '/'
  const isLoginPage = location.pathname === '/login'
  // The public demo garden (/demo) is pre-auth like the login page: no app chrome.
  const isDemoPage = location.pathname === '/demo'
  // /tour is the homepage's long-form counterpart — also pre-auth, also no chrome.
  const isTourPage = location.pathname === '/tour'
  const isAdminPage = location.pathname.startsWith('/admin')
  // Hide Stekkie during the identify flow — it overlaps the full-screen camera.
  const isIdentifyPage = location.pathname.startsWith('/identify')
  // The layout editor is a focused full-screen tool (its own back button) — hide app chrome.
  const isEditorPage = location.pathname.includes('/edit-layout')
  // On map pages, BottomNav hides in landscape-mobile so the map can fill the viewport.
  // Outside map pages we always show it (otherwise users couldn't navigate after rotating).
  const isMapPage = location.pathname.startsWith('/map')
  // A hunt is a focused mode, like the identify flow and the layout editor.
  // The bottom nav costs ~70px of a phone screen that the round view needs —
  // it was covering "Ronde overslaan" outright — and mid-round it only offers
  // a guest ways to wander off into the calendar.
  const isGamePage = location.pathname.startsWith('/game')
  // Same reasoning as the game: a full-height card with a pinned action, on a
  // screen where the nav's ~70px is exactly what pushes the button out of
  // reach. Studying is also a focused mode — you are not navigating mid-card.
  const isStudyPage = location.pathname.startsWith('/study')

  // Load initial data: on mount (token from previous session) AND after login
  // (navigate from /login → protected route). Skip if already loading or loaded.
  useEffect(() => {
    if (getToken() && !isLoginPage && !isPublicHome && !isTourPage && !hasLoaded && !isLoading) {
      load()
    }
  }, [load, isLoginPage, isPublicHome, isTourPage, hasLoaded, isLoading])

  // Prime the icon URL index once so generated (R2) icons resolve app-wide.
  useEffect(() => { icons.catalog().catch(() => {}) }, [])

  // Foreground refetch: a PWA instance can stay alive for days, so when the
  // app becomes visible again and the shared data is older than a few
  // minutes, quietly refresh it (the mechanism most native apps use).
  useEffect(() => {
    const STALE_MS = 3 * 60 * 1000
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const s = useFloreren.getState()
      if (!getToken() || !s.hasLoaded) return
      if (Date.now() - s.lastRefreshAt > STALE_MS) s.refreshAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const mainRef = useRef<HTMLElement>(null)
  const pullRefreshEnabled = PULL_REFRESH_ROUTES.has(location.pathname)

  // AddPlant keys off `location.state.from`; without it it shows the
  // entry-choice screen and ignores the prefill entirely.
  const handleSelectPlant = (plant: LocalPlant) => {
    setShowPlantPicker(false)
    navigate('/plants/add', { state: { from: 'pick', prefill: plant } })
  }

  const handleCustomName = (name?: string) => {
    setShowPlantPicker(false)
    navigate('/plants/add', { state: { from: 'manual', prefill: name ? { name } : undefined } })
  }

  return (
    <LanguageProvider>
      {/* Outside every page gate on purpose: a database outage is not a page's
          problem, and the game and study screens hide their chrome. */}
      <OutageBanner />
      <div className="flex flex-col h-dvh bg-bg overflow-hidden">
      {!isPublicHome && error && (
        <div className="bg-overdue/10 text-overdue px-4 py-2 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="font-bold ml-2 inline-flex items-center"><Glyph name="x" size={15} /></button>
        </div>
      )}

      <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
        <PullToRefresh scrollRef={mainRef} enabled={pullRefreshEnabled} onRefresh={refreshAll}>
        <ErrorBoundary>
          <SuspenseWrapper>
            <Routes>
              <Route
                path="/"
                element={
                  getToken() ? <Navigate to="/maps" replace /> : <LoginPage publicHome />
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/demo" element={<DemoGardenPage />} />
              <Route path="/tour" element={<LandingTour />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                path="/maps"
                element={
                  <RequireAuth>
                    <MapRedirect />
                  </RequireAuth>
                }
              />
              <Route
                path="/maps/:id/edit-layout"
                element={
                  <RequireAuth>
                    <LayoutEditorPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/maps/:id/settings"
                element={
                  <RequireAuth>
                    <MapSettingsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/map/:slug"
                element={
                  <RequireAuth>
                    <MapPage />
                  </RequireAuth>
                }
              />
              {/* Dashboard retired (map-as-home migration). Keep the path as a
                  redirect so old bookmarks / deep links don't 404. */}
              <Route path="/dashboard" element={<Navigate to="/maps" replace />} />
              <Route
                path="/plants"
                element={
                  <RequireAuth>
                    <Plants />
                  </RequireAuth>
                }
              />
              <Route
                path="/plants/add"
                element={
                  <RequireAuth>
                    <AddPlant />
                  </RequireAuth>
                }
              />
              <Route
                path="/photo-round"
                element={
                  <RequireAuth>
                    <PhotoRound />
                  </RequireAuth>
                }
              />
              <Route
                path="/plants/discovery"
                element={
                  <RequireAuth>
                    <DiscoveryCard />
                  </RequireAuth>
                }
              />
              <Route
                path="/plants/:id"
                element={
                  <RequireAuth>
                    <PlantDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="/plants/:id/edit"
                element={
                  <RequireAuth>
                    <EditPlant />
                  </RequireAuth>
                }
              />
              <Route
                path="/identify"
                element={
                  <RequireAuth>
                    <IdentifyPlantPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/calendar"
                element={
                  <RequireAuth>
                    <PlanningCalendarPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/atlas"
                element={
                  <RequireAuth>
                    <AtlasPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/atlas/:slug"
                element={
                  <RequireAuth>
                    <AtlasGardenPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/log"
                element={
                  <RequireAuth>
                    <SuspenseWrapper><LogboekPage /></SuspenseWrapper>
                  </RequireAuth>
                }
              />
              <Route
                path="/field-journal"
                element={
                  <RequireAuth>
                    <SuspenseWrapper><FieldJournalPage /></SuspenseWrapper>
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <AdminPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/study"
                element={
                  <RequireAuth>
                    <StudyPage />
                  </RequireAuth>
                }
              />
              <Route path="/game" element={<GameJoinPage />} />
              <Route
                path="/game/:code/host"
                element={
                  <RequireAuth>
                    <GameHostPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/game/:code"
                element={
                  <RequireGameAccess>
                    <GamePlayerPage />
                  </RequireGameAccess>
                }
              />
            </Routes>
          </SuspenseWrapper>
        </ErrorBoundary>
        </PullToRefresh>
      </main>

      {!isPublicHome && !isTourPage && !isLoginPage && !isDemoPage && !isAdminPage && !isEditorPage && !isGamePage && !isStudyPage && (
        <div className={`relative z-[70] ${isMapPage ? 'landscape-mobile-hide' : ''}`}>
          <BottomNav />
        </div>
      )}

      {!isPublicHome && !isTourPage && !isLoginPage && !isDemoPage && !isAdminPage && !isEditorPage && !isGamePage && !isStudyPage && <InstallNudge />}

      {!isPublicHome && !isTourPage && !isLoginPage && !isDemoPage && !isAdminPage && !isIdentifyPage && !isEditorPage && !isGamePage && !isStudyPage && <HelpAssistant />}

      {!isPublicHome && !isTourPage && !isLoginPage && !isDemoPage && <UpdateToast />}

      {showPlantPicker && (
        <PlantPickerSheet
          onClose={() => setShowPlantPicker(false)}
          onSelectPlant={handleSelectPlant}
          onCustomName={handleCustomName}
        />
      )}
      <Analytics />
      </div>
    </LanguageProvider>
  )
}
