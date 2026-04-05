import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateCommentDto) {
    const { postId, parentId, text } = dto;

    // Verify post exists
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    // If parentId is provided, verify it exists and belongs to the same post
    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({ where: { id: parentId } });
      if (!parentComment) throw new NotFoundException('Parent comment not found');
      if (parentComment.postId !== postId) throw new ForbiddenException('Cannot reply to comment on different post');
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

  async findByPost(postId: string, userId: string) {
    // Only get top-level comments and their first few replies for initial view
    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null,
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
            _count: {
              select: { likes: true },
            },
            likes: {
              where: { userId },
              select: { id: true },
            },
          },
          take: 5,
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
    });

    return comments.map(comment => ({
      ...comment,
      isLiked: comment.likes.length > 0,
      likesCount: comment._count.likes,
      repliesCount: comment._count.replies,
      replies: comment.replies.map(reply => ({
        ...reply,
        isLiked: reply.likes.length > 0,
        likesCount: reply._count.likes,
        likes: undefined,
        _count: undefined,
      })),
      likes: undefined,
      _count: undefined,
    }));
  }

  async update(id: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) throw new ForbiddenException('You can only update your own comments');

    return this.prisma.comment.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) throw new ForbiddenException('You can only delete your own comments');

    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Comment deleted successfully' };
  }
}
