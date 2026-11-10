import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface IStorageService {
  uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  getPresignedDownloadUrl(key: string, originalFileName: string, expiresInSeconds?: number): Promise<string>;
  getFileBuffer(key: string): Promise<Buffer>;
}

export class S3StorageService implements IStorageService {
  private s3: S3Client | null = null;
  private localFallbackDir: string;

  constructor() {
    this.localFallbackDir = path.resolve(process.cwd(), 'uploads_fallback');
    if (!fs.existsSync(this.localFallbackDir)) {
      fs.mkdirSync(this.localFallbackDir, { recursive: true });
    }

    if (config.S3_ENDPOINT) {
      this.s3 = new S3Client({
        endpoint: config.S3_ENDPOINT,
        region: config.S3_REGION,
        credentials: {
          accessKeyId: config.S3_ACCESS_KEY,
          secretAccessKey: config.S3_SECRET_KEY,
        },
        forcePathStyle: config.S3_FORCE_PATH_STYLE,
        maxAttempts: 1,
      });
    }
  }

  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (this.s3) {
      try {
        const cmd = new PutObjectCommand({
          Bucket: config.S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        });
        await this.s3.send(cmd);
        return;
      } catch (err) {
        console.warn('S3 upload failed, falling back to secure local storage:', err);
      }
    }

    // Local fallback
    const targetPath = path.join(this.localFallbackDir, key);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, buffer);
  }

  async getPresignedDownloadUrl(key: string, originalFileName: string, expiresInSeconds = 300): Promise<string> {
    if (this.s3) {
      try {
        const cmd = new GetObjectCommand({
          Bucket: config.S3_BUCKET,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFileName)}"`,
        });
        return await getSignedUrl(this.s3, cmd, { expiresIn: expiresInSeconds });
      } catch (err) {
        console.warn('S3 presigned URL generation failed, falling back to local download route:', err);
      }
    }

    // Local fallback route
    return `/api/attachments/download/${encodeURIComponent(key)}`;
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const targetPath = path.join(this.localFallbackDir, key);
    if (fs.existsSync(targetPath)) {
      return fs.readFileSync(targetPath);
    }
    throw new Error('File not found in storage');
  }
}

export const storageService = new S3StorageService();
