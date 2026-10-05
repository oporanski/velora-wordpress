import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ClubContactWidget } from '../widgets/club-contact'
import type { VeloraConfig } from '../config'

/**
 * Twin of breeder-contact.test.ts — the club form carries the same consent
 * record and the same submit gate, and the two widgets are separate files, so
 * a fix applied to one of them can silently miss the other. See that file for
 * why the gate is tested at the network boundary.
 */

const captchaState = vi.hoisted(() => ({ token: 'tok-987' as string | null }))

vi.mock('../captcha', () => ({
  renderCaptcha: () => ({
    element: document.createElement('div'),
    getToken: () => captchaState.token,
    reset: () => {
      /* no-op */
    },
  }),
}))

const PROXY_URL = 'https://site.example/wp-json/velora-club/v1/contact'

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
  root.setAttribute('data-club', 'kot-klub')
  document.body.appendChild(root)
  await new ClubContactWidget(root, CONFIG).mount()
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
  field(form, 'name').value = 'Jan Kowalski'
  field(form, 'email').value = 'jan@example.com'
  field(form, 'subject').value = 'Membership question'
  field(form, 'message').value = 'How do I join the club?'
  ;(field(form, 'consent') as HTMLInputElement).checked = true
}

async function submit(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  await flush()
}

function feedbackText(form: HTMLFormElement, variant: 'success' | 'error'): string {
  return form.querySelector(`.velora-form-feedback-${variant}`)?.textContent ?? ''
}

describe('ClubContactWidget submit gate', () => {
  beforeEach(() => {
    captchaState.token = 'tok-987'
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
    field(form, 'subject').value = ''

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
      slug: 'kot-klub',
      name: 'Jan Kowalski',
      email: 'jan@example.com',
      phone: '+48 600 100 200',
      subject: 'Membership question',
      message: 'How do I join the club?',
      consent: true,
      captchaToken: 'tok-987',
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
    expect(field(form, 'message').value).toBe('How do I join the club?')
  })

  it('renders an error instead of a form when the shortcode names no club', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    await new ClubContactWidget(root, CONFIG).mount()

    expect(root.querySelector('form')).toBeNull()
    expect(root.querySelector('[role="alert"]')).not.toBeNull()
  })
})
