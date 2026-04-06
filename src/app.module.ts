import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './module/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from './module/email/email.module';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './module/users/users.module';
import { RolesGuard } from './module/auth/guards/roles.guard'; 
import { JwtAuthGuard } from './module/auth/guards/jwt-auth.guard';
import { RedisModule } from './module/redis/redis.module';
import { PostsModule } from './module/posts/posts.module';
import { CommentsModule } from './module/comments/comments.module';
import { LikesModule } from './module/likes/likes.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { UploadModule } from './module/upload/upload.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: Number(process.env.JWT_EXPIRES_IN),
      },
    }),
    AuthModule,
    RedisModule,
    PrismaModule,
    EmailModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    LikesModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule { }
