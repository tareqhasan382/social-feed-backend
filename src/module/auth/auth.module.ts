import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { PassportModule } from '@nestjs/passport';          
import { JwtStrategy } from './strategy/jwt.strategy';   
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EmailModule,
    PassportModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '2h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,   
  ],
  exports: [AuthService],
})
export class AuthModule {}
