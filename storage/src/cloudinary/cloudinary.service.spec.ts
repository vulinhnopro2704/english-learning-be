import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  const configService = {
    get: (key: string) =>
      (
        ({
          CLOUDINARY_CLOUD_NAME: 'demo',
          CLOUDINARY_API_KEY: '123456',
          CLOUDINARY_API_SECRET: 'secret',
        }) as Record<string, string>
      )[key],
    getOrThrow: (key: string) =>
      (
        ({
          CLOUDINARY_CLOUD_NAME: 'demo',
          CLOUDINARY_API_KEY: '123456',
          CLOUDINARY_API_SECRET: 'secret',
        }) as Record<string, string>
      )[key],
  } as ConfigService;

  let service: CloudinaryService;

  beforeEach(() => {
    service = new CloudinaryService(configService);
  });

  it('should generate upload signature', () => {
    const result = service.generateUploadSignature({
      resourceType: 'image',
      folder: 'users/avatar',
    });

    expect(result.signature).toBeDefined();
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.resourceType).toBe('image');
  });

  it('should generate signed download url', () => {
    const url = service.generateDownloadUrl({
      publicId: 'users/avatar/file_1',
      format: 'png',
      resourceType: 'image',
      expiresAtUnix: Math.floor(Date.now() / 1000) + 300,
    });

    expect(url).toContain('https://');
    expect(url).toContain('api.cloudinary.com');
  });
});
