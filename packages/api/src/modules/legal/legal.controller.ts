import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { PrismaService } from '../../common/prisma/prisma.service'
import { ConsentType } from '@nourplay/db'

const VALID_TYPES = new Set(Object.values(ConsentType))

@ApiTags('Legal')
@Controller({ path: 'legal', version: '1' })
export class LegalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':type/current')
  @Public()
  @ApiOperation({ summary: 'Version publiée actuelle d\'un document légal (public, sans auth)' })
  async getCurrent(@Param('type') type: string) {
    if (!VALID_TYPES.has(type as ConsentType)) {
      throw new NotFoundException(`Type de document inconnu : ${type}`)
    }

    const doc = await this.prisma.legalDocument.findFirst({
      where: { type: type as ConsentType, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, type: true, version: true, content: true, publishedAt: true },
    })

    if (!doc) throw new NotFoundException('Aucun document légal publié pour ce type')
    return doc
  }
}
