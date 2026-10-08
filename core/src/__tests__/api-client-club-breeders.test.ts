import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiClient } from '../api-client'
import type { RawClubBreeder } from '../api-client'
import type { VeloraConfig } from '../config'

const CONFIG: VeloraConfig = {
  apiBase: 'https://api.test',
  profileBase: 'https://test.pet',
  apiKey: null,
  locale: 'en',
  theme: 'light',
  contactProxyUrl: null,
  showCredit: false,
}

const SERVER_PAGE_SIZE = 50

function rows(n: number): RawClubBreeder[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `b-${i}`,
    slug: `cattery-${i}`,
    name: `Cattery ${i}`,
    logo: null,
    species: 'CAT',
    breeds: [],
    city: null,
    region: null,
    country: null,
    verified: false,
  }))
}

function respond(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) }
}

/** Mimics production: page size capped at 50 whatever `limit` says, `page` honoured. */
function cappedServer(total: number): ReturnType<typeof vi.fn> {
  const all = rows(total)
  return vi.fn((url: string) => {
    const page = Number(new URL(url).searchParams.get('page') ?? '1')
    const data = all.slice((page - 1) * SERVER_PAGE_SIZE, page * SERVER_PAGE_SIZE)
    return Promise.resolve(respond({ data, total, page, limit: SERVER_PAGE_SIZE }))
  })
}

describe('ApiClient.getClubBreeders paging', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  it('collects every page the server caps at 50 rows', async () => {
    const fetchMock = cappedServer(80)
    global.fetch = fetchMock as unknown as typeof fetch
    const out = await new ApiClient(CONFIG).getClubBreeders('club')
    expect(out).toHaveLength(80)
    expect(new Set(out.map((b) => b.id)).size).toBe(80)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops after the first page when the server ignores `page`', async () => {
    const first = rows(SERVER_PAGE_SIZE)
    const fetchMock = vi.fn(() =>
      Promise.resolve(respond({ data: first, total: 80, page: 1, limit: SERVER_PAGE_SIZE })),
    )
    global.fetch = fetchMock as unknown as typeof fetch
    const out = await new ApiClient(CONFIG).getClubBreeders('club')
    expect(out).toHaveLength(SERVER_PAGE_SIZE)
    expect(new Set(out.map((b) => b.id)).size).toBe(SERVER_PAGE_SIZE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns no more than the requested limit', async () => {
    const fetchMock = cappedServer(80)
    global.fetch = fetchMock as unknown as typeof fetch
    const out = await new ApiClient(CONFIG).getClubBreeders('club', 10)
    expect(out).toHaveLength(10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('trims the last page to the limit', async () => {
    global.fetch = cappedServer(80) as unknown as typeof fetch
    const out = await new ApiClient(CONFIG).getClubBreeders('club', 60)
    expect(out).toHaveLength(60)
  })

  it('stops at the page ceiling when total is unknown and pages stay full', async () => {
    let page = 0
    const fetchMock = vi.fn(() => {
      const start = page++ * SERVER_PAGE_SIZE
      const data = rows(start + SERVER_PAGE_SIZE).slice(start)
      return Promise.resolve(respond({ data, limit: SERVER_PAGE_SIZE }))
    })
    global.fetch = fetchMock as unknown as typeof fetch
    const out = await new ApiClient(CONFIG).getClubBreeders('club', 100000)
    expect(fetchMock).toHaveBeenCalledTimes(20)
    expect(out).toHaveLength(20 * SERVER_PAGE_SIZE)
  })
})
