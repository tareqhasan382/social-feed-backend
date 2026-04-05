import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import Redis from 'ioredis';

@Injectable()
export class PostsService {
  private readonly FEED_CACHE_KEY = 'posts:feed';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async create(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        ...dto,
        authorId: userId,
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

    // Invalidate cache when new post is created
    await this.invalidateFeedCache();
    
    return post;
  }

  async findAll(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    // Attempt to get from cache for page 1
    if (page === 1) {
      const cachedFeed = await this.redis.get(this.FEED_CACHE_KEY);
      if (cachedFeed) {
        return JSON.parse(cachedFeed);
      }
    }

    const posts = await this.prisma.post.findMany({
      where: {
        OR: [
          { visibility: 'PUBLIC' },
          { authorId: userId },
        ],
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
        _count: {
          select: {
            comments: true,
            likes: true,
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

    const result = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined,
      _count: undefined,
    }));

    // Cache page 1
    if (page === 1) {
      await this.redis.setex(this.FEED_CACHE_KEY, this.CACHE_TTL, JSON.stringify(result));
    }

    return result;
  }

  async findOne(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!post) throw new NotFoundException('Post not found');
    
    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      throw new ForbiddenException('You do not have permission to view this post');
    }

    return {
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined,
      _count: undefined,
    };
  }

  async update(id: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('You can only update your own posts');

    const updatedPost = await this.prisma.post.update({
      where: { id },
      data: dto,
    });

    await this.invalidateFeedCache();
    return updatedPost;
  }

  async remove(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('You can only delete your own posts');

    await this.prisma.post.delete({ where: { id } });
    await this.invalidateFeedCache();
    
    return { message: 'Post deleted successfully' };
  }

  private async invalidateFeedCache() {
    await this.redis.del(this.FEED_CACHE_KEY);
  }
}
