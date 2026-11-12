import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { UserTasksService } from './user.tasks'
import { SubscriptionModule } from '../subscription/subscription.module'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [SubscriptionModule, NotificationModule],
  controllers: [UserController],
  providers: [UserService, UserTasksService],
  exports: [UserService],
})
export class UserModule {}
