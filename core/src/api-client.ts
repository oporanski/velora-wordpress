import type { VeloraConfig } from './config'

export interface ApiError {
  status: number
  message: string
  code?: string
}

export class VeloraApiError extends Error {
  constructor(public readonly info: ApiError) {
    super(info.message)
    this.name = 'VeloraApiError'
  }
}

// Breed/color relation objects as the current API returns them.
export interface BreedRelation {
  name: string
}
export interface ColorRelation {
  /**
   * Colour names are English in every UI language — the portal retired the
   * Polish ones (machine-composed from the EMS code, they read as nonsense in
   * Polish). The `namePl` column still exists on the row and still arrives in
   * the payload; it is deliberately not declared here so no widget reads it.
   */
  nameEn: string
  emsCode: string
}

// The API is mid-transition: the live portal returns breed/color as Prisma
// relation objects (breedRef/colorRef), while a future clean-contract version
// will return flat breed/color strings. The WP plugin ships independently of
// the portal backend, so widgets must tolerate BOTH shapes — read via the
// breedName()/colorName() helpers, never the raw fields directly.
export interface BreederAnimal {
  id: string
  name: string
  slug: string
  breed?: string | null
  breedRef?: BreedRelation | null
  color?: string | null
  colorRef?: ColorRelation | null
  sex: 'MALE' | 'FEMALE'
  birthDate: string
  photoUrl: string | null
  titles?: string[]
}

// Backend returns full AnimalBreed objects instead of plain strings.
// BreedRef is the actual runtime shape; ClubBreeder.breeds is the normalized form.
export type BreedRef = string | { name: string }

export interface ClubBreeder {
  id: string
  slug: string
  name: string
  logo: string | null
  species: 'CAT' | 'DOG'
  breeds?: string[]
  city: string | null
  region?: string | null
  country: string | null
  verified?: boolean
}

// Raw API response shape before normalization — breeds may be objects.
export type RawClubBreeder = Omit<ClubBreeder, 'breeds'> & { breeds?: BreedRef[] }

export interface VeloraEvent {
  id: string
  title: string
  slug: string | null
  startDate: string
  endDate: string | null
  city: string | null
  country: string | null
  imageUrl: string | null
}

export interface VeloraListing {
  id: string
  slug: string | null
  title: string
  price: number | null
  currency: string
  species: 'CAT' | 'DOG'
  // Transition shape — read via breedName(). See BreederAnimal note above.
  breed?: string | null
  breedRef?: BreedRelation | null
  city: string | null
  country: string | null
  images: string[]
  createdAt: string
}

export interface VeloraPost {
  id: string
  title: string
  content: string
  mediaUrls: string[]
  publishedAt: string
  createdAt: string
}

export interface VeloraProfile {
  id: string
  name: string
  slug: string
  species?: 'CAT' | 'DOG'
  // Backend serves breeds as AnimalBreed objects; normalize with normalizeBreeds().
  breeds?: BreedRef[]
  logo: string | null
  description: string | null
  city: string | null
  region?: string | null
  country: string | null
  foundedYear?: number | null
  contactEmail?: string | null
  contactPhone?: string | null
  socialFacebook?: string | null
  socialInstagram?: string | null
  socialYoutube?: string | null
  socialTiktok?: string | null
  socialWebsite?: string | null
  verified?: boolean
}

export interface VeloraGalleryPhoto {
  id: string
  fileUrl: string
  thumbnailUrl: string | null
  title: string | null
  description: string | null
  width: number | null
  height: number | null
  createdAt: string
}

export interface VeloraGalleryAlbum {
  id: string
  name: string
  description: string | null
  photoCount: number
  coverPhoto: string | null
  photos: VeloraGalleryPhoto[]
}

/**
 * A club document as `GET /v1/clubs/:slug/documents` serves it.
 *
 * `downloadUrl` — NOT the file's storage address. The portal never publishes
 * that: the file is reachable only through its own download route, which
 * re-checks that the club is still publicly visible and counts the download.
 * The API returns that route, already made absolute for us. The field it
 * replaced (`fileUrl`) pointed at an internal `/uploads/{hash}` path that the
 * portal answered with 404, so the old link never downloaded anything.
 */
export interface VeloraDocument {
  id: string
  title: string
  description: string | null
  category: string
  downloadUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total?: number
  page?: number
}

/**
 * Both contact forms send exactly this. They used to differ — the breeder one
 * carried a preferred breed and litter, the club one a chosen topic — but the
 * WordPress proxy rebuilds the payload from a fixed field list and dropped all
 * three, so the extra fields were removed rather than plumbed through. One
 * shape now, because there is one shape.
 */
export interface ContactPayload {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  consent: true
  /** Cap.js proof-of-work verification token (issued by /v1/captcha/redeem). */
  captchaToken: string
}

/**
 * Recursively prefix any string starting with "/" with profileBase.
 *
 * Velora stores asset URLs as relative paths in the DB (e.g.
 * `/img/cat18.webp`, `/uploads/breeders/.../logo.png`). The backend's
 * ProxyService can prefix these server-side when ASSET_BASE_URL is set,
 * but it has no way of knowing which third-party origin the embed is
 * running on, so the responsibility falls on the embed itself: every
 * relative URL gets the breeder's configured profileBase
 * (https://velora.pet in production) prepended before render.
 */
function prefixAssetUrls<T>(value: T, base: string): T {
  if (!base) return value
  const normBase = base.replace(/\/$/, '')
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.startsWith('/') ? `${normBase}${v}` : v
    if (Array.isArray(v)) return v.map(walk)
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v)) out[k] = walk(val)
      return out
    }
    return v
  }
  return walk(value) as T
}

