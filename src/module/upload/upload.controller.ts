import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadFileDto } from './dto/upload-file.dto';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an optional image or video' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileDto })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    // Check if file exists
    if (!file) {
      return {
        success: true,
        message: 'No file uploaded, skipping',
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
      return {
        success: false,
        message: 'Upload failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}