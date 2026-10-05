/**
 * Runtime config resolved from (in order of precedence):
 *   1. the config global named by the widget's data-velora-config attribute,
 *      falling back to window.VeloraEmbedConfig — injected by the WP plugin
 *   2. <meta name="velora-api-base" content="..."> on the page
 *   3. hard-coded defaults (the public Velora portal)
 *
 * The config is resolved PER WIDGET, not once per page. A site can run the
 * breeder and the club plugin at the same time, and each publishes its own
 * global (VeloraBreederEmbedConfig / VeloraClubEmbedConfig) whose
 * contactProxyUrl points at its own REST route.
 */

export interface VeloraConfig {
  apiBase: string
  /** Public Velora portal base — used to build profile links from cards/rows. */
  profileBase: string
  apiKey: string | null
  locale: 'pl' | 'en'
  theme: 'auto' | 'light' | 'dark'
  /**
   * Optional same-origin URL of a server-side contact proxy. WP plugin
   * sets this to /wp-json/velora-{breeder|club}/v1/contact so the API
   * key never reaches the browser. When set, contact widgets POST here
   * (no Bearer header needed). When null, widgets fall back to the
   * direct Velora API call with apiKey — used by plain-HTML embeds
   * that have no server to proxy through.
   */
  contactProxyUrl: string | null
  /**
   * Renders the discreet "Powered by Velora" link under each widget.
   * Opt-in and OFF by default: WordPress.org guideline #10 forbids embedding
   * credits or external links on a public site without the site owner
   * explicitly asking for them.
   */
  showCredit: boolean
}

declare global {
  interface Window {
    VeloraEmbedConfig?: Partial<VeloraConfig>
  }
}

const DEFAULTS: VeloraConfig = {
  apiBase: 'https://velora.pet',
  // Public portal — profile links must never resolve to the embedding host.
  profileBase: 'https://velora.pet',
  apiKey: null,
  locale: 'pl',
  theme: 'auto',
  contactProxyUrl: null,
  showCredit: false,
}

function readMeta(name: string): string | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  return el?.content ?? null
}

/** Meta tags carry strings — only the literal "true" turns a boolean flag on. */
function readBoolMeta(name: string, fallback: boolean): boolean {
  const raw = readMeta(name)
  return raw === null ? fallback : raw === 'true'
}

/**
 * Global published by plain-HTML embeds, which have no plugin identity.
 * Also the fallback when a widget names a global the page never defined.
 */
const SHARED_CONFIG_GLOBAL = 'VeloraEmbedConfig'

/**
 * Shape of the config globals both plugins publish
 * (VeloraBreederEmbedConfig, VeloraClubEmbedConfig, VeloraEmbedConfig).
 *
 * data-velora-config is page-authored markup, so it can name ANY window
 * property — `location`, `navigator`, a third-party SDK object. Reading one
 * cannot execute anything, but it feeds a foreign object into the config and
 * produces nonsense settings that are hard to trace back to the attribute.
 * Anything off-pattern is ignored and the shared global is used instead.
 */
const CONFIG_GLOBAL_NAME = /^Velora[A-Za-z]*EmbedConfig$/

function readInjectedConfig(globalName: string | undefined): Partial<VeloraConfig> {
  const win = globalThis.window as unknown as Record<string, Partial<VeloraConfig> | undefined> | undefined
  const named = globalName && CONFIG_GLOBAL_NAME.test(globalName) ? win?.[globalName] : undefined
  return named ?? win?.[SHARED_CONFIG_GLOBAL] ?? {}
}

/**
 * @param globalName Name of the window property holding the config for THIS
 *   widget (from data-velora-config). Omitted by plain-HTML embeds.
 */
export function resolveConfig(globalName?: string): VeloraConfig {
  const injected = readInjectedConfig(globalName)

  return {
    apiBase: injected.apiBase ?? readMeta('velora-api-base') ?? DEFAULTS.apiBase,
    profileBase: injected.profileBase ?? readMeta('velora-profile-base') ?? DEFAULTS.profileBase,
    apiKey: injected.apiKey ?? readMeta('velora-api-key') ?? DEFAULTS.apiKey,
    locale: (injected.locale as VeloraConfig['locale']) ?? DEFAULTS.locale,
    theme: (injected.theme as VeloraConfig['theme']) ?? DEFAULTS.theme,
    contactProxyUrl: injected.contactProxyUrl ?? readMeta('velora-contact-proxy-url') ?? DEFAULTS.contactProxyUrl,
    showCredit: injected.showCredit ?? readBoolMeta('velora-show-credit', DEFAULTS.showCredit),
  }
}

export function resolveTheme(theme: VeloraConfig['theme']): 'light' | 'dark' {
  if (theme !== 'auto') return theme
  if (!globalThis.window?.matchMedia) return 'light'
  return globalThis.window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
