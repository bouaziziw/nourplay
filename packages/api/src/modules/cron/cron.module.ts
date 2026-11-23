import { Module } from '@nestjs/common'
import { PlaylistModule } from '../playlist/playlist.module'
import { SubscriptionModule } from '../subscription/subscription.module'
import { UserModule } from '../user/user.module'
import { VideoModule } from '../video/video.module'
import { CronController } from './cron.controller'

@Module({
  imports: [PlaylistModule, UserModule, SubscriptionModule, VideoModule],
  controllers: [CronController],
})
export class CronModule {}
