import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Image or video file (JPG, PNG, GIF, MP4, MOV)',
    required: false,
  })
  file?: any;
}