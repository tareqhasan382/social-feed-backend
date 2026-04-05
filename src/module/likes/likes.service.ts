import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToggleLikeDto } from './dto/like.dto';
import Redis from 'ioredis';

@Injectable()
export class LikesService {
  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  
   // Toggles like/unlike for posts or comments using transactions to prevent race conditions.
  
  async toggleLike(userId: string, dto: ToggleLikeDto) {
    const { postId, commentId } = dto;

    if (!postId && !commentId) {
      throw new BadRequestException('Provide either postId or commentId');
    }

    if (postId && commentId) {
      throw new BadRequestException('Provide only one: postId or commentId');
    }

    return this.prisma.$transaction(async (tx) => {
      if (postId) {
        return this.handlePostLike(tx, userId, postId);
      } else {
        return this.handleCommentLike(tx, userId, commentId!);
      }
    });
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
    const stream = this.redis.scanStream({
      match: 'posts:feed:*',
    });

    stream.on('data', (keys: string[]) => {
      if (keys.length > 0) {
        this.redis.del(...keys);
      }
    });
  }
}
