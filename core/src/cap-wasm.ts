/**
 * Points the Cap.js widget at the WebAssembly solver bundled with this plugin.
 *
 * Left to itself the widget fetches that binary from cdn.jsdelivr.net the
 * moment its module body runs. WordPress.org guideline #8 forbids exactly
 * that ("Plugins cannot ... use third-party CDNs for non-font assets"): every
 * visitor of every page carrying a contact form would download executable
 * code from a host neither we nor the site owner control.
 *
 * IMPORT THIS BEFORE '@cap.js/widget'. The widget reads
 * window.CAP_CUSTOM_WASM_URL once, while it is being evaluated, and starts
 * fetching immediately. Setting the global afterwards is too late — and so is
 * loading the widget through a dynamic import: in an IIFE bundle Rollup
 * inlines dynamic imports and still evaluates the module eagerly, which was
 * verified against a built bundle rather than assumed.
 *
 * If the fetch fails anyway (see the URL note below), Cap.js falls back to a
 * pure-JavaScript solver — slower, but never a third-party request.
 */

/** Emitted next to embed.js by the capWasmAsset() plugin in vite.config.ts. */
const CAP_WASM_FILE = 'cap_wasm_bg.wasm'

declare global {
  interface Window {
    CAP_CUSTOM_WASM_URL?: string
  }
}

/**
 * Resolves the binary against the URL of the script currently executing,
 * because the build and the packaging step always place the two files in the
 * same directory — the breeder plugin's copy resolves inside the breeder
 * plugin, the club plugin's inside the club plugin, and a plain-HTML embed
 * next to wherever it dropped embed.js. No configuration to keep in sync.
 *
 * `documentBase` covers the case where the script URL is unknown (an inline
 * or concatenated bundle, e.g. after a caching plugin aggregates scripts).
 * The result is then almost certainly a 404, which costs solving speed — but
 * it stays same-origin, which is the property that must never break.
 */
export function capWasmUrl(scriptSrc: string | null, documentBase: string): string {
  return new URL(CAP_WASM_FILE, scriptSrc ?? documentBase).href
}

function currentScriptSrc(): string | null {
  const script = globalThis.document?.currentScript
  return script instanceof HTMLScriptElement && script.src ? script.src : null
}

globalThis.window.CAP_CUSTOM_WASM_URL = capWasmUrl(currentScriptSrc(), document.baseURI)
