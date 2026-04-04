import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';
import { ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from './module/auth/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
 
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  app.enableCors({
    origin: 'http://localhost:3000',
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

  await app.listen(process.env.PORT ?? 3000);

  console.log(`🚀 Server running on http://localhost:3000`);
  console.log(`📄 Swagger docs at http://localhost:3000/docs`);
}

bootstrap();