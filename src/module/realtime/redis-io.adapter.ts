import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    let url: string;
    let options: any = {};

    if (upstashToken && upstashUrl) {
      const parsed = new URL(upstashUrl);
      url = `rediss://${parsed.hostname}:6379`;
      options = {
        password: upstashToken,
        socket: {
          tls: true,
          servername: parsed.hostname,
          family: 4,
          rejectUnauthorized: false
        }
      };
    } else {
      url = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    }

    const pubClient = createClient({ 
      url,
      ...options
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
