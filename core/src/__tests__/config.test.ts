import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveConfig, resolveTheme } from '../config'

function clearConfigGlobals(): void {
  const win = window as unknown as Record<string, unknown>
  delete win.VeloraEmbedConfig
  delete win.VeloraBreederEmbedConfig
  delete win.VeloraClubEmbedConfig
  document.querySelectorAll('meta[name^="velora-"]').forEach((el) => el.remove())
}

describe('resolveConfig', () => {
  beforeEach(clearConfigGlobals)

  afterEach(clearConfigGlobals)

  // Both Velora plugins can be active on one site. Each publishes its own
  // config global; reading the wrong one sends contact-form submissions to
  // the other plugin's REST proxy, where they are lost.
  it('reads the named config global instead of the shared one', () => {
    const win = window as unknown as Record<string, unknown>
    win.VeloraBreederEmbedConfig = {
      contactProxyUrl: 'https://site.example/wp-json/velora-breeder/v1/contact',
    }
    win.VeloraClubEmbedConfig = {
      contactProxyUrl: 'https://site.example/wp-json/velora-club/v1/contact',
    }

    expect(resolveConfig('VeloraBreederEmbedConfig').contactProxyUrl).toBe(
      'https://site.example/wp-json/velora-breeder/v1/contact',
    )
    expect(resolveConfig('VeloraClubEmbedConfig').contactProxyUrl).toBe(
      'https://site.example/wp-json/velora-club/v1/contact',
    )
  })

  it('falls back to the shared global when the named one is absent', () => {
    ;(window as unknown as Record<string, unknown>).VeloraEmbedConfig = {
      apiBase: 'https://shared.example',
    }
    expect(resolveConfig('VeloraBreederEmbedConfig').apiBase).toBe('https://shared.example')
  })

  it('uses defaults when nothing is configured', () => {
    const cfg = resolveConfig()
    expect(cfg.apiBase).toBe('https://velora.pet')
    expect(cfg.locale).toBe('pl')
    expect(cfg.theme).toBe('auto')
    expect(cfg.apiKey).toBeNull()
    expect(cfg.contactProxyUrl).toBeNull()
    // WP.org guideline #10 — the "Powered by Velora" credit is opt-in.
    expect(cfg.showCredit).toBe(false)
  })

  it('enables showCredit only when the host page opts in', () => {
    ;(window as unknown as Record<string, unknown>).VeloraEmbedConfig = { showCredit: true }
    expect(resolveConfig().showCredit).toBe(true)
  })

  it('reads showCredit from a meta tag and treats anything but "true" as off', () => {
    const meta = document.createElement('meta')
    meta.name = 'velora-show-credit'
    meta.content = 'yes'
    document.head.appendChild(meta)
    expect(resolveConfig().showCredit).toBe(false)

    meta.content = 'true'
    expect(resolveConfig().showCredit).toBe(true)
  })

  it('window showCredit=false wins over a meta tag asking for the credit', () => {
    ;(window as unknown as Record<string, unknown>).VeloraEmbedConfig = { showCredit: false }
    const meta = document.createElement('meta')
    meta.name = 'velora-show-credit'
    meta.content = 'true'
    document.head.appendChild(meta)
    expect(resolveConfig().showCredit).toBe(false)
  })

  it('uses window.VeloraEmbedConfig over defaults', () => {
    ;(window as unknown as Record<string, unknown>).VeloraEmbedConfig = {
      apiBase: 'https://api.velora.pet',
      locale: 'en',
    }
    const cfg = resolveConfig()
    expect(cfg.apiBase).toBe('https://api.velora.pet')
    expect(cfg.locale).toBe('en')
    // profileBase still from defaults (not set in window config)
    expect(cfg.profileBase).toBe('https://velora.pet')
  })

  it('uses meta tags as fallback when window config absent', () => {
    const meta = document.createElement('meta')
    meta.name = 'velora-api-base'
    meta.content = 'https://meta-api.velora.pet'
    document.head.appendChild(meta)
    const cfg = resolveConfig()
    expect(cfg.apiBase).toBe('https://meta-api.velora.pet')
  })

  it('window config takes priority over meta tags', () => {
    ;(window as unknown as Record<string, unknown>).VeloraEmbedConfig = {
      apiBase: 'https://window-api.velora.pet',
    }
    const meta = document.createElement('meta')
    meta.name = 'velora-api-base'
    meta.content = 'https://meta-api.velora.pet'
    document.head.appendChild(meta)
    const cfg = resolveConfig()
    expect(cfg.apiBase).toBe('https://window-api.velora.pet')
  })

  it('reads apiKey from meta tag when window config has no apiKey', () => {
    const meta = document.createElement('meta')
    meta.name = 'velora-api-key'
    meta.content = 'meta-key-123'
    document.head.appendChild(meta)
    const cfg = resolveConfig()
    expect(cfg.apiKey).toBe('meta-key-123')
  })

  it('reads contactProxyUrl from window config', () => {
    ;(window as unknown as Record<string, unknown>).VeloraEmbedConfig = {
      contactProxyUrl: 'https://wp.example.com/wp-json/velora-breeder/v1/contact',
    }
    const cfg = resolveConfig()
    expect(cfg.contactProxyUrl).toBe('https://wp.example.com/wp-json/velora-breeder/v1/contact')
  })

  it('profileBase falls back to default when absent in both sources', () => {
    const cfg = resolveConfig()
    expect(cfg.profileBase).toBe('https://velora.pet')
  })
})

describe('resolveTheme', () => {
  it('returns "light" for explicit light', () => {
    expect(resolveTheme('light')).toBe('light')
  })

  it('returns "dark" for explicit dark', () => {
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('returns "light" for auto when matchMedia is not available', () => {
    const original = window.matchMedia
    ;(window as unknown as Record<string, unknown>).matchMedia = undefined
    expect(resolveTheme('auto')).toBe('light')
    ;(window as unknown as Record<string, unknown>).matchMedia = original
  })

  it('returns "light" for auto when matchMedia does not match dark', () => {
    const original = window.matchMedia
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
    expect(resolveTheme('auto')).toBe('light')
    window.matchMedia = original
  })

  it('returns "dark" for auto when matchMedia matches dark', () => {
    const original = window.matchMedia
    window.matchMedia = (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
    expect(resolveTheme('auto')).toBe('dark')
    window.matchMedia = original
  })
})

describe('resolveConfig config-global allowlist', () => {
  beforeEach(clearConfigGlobals)
  afterEach(clearConfigGlobals)

  // data-velora-config is page-authored: it can name any window property.
  it('ignores a global name outside the Velora*EmbedConfig pattern', () => {
    const win = window as unknown as Record<string, unknown>
    win.VeloraEmbedConfig = { apiBase: 'https://shared.example' }
    expect(resolveConfig('location').apiBase).toBe('https://shared.example')
    expect(resolveConfig('navigator').apiBase).toBe('https://shared.example')
  })

  it('still accepts the names the plugins publish', () => {
    const win = window as unknown as Record<string, unknown>
    win.VeloraClubEmbedConfig = { apiBase: 'https://club.example' }
    expect(resolveConfig('VeloraClubEmbedConfig').apiBase).toBe('https://club.example')
  })
})
