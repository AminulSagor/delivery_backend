import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly expirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET')!;
    this.region = this.configService.get<string>('AWS_S3_REGION')!;
    this.expirySeconds = 300; // 5 minutes

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        )!,
      },
    });
  }

  async generateUploadUrl(key: string, contentType: string) {
    try {
      // 1. Create the PutObject command
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key, // Use the key passed from the controller
        ContentType: contentType,
        // ACL: 'private',
      });

      // 2. Generate the signed URL
      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.expirySeconds,
      });

      // 3. Construct the public URL
      const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      return {
        signedUrl,
        fileKey: key,
        publicUrl,
      };
    } catch (error) {
      console.error('S3 Presigned URL Error:', error);
      throw new InternalServerErrorException('Could not generate upload URL');
    }
  }
}
