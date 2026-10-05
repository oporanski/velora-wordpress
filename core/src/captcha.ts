/**
 * Cap.js captcha helper for embed contact widgets.
 *
 * Why Cap.js over a third-party CAPTCHA (Cloudflare Turnstile, hCaptcha,
 * reCAPTCHA): zero account, zero sitekey, zero third-party network requests
 * from the host site. The widget runs a proof-of-work challenge in the
 * browser and the resulting token is verified server-side against the
 * Velora backend. The plugin works the moment it's installed — no setup
 * step that asks the user to "go create an account on $vendor".
 *
 * "Zero third-party requests" is not a property of Cap.js — it is one we
 * have to keep. By default the widget downloads its WebAssembly solver from
 * cdn.jsdelivr.net. Two things prevent that, and both must stay in place:
 * the binary is emitted into the plugin package (capWasmAsset() in
 * vite.config.ts) and './cap-wasm' redirects the widget to that copy. The
 * import below it must therefore never move above it — see cap-wasm.ts.
 *
 * Implementation notes:
 *  - `@cap.js/widget` is bundled into embed.js (IIFE). Importing it here
 *    side-effect-registers the `<cap-widget>` custom element exactly once.
 *  - Endpoint is configurable via `apiBase` so the widget calls
 *    `${apiBase}/v1/captcha/{challenge,redeem}` (external-api proxy).
 *  - The widget emits a `solve` CustomEvent with `{ token }` in `detail`.
 *    The host form submits only after a token is in hand.
 */

// Side-effect import — must precede '@cap.js/widget'.
import './cap-wasm'
// Side-effect import — registers <cap-widget> on first execution.
import '@cap.js/widget'

export interface CaptchaHandle {
  element: HTMLElement
  /** Most recent solved token, or null if not yet solved / reset. */
  getToken: () => string | null
  /** Force the widget to re-solve a fresh challenge (call after submit). */
  reset: () => void
}

interface CapWidget extends HTMLElement {
  reset?: () => void
}

/**
 * Mount a `<cap-widget>` into `target` and return a handle for reading the
 * token + resetting after submit.
 */
export function renderCaptcha(
  target: HTMLElement,
  opts: {
    apiBase: string
    locale?: 'pl' | 'en'
  },
): CaptchaHandle {
  const widget = document.createElement('cap-widget') as CapWidget
  // Trailing slash is required — cap-widget appends `challenge` and `redeem`.
  widget.dataset.capApiEndpoint = `${opts.apiBase.replace(/\/$/, '')}/v1/captcha/`

  const labels = LABELS[opts.locale ?? 'pl']
  widget.dataset.capI18nInitialState = labels.initial
  widget.dataset.capI18nVerifyingLabel = labels.verifying
  widget.dataset.capI18nSolvedLabel = labels.solved
  widget.dataset.capI18nErrorLabel = labels.error

  let currentToken: string | null = null
  widget.addEventListener('solve', (e) => {
    currentToken = (e as CustomEvent<{ token: string }>).detail.token
  })
  widget.addEventListener('reset', () => {
    currentToken = null
  })
  widget.addEventListener('error', () => {
    currentToken = null
  })

  target.replaceChildren(widget)

  return {
    element: widget,
    getToken: () => currentToken,
    reset: () => {
      currentToken = null
      widget.reset?.()
    },
  }
}

const LABELS = {
  pl: {
    initial: 'Potwierdź, że nie jesteś robotem',
    verifying: 'Weryfikacja…',
    solved: 'Zweryfikowano',
    error: 'Nie udało się zweryfikować — spróbuj ponownie',
  },
  en: {
    initial: "I'm not a robot",
    verifying: 'Verifying…',
    solved: 'Verified',
    error: 'Verification failed — please try again',
  },
} as const
