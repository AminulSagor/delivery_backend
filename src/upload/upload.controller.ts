import { Body, Controller, Post, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { S3Service } from './s3-upload.service';
import { Public } from '../common/decorators/public.decorator';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

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

  /**
   * Regenerate read URL for an existing file
   * Use this when the stored readUrl has expired (after 7 days)
   * 
   * @param fileKey - The file key from the original upload (e.g., "merchants/logo/abc-123.jpg")
   *                  Pass as query parameter: ?fileKey=merchants/logo/abc-123.jpg
   */
  @Public()
  @Get('read-url')
  async getReadUrl(@Query('fileKey') fileKey: string) {
    if (!fileKey) {
      throw new BadRequestException('fileKey query parameter is required');
    }
    
    const readUrl = await this.s3Service.generateReadUrl(fileKey);

    return {
      success: true,
      message: 'Read URL generated successfully',
      readUrl,
      fileKey,
    };
  }
}
