import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadFileDto } from './dto/upload-file.dto';
import { PostsController } from '../posts/posts.controller';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  private readonly logger = new Logger(PostsController.name);
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an optional image or video file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File upload (optional)',
    type: UploadFileDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    // Handle optional file
    if (!file) {
      return {
        success: true,
        message: 'No file provided, proceeding without upload',
        data: null,
      };
    }
  
    try {
      const url = await this.uploadService.uploadFile(file);
      return {
        success: true,
        message: 'File uploaded successfully',
        data: url,
      };
    } catch (err) {
      this.logger.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
      return {
        success: false,
        message: 'Upload failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}