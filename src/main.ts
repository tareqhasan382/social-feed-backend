import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';
import { ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from './module/auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RedisIoAdapter } from './module/realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  try {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    console.log('✅ Redis WebSocket adapter connected');
  } catch (err) {
    console.warn('⚠️ Redis WebSocket adapter failed, falling back to memory adapter:', err.message);
  }
 
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  app.enableCors({
    origin: '*',
    credentials: true,
  });
 
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  setupSwagger(app);

  await app.listen(process.env.PORT ?? 4000);

  console.log(`🚀 Server running on http://localhost:4000`);
  console.log(`📄 Swagger docs at http://localhost:4000/docs`);
}

bootstrap();