import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUrl } from 'class-validator';
// import { Visibility } from '../../../prisma/generated/client';
import { Visibility } from '../../../../prisma/generated/client';
export class CreatePostDto {
  @ApiProperty({ example: 'Check out my new post!', description: 'The content of the post' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.png', description: 'Optional image URL for the post' })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.PUBLIC, description: 'Post visibility' })
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}

export class UpdatePostDto {
  @ApiPropertyOptional({ example: 'Updated content', description: 'The updated content of the post' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: 'https://example.com/updated-image.png', description: 'Updated image URL' })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: Visibility, description: 'Updated post visibility' })
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}
