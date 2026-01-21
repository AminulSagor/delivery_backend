import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly expirySeconds: number;
  private isConfigured: boolean = false;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || '';
    this.region =
      this.configService.get<string>('AWS_S3_REGION') || 'ap-south-1';
    this.expirySeconds = 300; // 5 minutes

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    if (accessKeyId && secretAccessKey && this.bucketName) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isConfigured = true;
      this.logger.log('S3 client initialized successfully');
    } else {
      this.logger.warn(
        'S3 credentials not configured - upload features will be unavailable',
      );
    }
  }

  onModuleInit() {
    this.logger.log(
      `S3Service initialized. Configured: ${this.isConfigured}, Bucket: ${this.bucketName || 'NOT SET'}`,
    );
  }

  private checkConfiguration() {
    if (!this.isConfigured || !this.s3Client) {
      throw new InternalServerErrorException(
        'S3 is not configured. Please set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.',
      );
    }
  }

  async generateUploadUrl(key: string, contentType: string) {
    this.checkConfiguration();

    try {
      // 1. Create the PutObject command (for upload)
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        // Files are uploaded as private for security
      });

      // 2. Generate the signed upload URL (expires in 5 minutes)
      const signedUrl = await getSignedUrl(this.s3Client!, putCommand, {
        expiresIn: this.expirySeconds,
      });

      // 3. Generate a signed read URL (expires in 7 days - AWS maximum)
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const readUrl = await getSignedUrl(this.s3Client!, getCommand, {
        expiresIn: 604800, // 7 days in seconds (AWS maximum for signed URLs)
      });

      // 4. Also provide the fileKey for reference
      return {
        signedUrl, // For uploading (expires in 5 min)
        fileKey: key, // File path in S3
        readUrl, // For accessing the file (expires in 7 days) - USE THIS IN DATABASE
      };
    } catch (error) {
      this.logger.error('S3 Presigned URL Error:', error);
      throw new InternalServerErrorException('Could not generate upload URL');
    }
  }

  /**
   * Generate a new signed read URL for an existing file
   * Use this when the stored readUrl has expired (after 7 days)
   */
  async generateReadUrl(fileKey: string): Promise<string> {
    this.checkConfiguration();

    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const readUrl = await getSignedUrl(this.s3Client!, getCommand, {
        expiresIn: 604800, // 7 days in seconds
      });

      return readUrl;
    } catch (error) {
      this.logger.error('S3 Read URL Error:', error);
      throw new InternalServerErrorException('Could not generate read URL');
    }
  }
}
