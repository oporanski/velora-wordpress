/**
 * Settings-page "Test connection" handler — shared by both Velora plugins.
 *
 * Reads the values currently in the form (so it tests *unsaved* edits, the
 * common case where someone just pasted a key and wants to know it works
 * before clicking "Save changes") and posts them to this plugin's own REST
 * route, `{namespace}/test-connection`.
 *
 * The check runs on the server on purpose. Validating an API key means sending
 * it to the Velora API, and the key must never be handed to the browser — so
 * the browser hands its form values to WordPress instead, and WordPress makes
 * the outbound request. The route is restricted to administrators and requires
 * the wp_rest nonce sent below.
 *
 * The server answers with a fixed result code (it never echoes the key back);
 * this file turns that code into one of the translated sentences PHP passed in
 * through VeloraAdminTestConfig.i18n. Errors are reported in plain language,
 * never raw HTTP. The user just pasted a key — they want a yes/no, not a stack
 * trace.
 */
(function () {
  // Wired by PHP: window.VeloraAdminTestConfig = { fieldIds, i18n, restUrl, nonce }
  const cfg = window.VeloraAdminTestConfig
  if (!cfg) return

  function $(id) { return document.getElementById(id) }
  function val(id) { const el = $(id); return el ? el.value.trim() : '' }
  function fmt(template, value) { return String(template).replace('%s', value) }

  const button = $('velora-test-connection')
  const result = $('velora-test-connection-result')
  if (!button || !result) return

  function show(state, message) {
    result.className = 'velora-test-result velora-test-result-' + state
    result.textContent = message
    result.style.display = 'block'
  }

  // Maps a result code from the REST route to the sentence the user reads.
  // `name` is the entity name the Velora API returned; `slug` is what the user
  // typed, so a "not found" message quotes their own spelling back at them.
  function messageFor(payload, slug) {
    switch (payload.code) {
      case 'ok':                  return fmt(cfg.i18n.success, payload.name)
      case 'ok_no_key':           return fmt(cfg.i18n.connectedNoKey, payload.name)
      case 'slug_not_found':      return fmt(cfg.i18n.slugNotFound, slug)
      case 'invalid_api_key':     return cfg.i18n.invalidApiKey
      case 'key_org_mismatch':    return fmt(cfg.i18n.keyOrgMismatch, slug)
      case 'invalid_api_base':    return cfg.i18n.invalidApiBase
      case 'unexpected_response': return cfg.i18n.unexpectedResponse
      default:                    return cfg.i18n.apiUnreachable
    }
  }

  async function test() {
    const apiBase = val(cfg.fieldIds.apiBase).replace(/\/$/, '')
    const slug    = val(cfg.fieldIds.slug)
    const apiKey  = val(cfg.fieldIds.apiKey)

    if (!apiBase) { show('error', cfg.i18n.missingApiBase); return }
    if (!slug)    { show('error', cfg.i18n.missingSlug);    return }

    button.disabled = true
    show('pending', cfg.i18n.testing)

    try {
      const res = await fetch(cfg.restUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
        body: JSON.stringify({ apiBase: apiBase, slug: slug, apiKey: apiKey }),
      })
      if (!res.ok) {
        show('error', cfg.i18n.networkError + ' (HTTP ' + res.status + ')')
        return
      }
      const payload = await res.json()
      show(payload.state || 'error', messageFor(payload, slug))
    } catch (e) {
      show('error', cfg.i18n.networkError + ' — ' + (e && e.message ? e.message : 'network'))
    } finally {
      button.disabled = false
    }
  }

  button.addEventListener('click', function (e) {
    e.preventDefault()
    test()
  })
})()
