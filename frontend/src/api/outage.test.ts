import { describe, expect, it, vi, beforeEach } from 'vitest'
import { onApiOutage } from './client'

/** The client has to recognise the outage for the banner to exist at all.
 *  These drive `ensureOk` through a faked `fetch`, since that is the only
 *  place the code is read. */

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('API outage detection', () => {
  beforeEach(() => {
    onApiOutage(null)
    // These run in the node environment, where the client's token lookup has
    // no localStorage to read.
    vi.stubGlobal('localStorage', {
      getItem: () => null, setItem: () => {}, removeItem: () => {},
    })
  })

  it('reports a spent database quota to the banner', async () => {
    const seen: string[] = []
    onApiOutage(code => seen.push(code))
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse(503, { detail: 'database_quota_exceeded' })))

    const { apiRequest } = await import('./client')
    await expect(apiRequest('GET', '/plants')).rejects.toThrow()

    expect(seen).toEqual(['database_quota_exceeded'])
  })

  it('does not cry outage over an ordinary server error', async () => {
    // The failure mode worth guarding: a friendly "come back later" banner
    // over a genuine bug would hide it indefinitely.
    const seen: string[] = []
    onApiOutage(code => seen.push(code))
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse(500, { detail: 'Internal server error' })))

    const { apiRequest } = await import('./client')
    await expect(apiRequest('GET', '/plants')).rejects.toThrow()

    expect(seen).toEqual([])
  })

  it('ignores a 503 that carries no code we know', async () => {
    const seen: string[] = []
    onApiOutage(code => seen.push(code))
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse(503, { detail: 'something else entirely' })))

    const { apiRequest } = await import('./client')
    await expect(apiRequest('GET', '/plants')).rejects.toThrow()

    expect(seen).toEqual([])
  })
})
