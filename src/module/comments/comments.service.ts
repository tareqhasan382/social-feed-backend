import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.comment.create({
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

      // Prisma cascade handles children if configured in schema, 
      // otherwise manual cleanup would go here.
      await tx.comment.delete({ where: { id } });
      
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
