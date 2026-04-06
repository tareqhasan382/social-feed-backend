import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BullModule } from '@nestjs/bullmq';
import { CommentCountsProcessor } from './comments.processor';

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    BullModule.registerQueue({
      name: 'comment-counts',
    }),
  ],
  controllers: [CommentsController],
  providers: [CommentsService, CommentCountsProcessor],
  exports: [CommentsService],
})
export class CommentsModule {}
