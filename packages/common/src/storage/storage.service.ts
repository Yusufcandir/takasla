import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';

export interface UploadResult {
  key: string;
  url: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly localFallbackDir: string;
  private readonly r2Enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucketName = this.config.get<string>('R2_BUCKET_NAME', 'exchange-uploads');
    this.publicUrl = (this.config.get<string>('R2_PUBLIC_URL', '') || '').replace(/\/$/, '');
    this.localFallbackDir = join(process.cwd(), 'uploads-fallback');

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.r2Enabled = true;
      this.logger.log('R2 storage enabled');
    } else {
      this.r2Enabled = false;
      this.logger.warn('R2 env vars not set — falling back to local disk storage');
      if (!existsSync(this.localFallbackDir)) {
        mkdirSync(this.localFallbackDir, { recursive: true });
      }
    }
  }

  async upload(
    prefix: string,
    buffer: Buffer,
    originalFilename: string,
    contentType: string,
  ): Promise<UploadResult> {
    const ext = extname(originalFilename);
    const filename = `${randomUUID()}${ext}`;
    const key = `${prefix}/${filename}`;

    if (this.r2Enabled && this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return { key, url: `${this.publicUrl}/${key}` };
    }

    // Local fallback
    const dir = join(this.localFallbackDir, prefix);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), buffer);
    return { key, url: '' };
  }

  async delete(key: string): Promise<void> {
    if (this.r2Enabled && this.s3Client) {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      return;
    }
    const filePath = join(this.localFallbackDir, key);
    if (existsSync(filePath)) unlinkSync(filePath);
  }

  get isCloudEnabled(): boolean {
    return this.r2Enabled;
  }
}
