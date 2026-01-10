import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { S3Service } from './s3-upload.service';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// @UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('signed-url')
  async getSignedUrl(@Body() dto: GetUploadUrlDto) {
    // 1. Determine a unique file path (Key)
    const fileExt = extname(dto.fileName);
    const uniqueId = uuidv4();
    const timestamp = Date.now();

    // Example: merchants/nid/550e8400-e29b-...-1709... .png
    const key = `${dto.module}/${uniqueId}-${timestamp}${fileExt}`;

    // 2. Generate the Pre-Signed URL
    // NOW VALID: Passes 2 arguments (Key, Type)
    const result = await this.s3Service.generateUploadUrl(key, dto.fileType);

    return {
      success: true,
      message: 'Signed URL generated successfully',
      ...result,
    };
  }
}
