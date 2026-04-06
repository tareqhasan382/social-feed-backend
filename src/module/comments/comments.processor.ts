import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Processor('comment-counts')
export class CommentCountsProcessor extends WorkerHost {
  private readonly logger = new Logger(CommentCountsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { postId } = job.data;

    try {
      // Fetch fresh counts from DB (Source of Truth for long-term consistency)
      const postState = await this.prisma.post.findUnique({
        where: { id: postId },
        select: {
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: {
              user: {
                select: {
                  id: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      if (postState) {
        const dbLikes = postState._count.likes;
        const dbComments = postState._count.comments;

        // --- EVENTUAL CONSISTENCY: Sync DB counts to Redis ---
        const statsKey = `post:${postId}:stats`;
        await this.redis.hset(statsKey, 'likes', dbLikes, 'comments', dbComments);

        const payload = {
          postId,
          likesCount: dbLikes,
          commentsCount: dbComments,
          likedBy: postState.likes.map((l) => ({
            id: l.user.id,
            avatarUrl: l.user.avatarUrl,
          })),
          comment: job.data.comment,
          commentId: job.data.commentId,
        };

        const event = job.data.event || 'commentAdded';
        this.logger.log(`[BullMQ] Finalizing sync for post ${postId}. Likes: ${dbLikes}, Comments: ${dbComments}`);
        
        // Final broadcast to ensure all clients have the correct count from DB
        this.realtimeGateway.emitPostUpdate(
          postId,
          event as any,
          payload
        );
      }
    } catch (error) {
      this.logger.error(`Failed to process consistency check for post ${postId}: ${error.message}`);
      throw error;
    }
  }
}
