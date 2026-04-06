import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    @InjectQueue('comment-counts') private readonly commentCountsQueue: Queue,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

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
        await this.redis.hset(statsKey, 'likes', post._count.likes, 'comments', post._count.comments);
        stats = {
          likes: post._count.likes.toString(),
          comments: post._count.comments.toString(),
        };
      }
    }
    return stats;
  }

  /**
   * Creates a comment or a nested reply.
   */
  async create(userId: string, dto: CreateCommentDto) {
    const { postId, parentId, text } = dto;

    // Verify post existence
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    // Verify parent comment if this is a reply
    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({ where: { id: parentId } });
      if (!parentComment) throw new NotFoundException('Parent comment not found');
      if (parentComment.postId !== postId) {
        throw new ForbiddenException('Reply must belong to the same post');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        text,
        authorId: userId,
        postId,
        parentId,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // --- REAL-TIME HYBRID SYNC (REDIS + WEBSOCKET) ---
    const statsKey = `post:${postId}:stats`;
    
    // Ensure initialized
    await this.getStatsFromRedis(postId);
    
    const newCount = await this.redis.hincrby(statsKey, 'comments', 1);

    // Fetch latest 3 likedBy avatars for consistency in payload
    const latestLikes = await this.prisma.like.findMany({
      where: { postId },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { user: { select: { id: true, avatarUrl: true } } }
    });

    // Get current likes count from Redis
    const likesCount = await this.redis.hget(statsKey, 'likes');

    // Immediate WebSocket broadcast
    this.realtimeGateway.emitPostUpdate(postId, 'commentAdded', {
      likesCount: Number(likesCount || 0),
      commentsCount: Number(newCount),
      likedBy: latestLikes.map(l => ({ id: l.user.id, avatarUrl: l.user.avatarUrl })),
      comment: parentId ? undefined : comment,
    });

    // Handle nested reply notification separately
    if (parentId) {
      this.realtimeGateway.emitReplyAdded(postId, parentId, comment);
    }

    // BullMQ for background verification
    await this.commentCountsQueue.add('sync-counts', {
      postId,
      event: 'commentAdded',
    }, {
      removeOnComplete: true,
      delay: 5000
    });

    return comment;
  }

  /**
   * Retrieves top-level comments with their first few replies efficiently.
   * Includes likesCount and isLiked status.
   */
  async findByPost(postId: string, userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null, // Only top-level
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
            _count: { select: { likes: true } },
            likes: {
              where: { userId },
              select: { id: true },
            },
          },
          take: 3, // First 3 replies per comment
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return comments.map(comment => this.formatComment(comment));
  }

  /**
   * Updates a comment using a transaction to ensure safe state.
   */
  async update(id: string, userId: string, dto: UpdateCommentDto) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({ where: { id } });
      
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.authorId !== userId) throw new ForbiddenException('Ownership required');

      return tx.comment.update({
        where: { id },
        data: { text: dto.text },
      });
    });
  }

  /**
   * Safely deletes a comment and its nested tree using cascading or manual cleanup in transaction.
   */
  async remove(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({ where: { id } });
      
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.authorId !== userId) throw new ForbiddenException('Ownership required');

      const postId = comment.postId;

      // Prisma cascade handles children if configured in schema
      await tx.comment.delete({ where: { id } });
      
      // --- REAL-TIME HYBRID SYNC (REDIS + WEBSOCKET) ---
      const statsKey = `post:${postId}:stats`;
      
      // Ensure initialized
      await this.getStatsFromRedis(postId);
      
      const newCount = await this.redis.hincrby(statsKey, 'comments', -1);

      const latestLikes = await this.prisma.like.findMany({
        where: { postId },
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { user: { select: { id: true, avatarUrl: true } } }
      });

      const likesCount = await this.redis.hget(statsKey, 'likes');

      this.realtimeGateway.emitPostUpdate(postId, 'commentDeleted', {
        likesCount: Number(likesCount || 0),
        commentsCount: Number(newCount),
        likedBy: latestLikes.map(l => ({ id: l.user.id, avatarUrl: l.user.avatarUrl })),
        commentId: id,
      });

      // Use BullMQ for count synchronization after deletion
      await this.commentCountsQueue.add('sync-counts', {
        postId,
        commentId: id,
        event: 'commentDeleted',
      }, {
        removeOnComplete: true,
        delay: 5000
      });

      return { success: true };
    });
  }

  /**
   * Helper to format comment/reply with interaction status.
   */
  private formatComment(comment: any) {
    return {
      ...comment,
      isLiked: comment.likes.length > 0,
      likesCount: comment._count.likes,
      repliesCount: comment._count.replies,
      replies: comment.replies?.map((reply: any) => ({
        ...reply,
        isLiked: reply.likes.length > 0,
        likesCount: reply._count.likes,
        likes: undefined,
        _count: undefined,
      })),
      likes: undefined,
      _count: undefined,
    };
  }
}
