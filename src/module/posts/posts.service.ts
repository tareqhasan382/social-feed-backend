import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { Redis } from '@upstash/redis';

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
    const cachedData = await this.redis.get<any>(cacheKey);
    let result: any;

    if (cachedData) {
      result = cachedData;
    } else {
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

      result = {
        posts: resultPosts,
        nextCursor,
      };

      // Cache the result for this specific user
      await this.redis.set(cacheKey, JSON.stringify(result), { ex: this.CACHE_TTL });
    }

    // --- REAL-TIME HYBRID SYNC: Merge Redis counts into the result (cached or fresh) ---
    if (result.posts && result.posts.length > 0) {
      const pipeline = this.redis.pipeline();
      result.posts.forEach((post: any) => {
        pipeline.hgetall(`post:${post.id}:stats`);
      });

      const stats = await pipeline.exec();
      
      result.posts = result.posts.map((post: any, index: number) => {
        const postStats: any = stats?.[index];
        
        // If stats exist in Redis, they take precedence over DB counts
        if (postStats) {
          return {
            ...post,
            likesCount: postStats.likes ? Number(postStats.likes) : post.likesCount,
            commentsCount: postStats.comments ? Number(postStats.comments) : post.commentsCount,
          };
        }
        
        // If stats don't exist in Redis yet, initialize them from DB counts for the next request
        this.redis.hsetnx(`post:${post.id}:stats`, 'likes', post.likesCount);
        this.redis.hsetnx(`post:${post.id}:stats`, 'comments', post.commentsCount);
        
        return post;
      });
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

    if (!post) throw new NotFoundException('Post not found');
    
    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const basePost = {
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
    };

    // --- REAL-TIME HYBRID SYNC: Merge Redis counts ---
    const statsKey = `post:${id}:stats`;
    const postStats = await this.redis.hgetall(statsKey);

    if (postStats && Object.keys(postStats).length > 0) {
      return {
        ...basePost,
        likesCount: postStats.likes ? Number(postStats.likes) : basePost.likesCount,
        commentsCount: postStats.comments ? Number(postStats.comments) : basePost.commentsCount,
      };
    } else {
      // Initialize Redis if empty
      this.redis.hsetnx(statsKey, 'likes', basePost.likesCount);
      this.redis.hsetnx(statsKey, 'comments', basePost.commentsCount);
    }

    return basePost;
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
