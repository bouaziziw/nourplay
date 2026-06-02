import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { LegalController } from './legal.controller'

@Module({
  imports: [PrismaModule],
  controllers: [LegalController],
})
export class LegalModule {}
