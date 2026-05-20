import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface SendOptions {
  to: string
  subject: string
  html: string
  text?: string
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly from: string
  private readonly provider: string

  constructor(private readonly config: ConfigService) {
    this.from = config.get<string>('EMAIL_FROM', 'noreply@nourplay.app')
    this.provider = config.get<string>('EMAIL_PROVIDER', 'console')
  }

  async send(options: SendOptions): Promise<void> {
    if (this.provider === 'console' || process.env.NODE_ENV === 'test') {
      this.logger.debug(`[EMAIL] To: ${options.to} | Subject: ${options.subject}`)
      return
    }

    if (this.provider === 'resend') {
      await this.sendViaResend(options)
      return
    }

    throw new Error(`Email provider "${this.provider}" non supporté`)
  }

  async sendVerificationEmail(to: string, token: string, locale = 'fr') {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000')
    const link = `${appUrl}/${locale}/auth/verify-email?token=${token}`

    const subjects: Record<string, string> = {
      fr: 'Vérifiez votre adresse email — NourPlay',
      en: 'Verify your email address — NourPlay',
      ar: 'تحقق من عنوان بريدك الإلكتروني — NourPlay',
      es: 'Verifica tu dirección de correo — NourPlay',
    }

    await this.send({
      to,
      subject: subjects[locale] ?? subjects['fr'],
      html: this.verificationTemplate(link, locale),
      text: link,
    })
  }

  async sendPasswordResetEmail(to: string, token: string, locale = 'fr') {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000')
    const link = `${appUrl}/${locale}/auth/reset-password?token=${token}`

    await this.send({
      to,
      subject: locale === 'fr' ? 'Réinitialiser votre mot de passe — NourPlay' : 'Reset your password — NourPlay',
      html: this.resetTemplate(link, locale),
      text: link,
    })
  }

  private async sendViaResend(options: SendOptions) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY manquant')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: options.to, subject: options.subject, html: options.html }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Resend API error: ${err}`)
    }
  }

  private verificationTemplate(link: string, locale: string): string {
    const texts: Record<string, { title: string; body: string; cta: string }> = {
      fr: { title: 'Vérifiez votre email', body: 'Cliquez sur le bouton ci-dessous pour vérifier votre adresse email.', cta: 'Vérifier mon email' },
      en: { title: 'Verify your email', body: 'Click the button below to verify your email address.', cta: 'Verify my email' },
    }
    const t = texts[locale] ?? texts['fr']
    return this.layout(t.title, `<p>${t.body}</p><a href="${link}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">${t.cta}</a><p style="color:#9ca3af;font-size:12px;margin-top:24px">Lien valide 24h. Si vous n'avez pas créé de compte, ignorez cet email.</p>`)
  }

  private resetTemplate(link: string, locale: string): string {
    const t = locale === 'fr'
      ? { title: 'Réinitialiser votre mot de passe', body: 'Vous avez demandé la réinitialisation de votre mot de passe.', cta: 'Choisir un nouveau mot de passe' }
      : { title: 'Reset your password', body: 'You requested a password reset.', cta: 'Choose a new password' }
    return this.layout(t.title, `<p>${t.body}</p><a href="${link}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">${t.cta}</a><p style="color:#9ca3af;font-size:12px;margin-top:24px">Lien valide 1h. Si vous n'avez pas fait cette demande, ignorez cet email.</p>`)
  }

  private layout(title: string, content: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:40px 16px"><div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb"><img src="https://nourplay.app/logo.png" alt="NourPlay" style="height:32px;margin-bottom:24px"><h1 style="font-size:20px;color:#111827;margin:0 0 16px">${title}</h1>${content}<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0"><p style="color:#9ca3af;font-size:12px;margin:0">NourPlay — Plateforme de curation vidéo sécurisée</p></div></body></html>`
  }
}
