import { Global, Module } from '@nestjs/common'
import { RedisTokenService } from './redis-token.service'

@Global()
@Module({
  providers: [RedisTokenService],
  exports: [RedisTokenService],
})
export class RedisTokenModule {}
