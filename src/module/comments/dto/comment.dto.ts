import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'This is a great post!', description: 'The text of the comment' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ example: 'post-uuid', description: 'The ID of the post being commented on' })
  @IsUUID()
  @IsNotEmpty()
  postId: string;

  @ApiPropertyOptional({ example: 'parent-comment-uuid', description: 'The ID of the parent comment (for replies)' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated comment text', description: 'The updated text of the comment' })
  @IsString()
  @IsNotEmpty()
  text: string;
}
