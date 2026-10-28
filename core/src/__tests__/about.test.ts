import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AboutWidget } from '../widgets/about'
import type { VeloraConfig } from '../config'
import type { VeloraProfile } from '../api-client'

const CONFIG: VeloraConfig = {
  apiBase: 'https://api.test',
  profileBase: 'https://test.pet',
  apiKey: null,
  locale: 'en',
  theme: 'light',
  contactProxyUrl: null,
  showCredit: false,
}

const fetchMock = vi.fn()

function profile(overrides: Partial<VeloraProfile> = {}): VeloraProfile {
  return {
    id: 'b1', name: 'Royal Whiskers', slug: 'royal', logo: null, description: null,
    city: null, country: null, ...overrides,
  }
}

async function mountAbout(
  body: unknown,
  attrs: Record<string, string> = {},
  config: Partial<VeloraConfig> = {},
): Promise<HTMLElement> {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) })
  const root = document.createElement('div')
  for (const [k, v] of Object.entries({ 'data-source': 'breeders', 'data-slug': 'royal', ...attrs })) {
    root.setAttribute(k, v)
  }
  document.body.appendChild(root)
  await new AboutWidget(root, { ...CONFIG, ...config }).mount()
  return root
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('AboutWidget', () => {
  it('asks for the profile and links the name to the portal', async () => {
    const root = await mountAbout(profile())
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v1/breeders/royal')
    const title = root.querySelector('a.velora-about-title') as HTMLAnchorElement
    expect(title.href).toBe('https://test.pet/breeders/royal')
    expect(title.textContent).toBe('Royal Whiskers')
  })

  it('shows an initial placeholder without a logo and the logo when present', async () => {
    let root = await mountAbout(profile())
    expect(root.querySelector('.velora-card-avatar-placeholder')?.textContent).toBe('R')
    root = await mountAbout(profile({ logo: 'https://cdn.test/logo.png' }))
    expect((root.querySelector('img.velora-about-logo') as HTMLImageElement).alt).toBe('Royal Whiskers')
  })

  it('renders verified badge, breeds, location and founding year', async () => {
    const root = await mountAbout(profile({
      verified: true,
      breeds: ['Maine Coon', { name: 'Ragdoll' }],
      city: 'Gdansk', region: 'Pomerania', country: 'DE', foundedYear: 2001,
    }))
    expect(root.querySelector('.velora-tag-verified')).not.toBeNull()
    const values = Array.from(root.querySelectorAll('.velora-about-meta-value')).map((e) => e.textContent)
    expect(values).toEqual(['Maine Coon, Ragdoll', 'Gdansk, Pomerania, DE', '2001'])
  })

  it('leaves out the home country from the location', async () => {
    const root = await mountAbout(profile({ city: 'Warsaw', country: 'PL' }))
    expect(root.querySelector('.velora-about-meta-value')?.textContent).toBe('Warsaw')
  })

  it('strips markup from the description', async () => {
    const root = await mountAbout(profile({ description: '<p>Hello <b>cats</b></p><script>x</script>' }))
    expect(root.querySelector('.velora-about-description')?.textContent).toBe('Hello cats x')
  })

  it('omits the description when only markup remains', async () => {
    const root = await mountAbout(profile({ description: '<p></p>' }))
    expect(root.querySelector('.velora-about-description')).toBeNull()
  })

  it('renders contact and social links', async () => {
    const root = await mountAbout(profile({
      contactEmail: 'a@b.test', contactPhone: '+48 123 456',
      socialFacebook: 'https://fb.test/x', socialInstagram: 'https://ig.test/x',
      socialYoutube: 'https://yt.test/x', socialTiktok: 'https://tt.test/x',
      socialWebsite: 'https://site.test',
    }))
    const hrefs = Array.from(root.querySelectorAll('.velora-about-contact a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['mailto:a@b.test', 'tel:+48123456'])
    const social = Array.from(root.querySelectorAll('.velora-about-social a')).map((a) => a.textContent)
    expect(social).toEqual(['Facebook', 'Instagram', 'YouTube', 'TikTok', '🌐 site.test'])
  })

  it('renders no contact or social rows when there is nothing to show', async () => {
    const root = await mountAbout(profile())
    expect(root.querySelector('.velora-about-contact')).toBeNull()
    expect(root.querySelector('.velora-about-social')).toBeNull()
  })

  it('reports missing attributes', async () => {
    const root = await mountAbout(profile(), { 'data-slug': '' })
    expect(root.querySelector('.velora-state-error')).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the error and retries on failure', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    const root = document.createElement('div')
    root.setAttribute('data-source', 'clubs')
    root.setAttribute('data-slug', 'club')
    document.body.appendChild(root)
    await new AboutWidget(root, CONFIG).mount()
    expect(root.querySelector('.velora-state-detail')?.textContent).toContain('boom')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(profile()) })
    root.querySelector<HTMLButtonElement>('.velora-btn-retry')!.click()
    await vi.waitFor(() => expect(root.querySelector('.velora-about-title')).not.toBeNull())
  })

  it('appends the credit footer when enabled', async () => {
    const root = await mountAbout(profile(), {}, { showCredit: true })
    expect(root.querySelector('footer.velora-footer')).not.toBeNull()
  })
})
