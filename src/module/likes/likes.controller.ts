import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LikesService } from './likes.service';
import { ToggleLikeDto } from './dto/like.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/request-with-user.interface';

@ApiTags('Likes')
@UseGuards(JwtAuthGuard)
@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('toggle')
  @ApiOperation({ summary: 'Toggle like on a post or comment' })
  @ApiResponse({ status: 200, description: 'Like toggled successfully' })
  toggleLike(@Req() req: RequestWithUser, @Body() toggleLikeDto: ToggleLikeDto) {
    return this.likesService.toggleLike(req.user.id, toggleLikeDto);
  }

  @Get('post/:postId')
  @ApiOperation({ summary: 'Get all users who liked a post' })
  @ApiResponse({ status: 200, description: 'List of users retrieved successfully' })
  getPostLikes(@Param('postId') postId: string) {
    return this.likesService.getPostLikes(postId);
  }
}
