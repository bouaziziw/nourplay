import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@nourplay/db'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    })
  }

  async onModuleInit() {
    await this.$connect()
    this.logger.log('Database connected')
    await this.ensureAdminRoles()
  }

  private async ensureAdminRoles() {
    try {
      const adminEmails = ['bouaziziw@gmail.com']
      for (const email of adminEmails) {
        const user = await this.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        })
        if (user && user.role !== 'ADMIN') {
          await this.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN', emailVerified: true },
          })
          this.logger.log(`Promoted user ${email} to ADMIN`)
        }
      }

      const moderatorEmails = ['welidbouazizi@gmail.com']
      for (const email of moderatorEmails) {
        const user = await this.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        })
        if (user && user.role !== 'MODERATOR' && user.role !== 'ADMIN') {
          await this.user.update({
            where: { id: user.id },
            data: { role: 'MODERATOR', emailVerified: true },
          })
          this.logger.log(`Promoted user ${email} to MODERATOR`)
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to ensure admin/moderator roles: ${err instanceof Error ? err.message : err}`)
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.log('Database disconnected')
  }
}
