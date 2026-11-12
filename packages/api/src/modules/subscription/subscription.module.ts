import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { NotificationModule } from '../notification/notification.module'
import { SubscriptionService } from './subscription.service'
import { SubscriptionController } from './subscription.controller'
import { SubscriptionTasksService } from './subscription.tasks'

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionTasksService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
