import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@nourplay/db'
import * as argon2 from 'argon2'

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

  public async ensureAdminRoles() {
    try {
      const adminEmails = ['bouaziziw@gmail.com']
      for (const email of adminEmails) {
        const user = await this.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        })
        if (user) {
          if (user.role !== 'ADMIN') {
            await this.user.update({
              where: { id: user.id },
              data: { role: 'ADMIN', emailVerified: true },
            })
            this.logger.log(`Promoted user ${email} to ADMIN`)
          }
        } else {
          const passwordHash = await argon2.hash('Admin1234!', {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 1,
          })
          await this.user.create({
            data: {
              email,
              passwordHash,
              role: 'ADMIN',
              locale: 'fr',
              emailVerified: true,
            },
          })
          this.logger.log(`Created admin user ${email}`)
        }
      }

      const moderatorEmails = ['welidbouazizi@gmail.com']
      for (const email of moderatorEmails) {
        const user = await this.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        })
        if (user) {
          if (user.role !== 'MODERATOR') {
            await this.user.update({
              where: { id: user.id },
              data: { role: 'MODERATOR', emailVerified: true },
            })
            this.logger.log(`Promoted user ${email} to MODERATOR`)
          }
        } else {
          const passwordHash = await argon2.hash('Moderator1234!', {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 1,
          })
          await this.user.create({
            data: {
              email,
              passwordHash,
              role: 'MODERATOR',
              locale: 'fr',
              emailVerified: true,
            },
          })
          this.logger.log(`Created moderator user ${email}`)
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
