import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import Redis from 'ioredis';

@Injectable()
export class PostsService {
  private readonly CACHE_TTL = 300; // 5 minutes TTL

  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Creates a new post and async invalidates the feed cache.
   */
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

    // Async invalidation to avoid blocking response
    this.invalidateGlobalFeedCache();
    
    return post;
  }

  /**
   * Retrieves paginated posts with user-specific interaction status.
   * Implements cursor-based pagination for high performance and scalability.
   */
  async findAll(userId: string, cursor?: string, limit = 10, search?: string) {
    const take = Number(limit);
    const cacheKey = `posts:feed:${userId}:${cursor || 'start'}:l${limit}:${search || ''}`;

    // Attempt to get from cache
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const where: any = {
      OR: [
        { visibility: 'PUBLIC' },
        { authorId: userId },
      ],
    };

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const posts = await this.prisma.post.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        likes: {
          take: 3,
          select: {
            user: {
              select: {
                id: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1, // Take one extra to get the next cursor
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });

    let nextCursor: string | undefined = undefined;
    if (posts.length > take) {
      const nextItem = posts.pop();
      nextCursor = nextItem!.id;
    }

    // Map to include interaction status and counts
    const resultPosts = posts.map(post => ({
      ...post,
      isLiked: post.likes.some(like => like.user.id === userId),
      likedUsers: post.likes.map(like => ({
        id: like.user.id,
        avatarUrl: like.user.avatarUrl,
      })),
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined, 
      _count: undefined,
    }));

    const result = {
      posts: resultPosts,
      nextCursor,
    };

    // Cache the result for this specific user
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

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
      throw new ForbiddenException('Access denied');
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

  /**
   * Updates a post and async invalidates the user's specific cache.
   */
  async update(id: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('Ownership required');

    const updatedPost = await this.prisma.post.update({
      where: { id },
      data: dto,
    });

    this.invalidateGlobalFeedCache();
    return updatedPost;
  }

  /**
   * Removes a post and async invalidates the cache.
   */
  async remove(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('Ownership required');

    await this.prisma.post.delete({ where: { id } });
    
    this.invalidateGlobalFeedCache();
    return { message: 'Post deleted successfully' };
  }

  /**
   * Invalidates all feed caches using a pattern match.
   * This is done asynchronously to avoid blocking DB operations.
   */
  private async invalidateGlobalFeedCache() {
    // We use a prefix scan to find all feed-related keys for all users
    // This ensures that when a new post is created or updated, the feed is refreshed
    const stream = this.redis.scanStream({
      match: 'posts:feed:*',
      count: 100
    });

    stream.on('data', (keys: string[]) => {
      if (keys.length > 0) {
        this.redis.del(...keys);
      }
    });
  }
}
