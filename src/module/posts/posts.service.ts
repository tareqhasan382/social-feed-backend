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
   * Implements per-user caching for the first page of the feed.
   */
  async findAll(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const cacheKey = `posts:feed:${userId}:p${page}:l${limit}`;

    // Attempt to get from cache
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
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

    // Map to include interaction status and counts
    const result = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined, // Remove unnecessary relation data
      _count: undefined,
    }));

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
    // In a production environment, you might use a more granular invalidation strategy
    // or a specialized cache invalidation service. For simplicity, we use SCAN.
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
