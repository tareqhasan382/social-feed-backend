import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional image or video file',
  })
  file?: any;
}