import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import sharp from 'sharp';

export interface UploadResult {
  key: string;
  url: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
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

  private isImageMimeType(contentType: string): boolean {
    return /^image\/(jpeg|jpg|png|webp|avif|tiff)$/i.test(contentType);
  }

  private async stripExifMetadata(buffer: Buffer, contentType: string): Promise<Buffer> {
    if (!this.isImageMimeType(contentType)) {
      return buffer;
    }
    try {
      // .rotate() auto-orients based on EXIF, then strips all metadata (GPS, camera info, etc.)
      return await sharp(buffer).rotate().toBuffer();
    } catch (err) {
      this.logger.warn(`Failed to strip EXIF metadata, uploading original: ${err}`);
      return buffer;
    }
  }

  private async generateThumbnail(buffer: Buffer, contentType: string, maxWidth = 400): Promise<Buffer | null> {
    if (!this.isImageMimeType(contentType)) return null;
    try {
      return await sharp(buffer)
        .resize(maxWidth, undefined, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();
    } catch (err) {
      this.logger.warn(`Failed to generate thumbnail: ${err}`);
      return null;
    }
  }

  async upload(
    prefix: string,
    buffer: Buffer,
    originalFilename: string,
    contentType: string,
  ): Promise<UploadResult> {
    const ext = extname(originalFilename);
    const id = randomUUID();
    const filename = `${id}${ext}`;
    const key = `${prefix}/${filename}`;

    // Strip EXIF metadata (GPS, camera info) from images before storing
    const cleanBuffer = await this.stripExifMetadata(buffer, contentType);

    // Generate thumbnail for images
    const thumbBuffer = await this.generateThumbnail(cleanBuffer, contentType);
    const thumbFilename = `${id}_thumb.jpg`;
    const thumbKey = thumbBuffer ? `${prefix}/${thumbFilename}` : undefined;

    if (this.r2Enabled && this.s3Client) {
      const uploads: Promise<unknown>[] = [
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: cleanBuffer,
            ContentType: contentType,
          }),
        ),
      ];
      if (thumbBuffer && thumbKey) {
        uploads.push(
          this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: thumbKey,
              Body: thumbBuffer,
              ContentType: 'image/jpeg',
            }),
          ),
        );
      }
      await Promise.all(uploads);
      return {
        key,
        url: `${this.publicUrl}/${key}`,
        thumbnailKey: thumbKey,
        thumbnailUrl: thumbKey ? `${this.publicUrl}/${thumbKey}` : undefined,
      };
    }

    // Local fallback
    const dir = join(this.localFallbackDir, prefix);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), cleanBuffer);
    if (thumbBuffer) {
      writeFileSync(join(dir, thumbFilename), thumbBuffer);
    }
    return {
      key,
      url: '',
      thumbnailKey: thumbKey,
      thumbnailUrl: thumbKey ? '' : undefined,
    };
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
