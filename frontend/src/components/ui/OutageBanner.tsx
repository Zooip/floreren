import { useEffect, useState } from 'react'
import { onApiOutage, type OutageCode } from '../../api/client'
import { useT } from '../../context/LanguageContext'
import Glyph from './Glyph'

/**
 * Says out loud when the database is the problem.
 *
 * Without this, a database outage looks like the app being broken: requests
 * fail, screens stay empty, and the browser console blames CORS because a
 * dead API answers with nothing a browser can read. That cost an afternoon of
 * hunting for a bug in the app in September, twice.
 *
 * So it names the cause and, more importantly, names which cause. A spent
 * compute allowance is not a bug and a retry will not fix it; any other
 * connection failure usually clears on its own. Those want different things
 * from the reader, so they get different words.
 *
 * Light in tone, honest in content: it is not the reader's fault, their plants
 * are fine, and nothing they do will speed it up.
 */
export default function OutageBanner() {
  const t = useT()
  const [outage, setOutage] = useState<OutageCode | null>(null)

  useEffect(() => {
    onApiOutage(setOutage)
    return () => onApiOutage(null)
  }, [])

  if (!outage) return null

  const quota = outage === 'database_quota_exceeded'
  const copy = quota ? t.outage.quota : t.outage.unreachable

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] px-3 pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto mt-2 max-w-md rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 shadow-lg dark:bg-amber-950/90">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-amber-600">
            <Glyph name="leaf" size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {copy.title}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-amber-800 dark:text-amber-200">
              {copy.body}
            </p>
          </div>
          <button
            onClick={() => setOutage(null)}
            aria-label={t.common.close}
            className="shrink-0 rounded p-1 text-amber-700 dark:text-amber-300"
          >
            <Glyph name="x" size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
