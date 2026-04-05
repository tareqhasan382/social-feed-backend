import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class ToggleLikeDto {
  @ApiPropertyOptional({ example: 'post-uuid', description: 'The ID of the post to like/unlike' })
  @IsUUID()
  @IsOptional()
  postId?: string;

  @ApiPropertyOptional({ example: 'comment-uuid', description: 'The ID of the comment to like/unlike' })
  @IsUUID()
  @IsOptional()
  commentId?: string;
}
