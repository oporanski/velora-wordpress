import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient, VeloraApiError } from '../api-client'
import type { VeloraConfig } from '../config'

const BASE_CONFIG: VeloraConfig = {
  apiBase: 'https://api.velora.pet',
  profileBase: 'https://velora.pet',
  apiKey: 'test-key',
  locale: 'pl',
  theme: 'light',
  contactProxyUrl: null,
  showCredit: false,
}

function makeClient(overrides?: Partial<VeloraConfig>): ApiClient {
  return new ApiClient({ ...BASE_CONFIG, ...overrides })
}

function mockFetchOk(data: unknown, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  })
}

describe('ApiClient', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // getBreederAnimals
  // -------------------------------------------------------------------------

  describe('getBreederAnimals', () => {
    it('calls correct URL with default limit', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getBreederAnimals('my-cattery')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/breeders/my-cattery/animals?limit=12',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('calls correct URL with explicit limit', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getBreederAnimals('my-cattery', 6)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/breeders/my-cattery/animals?limit=6',
        expect.anything(),
      )
    })

    it('URL-encodes slug with special chars', async () => {
      global.fetch = mockFetchOk({ data: [] })
      await makeClient().getBreederAnimals('my cattery/test', 12)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('my%20cattery%2Ftest'),
        expect.anything(),
      )
    })

    it('returns empty array when data is missing from response', async () => {
      global.fetch = mockFetchOk({})
      const result = await makeClient().getBreederAnimals('test')
      expect(result).toEqual([])
    })

    it('prefixes relative asset URLs with profileBase', async () => {
      const animal = {
        id: '1',
        name: 'Kot',
        slug: 's',
        breed: 'MC',
        sex: 'MALE',
        birthDate: '2020',
        photoUrl: '/uploads/cat.jpg',
      }
      global.fetch = mockFetchOk({ data: [animal] })
      const client = makeClient({ profileBase: 'https://velora.pet' })
      const [result] = await client.getBreederAnimals('test')
      expect(result.photoUrl).toBe('https://velora.pet/uploads/cat.jpg')
    })

    it('leaves absolute asset URLs unchanged', async () => {
      const animal = {
        id: '1',
        name: 'Kot',
        slug: 's',
        breed: 'MC',
        sex: 'MALE',
        birthDate: '2020',
        photoUrl: 'https://cdn.example.com/cat.jpg',
      }
      global.fetch = mockFetchOk({ data: [animal] })
      const client = makeClient({ profileBase: 'https://velora.pet' })
      const [result] = await client.getBreederAnimals('test')
      expect(result.photoUrl).toBe('https://cdn.example.com/cat.jpg')
    })
  })

  // -------------------------------------------------------------------------
  // getClubBreeders
  // -------------------------------------------------------------------------

  describe('getClubBreeders', () => {
    it('calls correct URL with limit', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getClubBreeders('my-club', 50)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/clubs/my-club/breeders?limit=50&page=1',
        expect.anything(),
      )
    })

    it('returns empty array on missing data', async () => {
      global.fetch = mockFetchOk({})
      expect(await makeClient().getClubBreeders('c')).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // getEvents
  // -------------------------------------------------------------------------

  describe('getEvents', () => {
    it('calls correct URL for breeders with all params', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getEvents('breeders', 'my-cattery', 20, 'past')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/breeders/my-cattery/events?limit=20&when=past',
        expect.anything(),
      )
    })

    it('calls correct URL for clubs', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getEvents('clubs', 'gff', 12, 'upcoming')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/clubs/gff/events?limit=12&when=upcoming',
        expect.anything(),
      )
    })
  })

  // -------------------------------------------------------------------------
  // postBreederContact
  // -------------------------------------------------------------------------

  describe('postBreederContact', () => {
    const payload = {
      name: 'Jan',
      email: 'jan@test.pl',
      subject: 'Hi',
      message: 'Hello',
      consent: true as const,
      captchaToken: 'tok123',
    }

    it('posts to proxy when contactProxyUrl is configured', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn() })
      global.fetch = fetchMock
      const client = makeClient({ contactProxyUrl: 'https://wp.site/wp-json/velora-breeder/v1/contact' })
      await client.postBreederContact('my-cattery', payload)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://wp.site/wp-json/velora-breeder/v1/contact',
        expect.objectContaining({ method: 'POST' }),
      )
      // Slug must be included in the proxied payload
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>
      expect(body.slug).toBe('my-cattery')
    })

    it('posts to direct API when no proxy configured', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn() })
      global.fetch = fetchMock
      const client = makeClient({ contactProxyUrl: null, apiKey: 'secret' })
      await client.postBreederContact('my-cattery', payload)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/breeders/my-cattery/contact',
        expect.anything(),
      )
    })

    it('throws VeloraApiError on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))
      const client = makeClient({ apiKey: 'key' })
      await expect(client.postBreederContact('slug', payload)).rejects.toBeInstanceOf(VeloraApiError)
    })

    it('throws VeloraApiError on non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({ message: 'Validation failed' }),
      })
      const client = makeClient({ apiKey: 'key' })
      await expect(client.postBreederContact('slug', payload)).rejects.toBeInstanceOf(VeloraApiError)
    })

    it('throws VeloraApiError with NO_API_KEY when key missing and no proxy', async () => {
      const client = makeClient({ contactProxyUrl: null, apiKey: null })
      await expect(client.postBreederContact('slug', payload)).rejects.toMatchObject({
        info: { code: 'NO_API_KEY' },
      })
    })

    it('includes correct Content-Type header', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn() })
      global.fetch = fetchMock
      const client = makeClient({ contactProxyUrl: 'https://proxy.example.com' })
      await client.postBreederContact('slug', payload)
      const reqInit = fetchMock.mock.calls[0][1] as RequestInit
      const headers = new Headers(reqInit.headers)
      expect(headers.get('Content-Type')).toBe('application/json')
    })
  })

  // -------------------------------------------------------------------------
  // postClubContact
  // -------------------------------------------------------------------------

  describe('postClubContact', () => {
    it('posts to correct direct API endpoint', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn() })
      global.fetch = fetchMock
      const client = makeClient({ apiKey: 'key' })
      const contactPayload = {
        name: 'Jan',
        email: 'j@j.pl',
        subject: 'Hi',
        message: 'Hey',
        consent: true as const,
        captchaToken: 'tok',
      }
      await client.postClubContact('my-club', contactPayload)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/clubs/my-club/contact',
        expect.anything(),
      )
    })

    it('throws NO_API_KEY when no key and no proxy', async () => {
      const client = makeClient({ apiKey: null, contactProxyUrl: null })
      const contactPayload = {
        name: 'Jan',
        email: 'j@j.pl',
        subject: 'Hi',
        message: 'Hey',
        consent: true as const,
        captchaToken: 'tok',
      }
      await expect(client.postClubContact('slug', contactPayload)).rejects.toMatchObject({
        info: { code: 'NO_API_KEY' },
      })
    })
  })

  // -------------------------------------------------------------------------
  // getListings / getPosts / getProfile / getGallery / getClubDocuments
  // -------------------------------------------------------------------------

  describe('getListings', () => {
    it('calls correct URL', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getListings('breeders', 'my-cattery', 12)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/breeders/my-cattery/listings?limit=12',
        expect.anything(),
      )
    })
  })

  describe('getPosts', () => {
    it('calls correct URL', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getPosts('clubs', 'gff', 6)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/clubs/gff/posts?limit=6',
        expect.anything(),
      )
    })
  })

  describe('getProfile', () => {
    it('calls correct URL for breeders', async () => {
      const fetchMock = mockFetchOk({ id: '1', name: 'Velvet Paws', slug: 'velvet-paws', logo: null, description: null, city: null, country: null })
      global.fetch = fetchMock
      await makeClient().getProfile('breeders', 'velvet-paws')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/breeders/velvet-paws',
        expect.anything(),
      )
    })
  })

  describe('getGallery', () => {
    it('calls correct URL', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getGallery('clubs', 'gff', 30)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/clubs/gff/gallery?photosPerAlbum=30',
        expect.anything(),
      )
    })
  })

  describe('getClubDocuments', () => {
    it('calls correct URL', async () => {
      const fetchMock = mockFetchOk({ data: [] })
      global.fetch = fetchMock
      await makeClient().getClubDocuments('gff', 100)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.velora.pet/v1/clubs/gff/documents?limit=100',
        expect.anything(),
      )
    })
  })

  // -------------------------------------------------------------------------
  // VeloraApiError
  // -------------------------------------------------------------------------

  describe('VeloraApiError', () => {
    it('has correct name and message', () => {
      const err = new VeloraApiError({ status: 404, message: 'Not found', code: 'NOT_FOUND' })
      expect(err.name).toBe('VeloraApiError')
      expect(err.message).toBe('Not found')
      expect(err.info.status).toBe(404)
      expect(err.info.code).toBe('NOT_FOUND')
    })

    it('is an instance of Error', () => {
      const err = new VeloraApiError({ status: 0, message: 'test' })
      expect(err).toBeInstanceOf(Error)
    })
  })
})
