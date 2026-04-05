import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/request-with-user.interface';

@ApiTags('Comments')
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new comment or reply' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  create(@Req() req: RequestWithUser, @Body() createCommentDto: CreateCommentDto) {
    return this.commentsService.create(req.user.id, createCommentDto);
  }

  @Get('post/:postId')
  @ApiOperation({ summary: 'Get all comments for a specific post' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  findByPost(@Param('postId') postId: string, @Req() req: RequestWithUser) {
    return this.commentsService.findByPost(postId, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  update(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, req.user.id, updateCommentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.commentsService.remove(id, req.user.id);
  }
}
