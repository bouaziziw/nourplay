import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface AuditEntry {
  actorId?: string
  actorRole?: string
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry) {
    return this.prisma.auditLog.create({ data: entry })
  }
}
