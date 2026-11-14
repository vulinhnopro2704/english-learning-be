import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type ConfigOptions } from 'cloudinary';
import { Readable } from 'stream';
import { ApiException } from '../../common/exceptions/api.exception';

export type UploadResourceType = 'image' | 'video' | 'raw';

export interface UploadSignatureInput {
  resourceType: UploadResourceType;
  folder: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn(
        'Cloudinary credentials not provided. Storage upload operations will be unavailable until CLOUDINARY_* environment variables are set.',
      );
      this.isConfigured = false;
      return;
    }

    const config: ConfigOptions = {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    };
    cloudinary.config(config);
    this.isConfigured = true;
  }

  private assertConfigured() {
    if (!this.isConfigured) {
      throw new ApiException({
        statusCode: 503,
        errorCode: 'STORAGE_NOT_CONFIGURED',
        message: 'Cloudinary storage service is not configured on this server',
      });
    }
  }

  get cloudName(): string {
    this.assertConfigured();
    return this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
  }

  get apiKey(): string {
    this.assertConfigured();
    return this.configService.getOrThrow<string>('CLOUDINARY_API_KEY');
  }

  generateUploadSignature(input: UploadSignatureInput): {
    signature: string;
    timestamp: number;
    folder: string;
    resourceType: UploadResourceType;
  } {
    this.assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      timestamp,
      folder: input.folder,
      resource_type: input.resourceType,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    );

    return {
      signature,
      timestamp,
      folder: input.folder,
      resourceType: input.resourceType,
    };
  }

  generateDownloadUrl(input: {
    publicId: string;
    format: string;
    resourceType: UploadResourceType;
    expiresAtUnix: number;
  }): string {
    this.assertConfigured();
    return cloudinary.utils.private_download_url(input.publicId, input.format, {
      resource_type: input.resourceType,
      expires_at: input.expiresAtUnix,
      type: 'upload',
      attachment: false,
    });
  }

  async uploadBuffer(input: {
    buffer: Buffer;
    resourceType: UploadResourceType;
    folder: string;
    publicId: string;
    format?: string;
  }): Promise<{
    publicId: string;
    secureUrl: string;
    format: string | null;
    bytes: number;
  }> {
    this.assertConfigured();
    const stream = Readable.from(input.buffer);

    const result = await new Promise<{
      public_id: string;
      secure_url: string;
      format?: string;
      bytes?: number;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: input.resourceType,
          folder: input.folder,
          public_id: input.publicId,
          use_filename: false,
          overwrite: true,
          format: input.format,
        },
        (error, uploaded) => {
          if (error || !uploaded) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary upload failed'),
            );
            return;
          }
          resolve(uploaded as never);
        },
      );

      stream.pipe(uploadStream);
    });

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      format: result.format ?? null,
      bytes: result.bytes ?? input.buffer.byteLength,
    };
  }
}
