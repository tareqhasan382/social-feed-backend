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

  async toggleLike(userId: string, dto: ToggleLikeDto) {
    const { postId, commentId } = dto;

    if (!postId && !commentId) {
      throw new BadRequestException('Either postId or commentId must be provided');
    }

    if (postId && commentId) {
      throw new BadRequestException('Provide either postId or commentId, not both');
    }

    if (postId) {
      return this.togglePostLike(userId, postId);
    } else {
      return this.toggleCommentLike(userId, commentId!);
    }
  }

  private async togglePostLike(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    if (existingLike) {
      await this.prisma.like.delete({ where: { id: existingLike.id } });
      await this.invalidateFeedCache();
      return { liked: false };
    } else {
      await this.prisma.like.create({
        data: { userId, postId },
      });
      await this.invalidateFeedCache();
      return { liked: true };
    }
  }

  private async toggleCommentLike(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_commentId: { userId, commentId },
      },
    });

    if (existingLike) {
      await this.prisma.like.delete({ where: { id: existingLike.id } });
      return { liked: false };
    } else {
      await this.prisma.like.create({
        data: { userId, commentId },
      });
      return { liked: true };
    }
  }

  async getPostLikes(postId: string) {
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
    });
    return likes.map(like => like.user);
  }

  private async invalidateFeedCache() {
    await this.redis.del('posts:feed');
  }
}
