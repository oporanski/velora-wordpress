import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The captcha widget must never fetch its WebAssembly solver from a CDN:
 * WordPress.org guideline #8 forbids a plugin from pulling executable code
 * off a third-party host onto the site owner's public pages.
 *
 * Two properties keep that true, and both are asserted here because both are
 * easy to break by accident:
 *  1. the URL handed to the widget resolves to our own origin;
 *  2. it is in place BEFORE '@cap.js/widget' is evaluated. The widget reads
 *     window.CAP_CUSTOM_WASM_URL while its module body runs and falls back to
 *     the CDN if it is unset, so swapping the two imports in captcha.ts would
 *     silently reintroduce the violation.
 */

const observed = vi.hoisted(() => ({ wasmUrlAtWidgetEval: undefined as string | undefined }))

vi.mock('@cap.js/widget', () => {
  observed.wasmUrlAtWidgetEval = window.CAP_CUSTOM_WASM_URL
  return {}
})

const WASM_FILE = 'cap_wasm_bg.wasm'

describe('capWasmUrl', () => {
  it('resolves the binary next to the script that is running', async () => {
    const { capWasmUrl } = await import('../cap-wasm')

    expect(
      capWasmUrl(
        'https://site.example/wp-content/plugins/velora-breeder-widgets/assets/embed.js',
        'https://site.example/kontakt/',
      ),
    ).toBe(`https://site.example/wp-content/plugins/velora-breeder-widgets/assets/${WASM_FILE}`)
  })

  it('keeps each plugin on its own copy when two Velora plugins run on one page', async () => {
    const { capWasmUrl } = await import('../cap-wasm')
    const page = 'https://site.example/kontakt/'

    expect(capWasmUrl('https://site.example/wp-content/plugins/velora-club-widgets/assets/embed.js', page)).toBe(
      `https://site.example/wp-content/plugins/velora-club-widgets/assets/${WASM_FILE}`,
    )
  })

  it('falls back to a same-origin URL when the script URL is unknown', async () => {
    const { capWasmUrl } = await import('../cap-wasm')

    // An inline or concatenated bundle has no src. The binary is then very
    // likely a 404 and Cap.js drops to its JavaScript solver — acceptable.
    // Leaving the origin is not.
    expect(capWasmUrl(null, 'https://site.example/kontakt/')).toBe(`https://site.example/kontakt/${WASM_FILE}`)
  })
})

describe('captcha module', () => {
  beforeEach(() => {
    observed.wasmUrlAtWidgetEval = undefined
    delete window.CAP_CUSTOM_WASM_URL
    vi.resetModules()
  })

  it('points the widget at the bundled binary before the widget loads', async () => {
    await import('../captcha')

    expect(observed.wasmUrlAtWidgetEval).toBeDefined()
    expect(new URL(observed.wasmUrlAtWidgetEval as string).pathname.endsWith(`/${WASM_FILE}`)).toBe(true)
    expect(new URL(observed.wasmUrlAtWidgetEval as string).origin).toBe(window.location.origin)
  })
})

describe('renderCaptcha', () => {
  async function mount(opts: { apiBase: string; locale?: 'pl' | 'en' }) {
    const { renderCaptcha } = await import('../captcha')
    const target = document.createElement('div')
    document.body.replaceChildren(target)
    const handle = renderCaptcha(target, opts)
    return { handle, widget: handle.element }
  }

  it('appends the challenge path to the API base, with exactly one slash', async () => {
    const { widget } = await mount({ apiBase: 'https://velora.pet/' })

    // Cap.js concatenates "challenge"/"redeem" onto this value, so the
    // trailing slash is part of the contract, not cosmetic.
    expect(widget.dataset.capApiEndpoint).toBe('https://velora.pet/v1/captcha/')
  })

  it('labels the widget in the requested language, defaulting to Polish', async () => {
    const { widget: polish } = await mount({ apiBase: 'https://velora.pet' })
    const { widget: english } = await mount({ apiBase: 'https://velora.pet', locale: 'en' })

    expect(polish.dataset.capI18nInitialState).toBe('Potwierdź, że nie jesteś robotem')
    expect(english.dataset.capI18nInitialState).toBe("I'm not a robot")
  })

  it('holds the solved token until the widget resets or errors', async () => {
    const { handle, widget } = await mount({ apiBase: 'https://velora.pet' })
    expect(handle.getToken()).toBeNull()

    widget.dispatchEvent(new CustomEvent('solve', { detail: { token: 'tok-1' } }))
    expect(handle.getToken()).toBe('tok-1')

    widget.dispatchEvent(new CustomEvent('error', { detail: {} }))
    expect(handle.getToken()).toBeNull()
  })

  it('drops the token and re-challenges the widget on reset', async () => {
    const { handle, widget } = await mount({ apiBase: 'https://velora.pet' })
    const widgetReset = vi.fn()
    Object.assign(widget, { reset: widgetReset })

    widget.dispatchEvent(new CustomEvent('solve', { detail: { token: 'tok-1' } }))
    handle.reset()

    // A second submit must not be able to reuse the first token.
    expect(handle.getToken()).toBeNull()
    expect(widgetReset).toHaveBeenCalledTimes(1)
  })
})
