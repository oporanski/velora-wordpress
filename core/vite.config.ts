import { defineConfig, type Plugin } from 'vite'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Filename of the Cap.js proof-of-work solver compiled to WebAssembly.
 * Emitted next to embed.js so `src/cap-wasm.ts` can point the widget at it
 * with a URL derived from the bundle's own location.
 */
const CAP_WASM_FILE = 'cap_wasm_bg.wasm'

const requireFromCore = createRequire(resolve(__dirname, 'package.json'))

/**
 * The version of @cap.js/wasm that the installed @cap.js/widget was built
 * against. It is baked into the widget's default CDN URL, which is the only
 * place the pairing is written down.
 */
function widgetExpectedWasmVersion(): string {
  const widgetSource = readFileSync(requireFromCore.resolve('@cap.js/widget'), 'utf8')
  const match = widgetSource.match(/@cap\.js\/wasm@(\d+\.\d+\.\d+)/)
  if (!match) {
    throw new Error(
      '[velora-embed] cannot determine which @cap.js/wasm version @cap.js/widget expects: ' +
        'its source no longer contains a "@cap.js/wasm@<version>" reference. ' +
        'Check how the widget loads its WebAssembly module before upgrading.',
    )
  }
  return match[1]
}

/** The widget's built-in fallback: an absolute URL on a CDN we do not control. */
const CAP_CDN_WASM_URL = /https:\/\/cdn\.jsdelivr\.net\/npm\/@cap\.js\/wasm@[\d.]+\/browser\/cap_wasm_bg\.wasm/g

/**
 * Ships the Cap.js WebAssembly solver inside the plugin package.
 *
 * Without it the widget fetches the binary from cdn.jsdelivr.net at runtime,
 * which WordPress.org guideline #8 forbids ("Plugins cannot ... use
 * third-party CDNs for non-font assets"): a visitor's browser would download
 * executable code from a host we do not control.
 *
 * Three things happen here, and all three are load-bearing:
 *  - the binary is emitted next to embed.js, so it ships in the package;
 *  - the widget's hard-coded CDN fallback is rewritten to the bundled
 *    filename. src/cap-wasm.ts already makes that fallback unreachable, but a
 *    reviewer greps the shipped file rather than reasoning about evaluation
 *    order — and a jsdelivr URL in it reads as a violation either way;
 *  - the installed binary is checked against the version the widget expects.
 *    Bumping @cap.js/widget can change which binary its glue code needs, and
 *    a silent mismatch would break solving on every site running the plugin.
 */
function capWasmAsset(): Plugin {
  let cdnUrlsRewritten = 0

  return {
    name: 'velora-cap-wasm-asset',
    buildStart() {
      cdnUrlsRewritten = 0
      const expected = widgetExpectedWasmVersion()
      const installed = requireFromCore('@cap.js/wasm/package.json').version as string
      if (installed !== expected) {
        throw new Error(
          `[velora-embed] @cap.js/wasm version mismatch: @cap.js/widget expects ${expected}, ` +
            `but ${installed} is installed. Update the "@cap.js/wasm" dependency in ` +
            'core/package.json to the expected version and re-verify that ' +
            'the captcha still solves.',
        )
      }

      this.emitFile({
        type: 'asset',
        fileName: CAP_WASM_FILE,
        source: readFileSync(requireFromCore.resolve(`@cap.js/wasm/browser/${CAP_WASM_FILE}`)),
      })
    },

    transform(code, id) {
      if (!id.includes('@cap.js/widget')) return null
      let rewrittenHere = 0
      const rewritten = code.replace(CAP_CDN_WASM_URL, () => {
        rewrittenHere++
        return CAP_WASM_FILE
      })
      cdnUrlsRewritten += rewrittenHere
      return rewrittenHere > 0 ? { code: rewritten, map: null } : null
    },

    buildEnd(error) {
      if (error || cdnUrlsRewritten > 0) return
      throw new Error(
        '[velora-embed] the @cap.js/widget CDN fallback URL was not found, so nothing was ' +
          'rewritten. The widget probably builds that URL differently now — re-check how it ' +
          'loads its WebAssembly module and update CAP_CDN_WASM_URL before shipping.',
      )
    },
  }
}

export default defineConfig({
  plugins: [capWasmAsset()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VeloraEmbed',
      formats: ['iife'],
      fileName: () => 'embed.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'embed.css'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    cssCodeSplit: false,
    // Deliberately unminified. This bundle ships inside the WordPress.org
    // plugin packages, and directory guideline #4 requires plugin code to be
    // human readable. Minifying would force us to also publish the sources
    // and build tooling somewhere public just to stay compliant.
    // The real cost is small: over the wire the bundle grows from ~24 kB to
    // ~30 kB gzipped, because gzip already collapses most of what esbuild's
    // renaming would have saved.
    minify: false,
    sourcemap: true,
  },
})
