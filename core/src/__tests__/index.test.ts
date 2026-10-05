import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * mount() must resolve config PER ELEMENT.
 *
 * A WordPress site can run the Velora breeder plugin and the Velora club
 * plugin at the same time. Each publishes its own config global; a widget says
 * which one it belongs to via data-velora-config. When that lookup was a single
 * shared global, the plugin enqueued last won and the other plugin's contact
 * form POSTed to the wrong REST proxy — the inquiry was silently lost.
 *
 * The widget classes are stubbed out on purpose: this file is about what the
 * registry hands each widget, not about what widgets render. Stubbing also
 * keeps the real widget modules out of this suite's coverage denominator,
 * where they would otherwise show up as loaded-but-untested.
 */

interface MountRecord {
  root: HTMLElement
  config: { apiBase: string; contactProxyUrl: string | null }
}

const mounts = vi.hoisted(() => [] as MountRecord[])

const stubWidget = vi.hoisted(
  () => () =>
    class {
      constructor(root: HTMLElement, config: MountRecord['config']) {
        mounts.push({ root, config })
      }
      mount(): void {}
    },
)

vi.mock('../widgets/about', () => ({ AboutWidget: stubWidget() }))
vi.mock('../widgets/breeder-animals', () => ({ BreederAnimalsWidget: stubWidget() }))
vi.mock('../widgets/breeder-contact', () => ({ BreederContactWidget: stubWidget() }))
vi.mock('../widgets/gallery', () => ({ GalleryWidget: stubWidget() }))
vi.mock('../widgets/club-breeders', () => ({ ClubBreedersWidget: stubWidget() }))
vi.mock('../widgets/club-contact', () => ({ ClubContactWidget: stubWidget() }))
vi.mock('../widgets/club-documents', () => ({ ClubDocumentsWidget: stubWidget() }))
vi.mock('../widgets/events', () => ({ EventsWidget: stubWidget() }))
vi.mock('../widgets/listings', () => ({ ListingsWidget: stubWidget() }))
vi.mock('../widgets/posts', () => ({ PostsWidget: stubWidget() }))

const CONFIG_GLOBALS = ['VeloraEmbedConfig', 'VeloraBreederEmbedConfig', 'VeloraClubEmbedConfig'] as const

const BREEDER_PROXY = 'https://site.example/wp-json/velora-breeder/v1/contact'
const CLUB_PROXY = 'https://site.example/wp-json/velora-club/v1/contact'

function setGlobalConfig(name: string, value: Record<string, unknown>): void {
  ;(window as unknown as Record<string, unknown>)[name] = value
}

/** Appends a widget mount point; `configGlobal` omitted = plain-HTML embed. */
function addWidget(type: string, configGlobal?: string): HTMLElement {
  const el = document.createElement('div')
  el.dataset.veloraWidget = type
  if (configGlobal) el.dataset.veloraConfig = configGlobal
  document.body.appendChild(el)
  return el
}

function clearEnvironment(): void {
  for (const name of CONFIG_GLOBALS) {
    delete (window as unknown as Record<string, unknown>)[name]
  }
  document.body.replaceChildren()
  mounts.length = 0
}

/** Imports the bundle fresh so its mount-on-load side effect runs again. */
async function loadBundle(): Promise<void> {
  vi.resetModules()
  await import('../index')
}

describe('mount — per-widget config resolution', () => {
  beforeEach(clearEnvironment)
  afterEach(clearEnvironment)

  it('gives each widget the config named by its own data-velora-config', async () => {
    setGlobalConfig('VeloraBreederEmbedConfig', {
      apiBase: 'https://breeder-api.example',
      contactProxyUrl: BREEDER_PROXY,
    })
    setGlobalConfig('VeloraClubEmbedConfig', {
      apiBase: 'https://club-api.example',
      contactProxyUrl: CLUB_PROXY,
    })
    const breederRoot = addWidget('breeder-contact', 'VeloraBreederEmbedConfig')
    const clubRoot = addWidget('club-contact', 'VeloraClubEmbedConfig')

    await loadBundle()

    expect(mounts).toHaveLength(2)
    expect(mounts[0].root).toBe(breederRoot)
    expect(mounts[0].config.contactProxyUrl).toBe(BREEDER_PROXY)
    expect(mounts[0].config.apiBase).toBe('https://breeder-api.example')
    expect(mounts[1].root).toBe(clubRoot)
    expect(mounts[1].config.contactProxyUrl).toBe(CLUB_PROXY)
    expect(mounts[1].config.apiBase).toBe('https://club-api.example')
  })

  it('falls back to the shared global for plain HTML embeds with no config name', async () => {
    setGlobalConfig('VeloraEmbedConfig', { apiBase: 'https://plain-html.example' })
    addWidget('about')

    await loadBundle()

    expect(mounts).toHaveLength(1)
    expect(mounts[0].config.apiBase).toBe('https://plain-html.example')
  })

  it('falls back to the shared global when the named one was never published', async () => {
    setGlobalConfig('VeloraEmbedConfig', { apiBase: 'https://plain-html.example' })
    addWidget('about', 'VeloraBreederEmbedConfig')

    await loadBundle()

    expect(mounts).toHaveLength(1)
    expect(mounts[0].config.apiBase).toBe('https://plain-html.example')
  })

  it('ignores an unknown widget type instead of mounting it', async () => {
    setGlobalConfig('VeloraEmbedConfig', { apiBase: 'https://plain-html.example' })
    addWidget('not-a-widget')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await loadBundle()

    expect(mounts).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('mounts a given element only once', async () => {
    setGlobalConfig('VeloraEmbedConfig', { apiBase: 'https://plain-html.example' })
    const root = addWidget('about')

    await loadBundle()
    window.VeloraEmbed?.mount?.(root)

    expect(mounts).toHaveLength(1)
  })
})
