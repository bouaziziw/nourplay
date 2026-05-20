import { Module } from '@nestjs/common'
import { ConsentController } from './consent.controller'
import { ConsentService } from './consent.service'
import { PrismaService } from '../../common/prisma/prisma.service'

@Module({
  controllers: [ConsentController],
  providers: [ConsentService, PrismaService],
  exports: [ConsentService],
})
export class ConsentModule {}
