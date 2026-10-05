import { Widget, getAttr } from './base'
import { VeloraApiError, type ContactPayload } from '../api-client'
import { renderCaptcha, type CaptchaHandle } from '../captcha'

export class ClubContactWidget extends Widget {
  private captcha: CaptchaHandle | null = null

  async mount(): Promise<void> {
    const slug = getAttr(this.ctx.root, 'data-club')
    if (!slug) {
      this.renderError('Missing data-club attribute')
      return
    }

    const form = this.buildForm({ slug })
    this.ctx.root.replaceChildren(form, this.buildFooter())

    const capContainer = form.querySelector<HTMLElement>('.velora-form-captcha')
    if (capContainer) {
      this.captcha = renderCaptcha(capContainer, {
        apiBase: this.ctx.config.apiBase,
        locale: this.ctx.config.locale,
      })
    }
  }

  private buildForm(opts: { slug: string }): HTMLFormElement {
    const t = this.ctx.t
    const form = document.createElement('form')
    form.className = 'velora-form velora-form-club-contact'
    form.noValidate = true

    form.appendChild(this.buildField('name', t('formName'), 'text', { required: true, autocomplete: 'name' }))
    form.appendChild(this.buildField('email', t('formEmail'), 'email', { required: true, autocomplete: 'email' }))
    form.appendChild(this.buildField('phone', t('formPhone'), 'tel', { autocomplete: 'tel' }))
    form.appendChild(this.buildField('subject', t('formSubject'), 'text', { required: true }))
    form.appendChild(this.buildTextarea('message', t('formMessage'), true))

    const honeypot = document.createElement('input')
    honeypot.type = 'text'
    honeypot.name = 'website'
    honeypot.className = 'velora-form-honeypot'
    honeypot.tabIndex = -1
    honeypot.autocomplete = 'off'
    honeypot.setAttribute('aria-hidden', 'true')
    form.appendChild(honeypot)

    form.appendChild(this.buildConsent())

    const captchaWrap = this.createDiv('velora-form-captcha')
    form.appendChild(captchaWrap)

    const submit = this.createEl('button', 'velora-btn', t('formSubmit'))
    submit.type = 'submit'
    form.appendChild(submit)

    const feedback = document.createElement('div')
    feedback.className = 'velora-form-feedback-slot'
    form.appendChild(feedback)

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      await this.handleSubmit(form, opts, submit, feedback)
    })

    return form
  }

  private buildField(
    name: string,
    label: string,
    type: string,
    opts: { required?: boolean; autocomplete?: AutoFill } = {},
  ): HTMLElement {
    const wrapper = this.createDiv('velora-form-field')
    const labelEl = this.createEl('label', opts.required ? 'velora-form-label velora-form-label-required' : 'velora-form-label', label)
    const input = document.createElement('input')
    input.type = type
    input.name = name
    input.id = `velora-${name}-${crypto.randomUUID().split('-')[0]}`
    input.className = 'velora-form-input'
    if (opts.required) input.required = true
    if (opts.autocomplete) input.autocomplete = opts.autocomplete
    labelEl.htmlFor = input.id
    wrapper.appendChild(labelEl)
    wrapper.appendChild(input)
    return wrapper
  }

  private buildTextarea(name: string, label: string, required: boolean): HTMLElement {
    const wrapper = this.createDiv('velora-form-field')
    const labelEl = this.createEl('label', required ? 'velora-form-label velora-form-label-required' : 'velora-form-label', label)
    const textarea = document.createElement('textarea')
    textarea.name = name
    textarea.id = `velora-${name}-${crypto.randomUUID().split('-')[0]}`
    textarea.className = 'velora-form-textarea'
    textarea.required = required
    labelEl.htmlFor = textarea.id
    wrapper.appendChild(labelEl)
    wrapper.appendChild(textarea)
    return wrapper
  }

  private buildConsent(): HTMLElement {
    const wrapper = this.createDiv('velora-form-consent')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.name = 'consent'
    input.id = `velora-consent-${crypto.randomUUID().split('-')[0]}`
    input.required = true
    const label = this.createEl('label', undefined, this.ctx.t('formConsent'))
    label.htmlFor = input.id
    wrapper.appendChild(input)
    wrapper.appendChild(label)
    return wrapper
  }

  private async handleSubmit(
    form: HTMLFormElement,
    opts: { slug: string },
    submit: HTMLButtonElement,
    feedback: HTMLElement,
  ): Promise<void> {
    feedback.replaceChildren()
    const fd = new FormData(form)

    // Honeypot triggered — silently succeed (don't tell the bot it failed).
    if (fd.get('website')) {
      this.showFeedback(feedback, 'success', this.ctx.t('formSuccess'))
      form.reset()
      return
    }

    // Consent gates the submit before anything else is looked at, because this
    // is the only place it is enforced at all: the WordPress proxy rebuilds the
    // payload from a fixed field list (see handle_contact in class-base-rest.php)
    // and drops `consent`, so Velora never receives it and cannot re-check it.
    // The value below therefore documents the visitor's answer for the plain-HTML
    // embed path; the actual guarantee is this early return.
    const consent = fd.get('consent') !== null
    if (!consent) {
      this.showFeedback(feedback, 'error', this.ctx.t('formConsentRequired'))
      return
    }

    // noValidate stays on so the browser cannot cancel the submit event
    // before the honeypot branch above has run — a bot-filled form must still
    // reach the silent-success path. Constraint validation is therefore
    // invoked explicitly here, which also pops the native "please fill in
    // this field" hint on the offending input.
    if (!form.reportValidity()) {
      this.showFeedback(feedback, 'error', this.ctx.t('formRequired'))
      return
    }

    const captchaToken = this.captcha?.getToken() ?? null
    if (!captchaToken) {
      this.showFeedback(feedback, 'error', this.ctx.t('formCaptchaPending'))
      return
    }

    const payload: ContactPayload = {
      name: (fd.get('name') as string).trim(),
      email: (fd.get('email') as string).trim(),
      phone: (fd.get('phone') as string).trim() || undefined,
      subject: (fd.get('subject') as string).trim(),
      message: (fd.get('message') as string).trim(),
      consent,
      captchaToken,
    }

    submit.disabled = true
    const originalLabel = submit.textContent
    submit.textContent = this.ctx.t('formSubmitting')

    try {
      await this.ctx.api.postClubContact(opts.slug, payload)
      this.showFeedback(feedback, 'success', this.ctx.t('formSuccess'))
      form.reset()
      this.captcha?.reset()
    } catch (e) {
      const detail = e instanceof VeloraApiError ? e.info.message : 'Unknown error'
      this.showFeedback(feedback, 'error', `${this.ctx.t('formError')} (${detail})`)
      this.captcha?.reset()
    } finally {
      submit.disabled = false
      submit.textContent = originalLabel
    }
  }

  private showFeedback(container: HTMLElement, variant: 'success' | 'error', message: string): void {
    const box = this.createDiv(`velora-form-feedback velora-form-feedback-${variant}`)
    box.textContent = message
    container.replaceChildren(box)
  }
}
