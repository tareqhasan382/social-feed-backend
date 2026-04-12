import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToggleLikeDto } from './dto/like.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Redis } from '@upstash/redis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class LikesService {
  constructor(
    private prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectQueue('comment-counts') private readonly commentCountsQueue: Queue,
  ) {}

  
   // Toggles like/unlike for posts or comments using transactions to prevent race conditions.
  
  private async getStatsFromRedis(postId: string) {
    const statsKey = `post:${postId}:stats`;
    let stats = await this.redis.hgetall(statsKey);

    if (!stats || Object.keys(stats).length === 0) {
      // Lazy initialization from DB
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: {
          _count: {
            select: { likes: true, comments: true }
          }
        }
      });

      if (post) {
        await this.redis.hset(statsKey, {
          likes: post._count.likes,
          comments: post._count.comments,
        });
        stats = {
          likes: post._count.likes.toString(),
          comments: post._count.comments.toString(),
        };
      }
    }
    return stats;
  }

  async toggleLike(userId: string, dto: ToggleLikeDto) {
    const { postId, commentId } = dto;

    if (!postId && !commentId) {
      throw new BadRequestException('Provide either postId or commentId');
    }

    if (postId && commentId) {
      throw new BadRequestException('Provide only one: postId or commentId');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (postId) {
        return this.handlePostLike(tx, userId, postId);
      } else {
        return this.handleCommentLike(tx, userId, commentId!);
      }
    });

    // --- REAL-TIME HYBRID SYNC (REDIS + WEBSOCKET) ---
    if (postId) {
      const statsKey = `post:${postId}:stats`;
      
      // Ensure stats are initialized in Redis before incrementing
      await this.getStatsFromRedis(postId);
      
      // Atomic Increment/Decrement in Redis
      const newCount = await this.redis.hincrby(statsKey, 'likes', result.liked ? 1 : -1);
      
      // Fetch latest 3 avatars for real-time update
      const latestLikes = await this.prisma.like.findMany({
        where: { postId },
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: {
          user: {
            select: { id: true, avatarUrl: true }
          }
        }
      });

      // Get current comments count from Redis (default to 0 if not set)
      const commentsCount = await this.redis.hget(statsKey, 'comments');

      // Immediate WebSocket broadcast with the result of the atomic operation
      this.realtimeGateway.emitPostUpdate(postId, result.liked ? 'postLiked' : 'postUnliked', {
        likesCount: Number(newCount),
        commentsCount: Number(commentsCount || 0),
        likedBy: latestLikes.map(l => ({ id: l.user.id, avatarUrl: l.user.avatarUrl })),
      });

      // BullMQ for background verification/eventual consistency check
      await this.commentCountsQueue.add('sync-counts', {
        postId,
        event: result.liked ? 'postLiked' : 'postUnliked',
      }, {
        removeOnComplete: true,
        delay: 5000 // Verification check delayed slightly
      });
    }

    return result;
  }

  private async handlePostLike(tx: any, userId: string, postId: string) {
    const post = await tx.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existingLike = await tx.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existingLike) {
      await tx.like.delete({ where: { id: existingLike.id } });
      this.invalidateFeedCache(); // Async invalidation
      return { liked: false };
    } else {
      await tx.like.create({ data: { userId, postId } });
      this.invalidateFeedCache(); // Async invalidation
      return { liked: true };
    }
  }

  private async handleCommentLike(tx: any, userId: string, commentId: string) {
    const comment = await tx.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    const existingLike = await tx.like.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existingLike) {
      await tx.like.delete({ where: { id: existingLike.id } });
      return { liked: false };
    } else {
      await tx.like.create({ data: { userId, commentId } });
      return { liked: true };
    }
  }

  async getPostLikes(postId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const likes = await this.prisma.like.findMany({
      where: { postId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    
    return likes.map(like => like.user);
  }

  /*
    Invalidates all user feed caches since a like status change affects all users' views.
    Done asynchronously to keep the toggle operation fast.
   */
  private async invalidateFeedCache() {
    let cursor = '0';
    try {
      do {
        const [newCursor, keys] = await this.redis.scan(cursor, {
          match: 'posts:feed:*',
          count: 100,
        });
        if (keys && keys.length > 0) {
          await this.redis.del(...keys);
        }
        cursor = newCursor;
      } while (cursor !== '0');
    } catch (err) {
      console.error('Failed to invalidate feed cache:', err);
    }
  }
}
