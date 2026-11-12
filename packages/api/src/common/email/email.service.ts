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

  async sendMagicLinkEmail(to: string, token: string, locale = 'fr') {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000')
    const link = `${appUrl}/${locale}/auth/magic-link/verify?token=${token}`

    const subjects: Record<string, string> = {
      fr: 'Votre lien de connexion NourPlay',
      en: 'Your NourPlay sign-in link',
      ar: 'رابط تسجيل الدخول إلى NourPlay',
      es: 'Tu enlace de acceso a NourPlay',
    }

    const texts: Record<string, { title: string; body: string; cta: string; note: string }> = {
      fr: { title: 'Connexion sans mot de passe', body: 'Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable 15 minutes et à usage unique.', cta: 'Se connecter', note: 'Si vous n\'avez pas demandé ce lien, ignorez cet email.' },
      en: { title: 'Passwordless sign-in', body: 'Click the button below to sign in. This link is valid for 15 minutes and can only be used once.', cta: 'Sign in', note: 'If you didn\'t request this, ignore this email.' },
    }
    const t = texts[locale] ?? texts['fr']

    await this.send({
      to,
      subject: subjects[locale] ?? subjects['fr'],
      html: this.layout(t.title, `<p>${t.body}</p><a href="${link}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">${t.cta}</a><p style="color:#9ca3af;font-size:12px;margin-top:24px">${t.note}</p>`),
      text: link,
    })
  }

  async sendSubscriptionExpiryEmail(to: string, daysLeft: number, locale = 'fr') {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000')
    const link = `${appUrl}/${locale}/dashboard/subscription`

    const subjects: Record<string, string> = {
      fr: `Votre abonnement NourPlay expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      en: `Your NourPlay subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
    }

    const bodies: Record<string, { title: string; body: string; cta: string }> = {
      fr: {
        title: `Abonnement Premium — encore ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
        body: `Votre abonnement Premium expire dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>. Pour continuer à profiter de toutes les fonctionnalités (profils illimités, playlists illimitées), renouvelez votre abonnement dès maintenant.`,
        cta: 'Renouveler mon abonnement',
      },
      en: {
        title: `Premium subscription — ${daysLeft} day${daysLeft > 1 ? 's' : ''} left`,
        body: `Your Premium subscription expires in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>. To keep enjoying all features (unlimited profiles, unlimited playlists), renew now.`,
        cta: 'Renew my subscription',
      },
    }

    const t = bodies[locale] ?? bodies['fr']

    await this.send({
      to,
      subject: subjects[locale] ?? subjects['fr'],
      html: this.layout(t.title, `<p>${t.body}</p><a href="${link}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">${t.cta}</a>`),
      text: `${t.body} ${link}`,
    })
  }

  async sendScreenTimeAlertEmail(
    to: string,
    profileName: string,
    limitMin: number,
    watchedMin: number,
    locale = 'fr',
  ) {
    const subjects: Record<string, string> = {
      fr: `Limite de temps atteinte pour ${profileName} — NourPlay`,
      en: `Screen time limit reached for ${profileName} — NourPlay`,
    }
    const bodies: Record<string, { title: string; body: string }> = {
      fr: {
        title: 'Limite de visionnage atteinte',
        body: `Le profil <strong>${profileName}</strong> a atteint sa limite journalière de <strong>${limitMin} minutes</strong> (${watchedMin} min regardées aujourd'hui). Vous pouvez ajuster cette limite depuis les paramètres du profil.`,
      },
      en: {
        title: 'Screen time limit reached',
        body: `The profile <strong>${profileName}</strong> has reached its daily screen time limit of <strong>${limitMin} minutes</strong> (${watchedMin} min watched today). You can adjust this limit in the profile settings.`,
      },
    }
    const t = bodies[locale] ?? bodies['fr']
    await this.send({
      to,
      subject: subjects[locale] ?? subjects['fr'],
      html: this.layout(t.title, `<p>${t.body}</p>`),
      text: `${profileName} : ${watchedMin} min regardées / limite ${limitMin} min`,
    })
  }

  async sendWeeklySummaryEmail(
    to: string,
    locale = 'fr',
    profiles: Array<{
      profileName: string
      totalWatchedSec: number
      videoCount: number
      dailyLimitMin: number | null
      topVideos: Array<{ title: string; thumbnailUrl: string | null; watchCount: number }>
    }>,
    weekLabel: string,
  ) {
    const isFr = locale !== 'en'
    const subject = isFr
      ? `Résumé NourPlay — ${weekLabel}`
      : `NourPlay weekly recap — ${weekLabel}`

    const fmtTime = (sec: number) => {
      const h = Math.floor(sec / 3600)
      const m = Math.floor((sec % 3600) / 60)
      return h > 0 ? (isFr ? `${h}h ${m}m` : `${h}h ${m}m`) : `${m} min`
    }

    const profileBlocks = profiles.map(p => {
      const limitLine = p.dailyLimitMin
        ? `<p style="color:#6b7280;font-size:13px;margin:4px 0 0">${isFr ? `Limite journalière : ${p.dailyLimitMin} min/jour` : `Daily limit: ${p.dailyLimitMin} min/day`}</p>`
        : ''

      const topVideosHtml = p.topVideos.length === 0 ? '' : `
        <p style="font-size:13px;font-weight:600;color:#374151;margin:12px 0 6px">${isFr ? 'Vidéos les plus regardées' : 'Most watched videos'}</p>
        ${p.topVideos.map((v, i) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <span style="color:#9ca3af;font-size:12px;width:14px;flex-shrink:0">${i + 1}</span>
            ${v.thumbnailUrl ? `<img src="${v.thumbnailUrl}" alt="" width="40" height="25" style="border-radius:4px;object-fit:cover;flex-shrink:0">` : `<div style="width:40px;height:25px;background:#e5e7eb;border-radius:4px;flex-shrink:0"></div>`}
            <span style="font-size:13px;color:#111827;flex:1">${v.title}</span>
            <span style="font-size:11px;color:#6b7280;white-space:nowrap">×${v.watchCount}</span>
          </div>`).join('')}
      `

      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px">
          <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 8px">${p.profileName}</p>
          <div style="display:flex;gap:24px;margin-bottom:4px">
            <div>
              <p style="font-size:22px;font-weight:700;color:#4f46e5;margin:0">${fmtTime(p.totalWatchedSec)}</p>
              <p style="font-size:11px;color:#9ca3af;margin:2px 0 0">${isFr ? 'regardées cette semaine' : 'watched this week'}</p>
            </div>
            <div>
              <p style="font-size:22px;font-weight:700;color:#111827;margin:0">${p.videoCount}</p>
              <p style="font-size:11px;color:#9ca3af;margin:2px 0 0">${isFr ? 'vidéos' : 'videos'}</p>
            </div>
          </div>
          ${limitLine}
          ${topVideosHtml}
        </div>`
    }).join('')

    const title = isFr ? `Résumé de la semaine` : `Weekly recap`
    const intro = isFr
      ? `Voici le résumé d'activité de vos enfants pour la semaine du <strong>${weekLabel}</strong>.`
      : `Here is your children's activity recap for the week of <strong>${weekLabel}</strong>.`

    const html = this.layout(title, `<p style="color:#374151">${intro}</p>${profileBlocks}`)
    await this.send({ to, subject, html, text: `${intro} — ${profiles.map(p => `${p.profileName}: ${fmtTime(p.totalWatchedSec)}`).join(', ')}` })
  }

  async sendVideoReviewEmail(to: string, videoTitle: string, action: 'approve' | 'reject', reason?: string, locale = 'fr') {
    const approved = action === 'approve'
    const subjects: Record<string, [string, string]> = {
      fr: ['Votre vidéo a été approuvée — NourPlay', 'Votre vidéo a été refusée — NourPlay'],
      en: ['Your video was approved — NourPlay', 'Your video was rejected — NourPlay'],
    }
    const [subjectApproved, subjectRejected] = subjects[locale] ?? subjects['fr']
    const title = approved ? subjectApproved : subjectRejected
    const bodyFr = approved
      ? `Votre vidéo <strong>${videoTitle}</strong> a été approuvée et est maintenant disponible dans la bibliothèque.`
      : `Votre vidéo <strong>${videoTitle}</strong> n'a pas été acceptée.${reason ? `<br><br><strong>Motif :</strong> ${reason}` : ''}`
    const bodyEn = approved
      ? `Your video <strong>${videoTitle}</strong> has been approved and is now available in the library.`
      : `Your video <strong>${videoTitle}</strong> was not accepted.${reason ? `<br><br><strong>Reason:</strong> ${reason}` : ''}`
    const body = locale === 'en' ? bodyEn : bodyFr
    await this.send({ to, subject: title, html: this.layout(title, `<p>${body}</p>`) })
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
