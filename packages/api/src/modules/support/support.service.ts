import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EmailService } from '../../common/email/email.service'
import { AuditService } from '../../common/audit/audit.service'
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto'
import { Prisma } from '@nourplay/db'

export const SUPPORT_CATEGORIES = [
  { value: 'QUESTION_GENERAL', label: 'Question générale', icon: '❓' },
  { value: 'TECHNICAL_ISSUE', label: 'Problème technique / Bug', icon: '🛠️' },
  { value: 'CONTENT_SUGGESTION', label: 'Suggestion de vidéo ou chaîne', icon: '🎬' },
  { value: 'PARENTAL_CONTROL', label: 'Contrôle parental & Minuteur', icon: '⏱️' },
  { value: 'BILLING_SUBSCRIPTION', label: 'Abonnement & Facturation', icon: '💳' },
  { value: 'SAFETY_CONCERN', label: 'Signalement de sécurité / Contenu', icon: '🛡️' },
  { value: 'OTHER', label: 'Autre demande', icon: '📝' },
]

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  getCategories() {
    return SUPPORT_CATEGORIES
  }

  async submitContact(userId: string, dto: CreateSupportTicketDto) {
    const parent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, locale: true },
    })

    if (!parent) {
      throw new NotFoundException('Utilisateur introuvable')
    }

    let childProfileName: string | undefined
    if (dto.childProfileId) {
      const profile = await this.prisma.childProfile.findFirst({
        where: { id: dto.childProfileId, userId, deletedAt: null },
        select: { displayName: true },
      })
      childProfileName = profile?.displayName
    }

    // 1. Récupérer les adresses email de tous les administrateurs
    const adminUsers = await this.prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null },
      select: { id: true, email: true },
    })

    const adminEmailSet = new Set<string>()
    for (const admin of adminUsers) {
      if (admin.email && admin.email.includes('@')) {
        adminEmailSet.add(admin.email.trim())
      }
    }

    const envAdminEmail = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL
    if (envAdminEmail) {
      for (const e of envAdminEmail.split(',')) {
        const trimmed = e.trim()
        if (trimmed && trimmed.includes('@')) adminEmailSet.add(trimmed)
      }
    }

    // Fallback de sécurité si aucun admin configuré
    if (adminEmailSet.size === 0) {
      adminEmailSet.add('support@nour-play.app')
      adminEmailSet.add('admin@nourplay.com')
    }

    const adminEmails = Array.from(adminEmailSet)

    // 2. Envoi du message par email aux administrateurs
    void this.email
      .sendSupportMessageToAdmins(adminEmails, {
        parentEmail: parent.email,
        category: dto.category,
        subject: dto.subject,
        message: dto.message,
        childProfileName,
      })
      .catch(err => {
        this.logger.error(`Échec envoi email support aux admins: ${err instanceof Error ? err.stack : err}`)
      })

    // 3. Envoi d'un accusé de réception / confirmation par email au parent
    void this.email
      .sendSupportConfirmationToParent(parent.email, {
        category: dto.category,
        subject: dto.subject,
        message: dto.message,
        locale: parent.locale,
      })
      .catch(err => {
        this.logger.error(`Échec envoi confirmation support au parent: ${err instanceof Error ? err.stack : err}`)
      })

    // 4. Création d'une notification in-app pour chaque administrateur
    if (adminUsers.length > 0) {
      void this.prisma.notification
        .createMany({
          data: adminUsers.map(admin => ({
            userId: admin.id,
            type: 'SUPPORT_MESSAGE',
            payload: {
              parentEmail: parent.email,
              category: dto.category,
              subject: dto.subject,
              message: dto.message,
              childProfileName,
              createdAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          })),
        })
        .catch(err => {
          this.logger.error(`Échec création notification support admin: ${err instanceof Error ? err.stack : err}`)
        })
    }

    // 5. Enregistrement dans les logs d'audit
    void this.audit
      .log({
        actorId: parent.id,
        actorRole: parent.role,
        action: 'support.contact_submitted',
        resourceType: 'SupportTicket',
        metadata: {
          category: dto.category,
          subject: dto.subject,
          childProfileName,
          adminNotifiedCount: adminEmails.length,
        },
      })
      .catch(err => {
        this.logger.error(`Échec log audit support: ${err instanceof Error ? err.stack : err}`)
      })

    this.logger.log(`Demande de support reçue de ${parent.email} (« ${dto.subject} ») → ${adminEmails.length} admin(s) notifiés`)

    return {
      success: true,
      message: 'Votre message a bien été envoyé à l’équipe d’administration. Un email de confirmation vous a été adressé.',
      recipientsCount: adminEmails.length,
    }
  }
}
