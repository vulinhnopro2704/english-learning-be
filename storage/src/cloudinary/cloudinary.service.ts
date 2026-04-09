import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type ConfigOptions } from 'cloudinary';
import { Readable } from 'stream';

export type UploadResourceType = 'image' | 'video' | 'raw';

export interface UploadSignatureInput {
  resourceType: UploadResourceType;
  folder: string;
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Cloudinary configuration is missing. Check CLOUDINARY_* env vars.',
      );
    }

    const config: ConfigOptions = {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    };
    cloudinary.config(config);
  }

  get cloudName(): string {
    return this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
  }

  get apiKey(): string {
    return this.configService.getOrThrow<string>('CLOUDINARY_API_KEY');
  }

  generateUploadSignature(input: UploadSignatureInput): {
    signature: string;
    timestamp: number;
    folder: string;
    resourceType: UploadResourceType;
  } {
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
