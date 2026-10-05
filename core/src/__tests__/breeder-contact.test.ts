import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BreederContactWidget } from '../widgets/breeder-contact'
import type { VeloraConfig } from '../config'

/**
 * The contact form is the only widget that sends visitor data to Velora, and
 * the consent checkbox next to it is a legal record. Until 2026-08 the submit
 * handler read neither: it wrote `consent: true` into the payload as a literal
 * and never looked at the checkbox, so an unticked box still produced a
 * request — and Velora stored an agreement the visitor never gave.
 *
 * These tests exist to keep the submit gate closed. The network boundary
 * (global fetch) is the only thing mocked: everything between the form and the
 * request body is the real widget code, so "no request was made" here means
 * exactly what it means in a browser.
 */

const captchaState = vi.hoisted(() => ({ token: 'tok-123' as string | null }))

vi.mock('../captcha', () => ({
  renderCaptcha: () => ({
    element: document.createElement('div'),
    getToken: () => captchaState.token,
    reset: () => {
      /* no-op */
    },
  }),
}))

const PROXY_URL = 'https://site.example/wp-json/velora-breeder/v1/contact'

const CONFIG: VeloraConfig = {
  apiBase: 'https://api.test',
  profileBase: 'https://test.pet',
  apiKey: null,
  locale: 'en',
  theme: 'light',
  contactProxyUrl: PROXY_URL,
  showCredit: false,
}

const fetchMock = vi.fn()

/** Lets every pending microtask of the async submit handler settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

async function mountForm(): Promise<HTMLFormElement> {
  const root = document.createElement('div')
  root.setAttribute('data-breeder', 'my-cattery')
  document.body.appendChild(root)
  await new BreederContactWidget(root, CONFIG).mount()
  const form = root.querySelector('form')
  if (!form) throw new Error('contact form did not render')
  return form
}

function field(form: HTMLFormElement, name: string): HTMLInputElement | HTMLTextAreaElement {
  const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)
  if (!el) throw new Error(`field "${name}" not found`)
  return el
}

/** Fills everything a visitor must provide for a legitimate submission. */
function fillValidly(form: HTMLFormElement): void {
  field(form, 'name').value = 'Anna Nowak'
  field(form, 'email').value = 'anna@example.com'
  field(form, 'subject').value = 'Question about a litter'
  field(form, 'message').value = 'Do you expect kittens this spring?'
  ;(field(form, 'consent') as HTMLInputElement).checked = true
}

async function submit(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  await flush()
}

function feedbackText(form: HTMLFormElement, variant: 'success' | 'error'): string {
  return form.querySelector(`.velora-form-feedback-${variant}`)?.textContent ?? ''
}

describe('BreederContactWidget submit gate', () => {
  beforeEach(() => {
    captchaState.token = 'tok-123'
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', fetchMock)
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not send anything when the consent box is left unticked', async () => {
    const form = await mountForm()
    fillValidly(form)
    ;(field(form, 'consent') as HTMLInputElement).checked = false

    await submit(form)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(feedbackText(form, 'error')).toBe(
      'Tick the data-processing consent box to send your message.',
    )
  })

  it('does not send anything when a required field is empty', async () => {
    const form = await mountForm()
    fillValidly(form)
    field(form, 'message').value = ''

    await submit(form)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(feedbackText(form, 'error')).toBe('Please fill in all required fields.')
  })

  it('reports success without sending anything when the honeypot is filled', async () => {
    const form = await mountForm()
    fillValidly(form)
    field(form, 'website').value = 'http://spam.example'

    await submit(form)

    expect(fetchMock).not.toHaveBeenCalled()
    // The bot is told it succeeded, so it does not retry with a smarter payload.
    expect(feedbackText(form, 'success')).toBe('Thank you! Your message has been sent.')
  })

  it('does not send anything while the anti-bot token is still missing', async () => {
    captchaState.token = null
    const form = await mountForm()
    fillValidly(form)

    await submit(form)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(feedbackText(form, 'error')).toBe('Please wait for the anti-bot verification to load.')
  })

  it('sends the visitor-entered values with the real consent value', async () => {
    const form = await mountForm()
    fillValidly(form)
    field(form, 'phone').value = '+48 600 100 200'

    await submit(form)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(PROXY_URL)
    expect(JSON.parse(String(init.body))).toEqual({
      slug: 'my-cattery',
      name: 'Anna Nowak',
      email: 'anna@example.com',
      phone: '+48 600 100 200',
      subject: 'Question about a litter',
      message: 'Do you expect kittens this spring?',
      consent: true,
      captchaToken: 'tok-123',
    })
    expect(feedbackText(form, 'success')).toBe('Thank you! Your message has been sent.')
  })

  it('tells the visitor when Velora rejects the message instead of failing silently', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Inbox unavailable' }),
    })
    const form = await mountForm()
    fillValidly(form)

    await submit(form)

    expect(feedbackText(form, 'error')).toBe(
      'Failed to send message. Please try again. (Inbox unavailable)',
    )
    // The visitor keeps what they typed, so they can retry without retyping.
    expect(field(form, 'message').value).toBe('Do you expect kittens this spring?')
  })

  it('renders an error instead of a form when the shortcode names no breeder', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    await new BreederContactWidget(root, CONFIG).mount()

    expect(root.querySelector('form')).toBeNull()
    expect(root.querySelector('[role="alert"]')).not.toBeNull()
  })
})
