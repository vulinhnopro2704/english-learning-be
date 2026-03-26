import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type ConfigOptions } from 'cloudinary';

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
}
