import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('UPSTASH_REDIS_REST_URL');
        const token = config.get<string>('UPSTASH_REDIS_REST_TOKEN');

        if (!url || !token) {
          throw new Error('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing');
        }

        return new Redis({
          url,
          token,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