export class ApiClient {
  constructor(private readonly config: VeloraConfig) {}

  /** GET helper — fetches, parses JSON, and prefixes any "/foo" URL with profileBase. */
  private async getJson<T>(url: string): Promise<T> {
    const res = await this.fetch(url, { method: 'GET' })
    const body = (await res.json()) as T
    return prefixAssetUrls(body, this.config.profileBase)
  }

  async getBreederAnimals(slug: string, limit = 12): Promise<BreederAnimal[]> {
    const body = await this.getJson<PaginatedResponse<BreederAnimal>>(
      `${this.config.apiBase}/v1/breeders/${encodeURIComponent(slug)}/animals?limit=${limit}`,
    )
    return body.data ?? []
  }

  async getClubBreeders(slug: string, limit = 50): Promise<RawClubBreeder[]> {
    const body = await this.getJson<PaginatedResponse<RawClubBreeder>>(
      `${this.config.apiBase}/v1/clubs/${encodeURIComponent(slug)}/breeders?limit=${limit}`,
    )
    return body.data ?? []
  }

  async getEvents(
    source: 'breeders' | 'clubs',
    slug: string,
    limit = 20,
    when: 'upcoming' | 'past' | 'all' = 'upcoming',
  ): Promise<VeloraEvent[]> {
    const body = await this.getJson<PaginatedResponse<VeloraEvent>>(
      `${this.config.apiBase}/v1/${source}/${encodeURIComponent(slug)}/events?limit=${limit}&when=${when}`,
    )
    return body.data ?? []
  }

  async getListings(source: 'breeders' | 'clubs', slug: string, limit = 20): Promise<VeloraListing[]> {
    const body = await this.getJson<PaginatedResponse<VeloraListing>>(
      `${this.config.apiBase}/v1/${source}/${encodeURIComponent(slug)}/listings?limit=${limit}`,
    )
    return body.data ?? []
  }

  async getPosts(source: 'breeders' | 'clubs', slug: string, limit = 10): Promise<VeloraPost[]> {
    const body = await this.getJson<PaginatedResponse<VeloraPost>>(
      `${this.config.apiBase}/v1/${source}/${encodeURIComponent(slug)}/posts?limit=${limit}`,
    )
    return body.data ?? []
  }

  async getProfile(source: 'breeders' | 'clubs', slug: string): Promise<VeloraProfile> {
    return this.getJson<VeloraProfile>(
      `${this.config.apiBase}/v1/${source}/${encodeURIComponent(slug)}`,
    )
  }

  // Breeder litters are PRIVATE breeder data — never exposed via the public embed.
  // (Endpoint also removed from external-api.)

  async getGallery(source: 'breeders' | 'clubs', slug: string, photosPerAlbum = 30): Promise<VeloraGalleryAlbum[]> {
    const body = await this.getJson<PaginatedResponse<VeloraGalleryAlbum>>(
      `${this.config.apiBase}/v1/${source}/${encodeURIComponent(slug)}/gallery?photosPerAlbum=${photosPerAlbum}`,
    )
    return body.data ?? []
  }

  async getClubDocuments(slug: string, limit = 50): Promise<VeloraDocument[]> {
    const body = await this.getJson<PaginatedResponse<VeloraDocument>>(
      `${this.config.apiBase}/v1/clubs/${encodeURIComponent(slug)}/documents?limit=${limit}`,
    )
    return body.data ?? []
  }

  async postBreederContact(slug: string, payload: ContactPayload): Promise<void> {
    // If a server-side proxy is configured (WP plugin sets this), POST
    // there same-origin — no API key in browser. The PHP handler reads
    // the key from wp_options server-side and forwards. Plain-HTML
    // embeds with no proxy fall back to direct API + Bearer key.
    const proxy = this.config.contactProxyUrl
    if (proxy) {
      await this.fetch(proxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, slug }),
      })
      return
    }
    const url = `${this.config.apiBase}/v1/breeders/${encodeURIComponent(slug)}/contact`
    await this.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, { requireAuth: true })
  }

  async postClubContact(slug: string, payload: ContactPayload): Promise<void> {
    const proxy = this.config.contactProxyUrl
    if (proxy) {
      await this.fetch(proxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, slug }),
      })
      return
    }
    const url = `${this.config.apiBase}/v1/clubs/${encodeURIComponent(slug)}/contact`
    await this.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, { requireAuth: true })
  }

  private async fetch(
    url: string,
    init: RequestInit,
    opts: { requireAuth?: boolean } = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers ?? {})
    if (opts.requireAuth) {
      if (!this.config.apiKey) {
        throw new VeloraApiError({ status: 0, message: 'API key not configured', code: 'NO_API_KEY' })
      }
      headers.set('Authorization', `Bearer ${this.config.apiKey}`)
    }

    let res: Response
    try {
      res = await fetch(url, { ...init, headers })
    } catch (e) {
      throw new VeloraApiError({
        status: 0,
        message: e instanceof Error ? `Network error: ${e.message}` : 'Network error',
        code: 'NETWORK',
      })
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`
      try {
        const body = (await res.json()) as { message?: string; error?: string }
        message = body.message ?? body.error ?? message
      } catch {
        // Response body is not JSON — keep the default HTTP status message.
      }
      throw new VeloraApiError({ status: res.status, message })
    }

    return res
  }
}
