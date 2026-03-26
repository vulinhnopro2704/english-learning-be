import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { FileType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from './files.service';

describe('FilesService', () => {
  const prismaMock = {
    file: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const cloudinaryMock = {
    cloudName: 'demo',
    apiKey: 'api-key',
    generateUploadSignature: jest.fn().mockReturnValue({
      signature: 'sig',
      timestamp: 1700000000,
      folder: 'users/avatar',
      resourceType: 'image',
    }),
    generateDownloadUrl: jest.fn().mockReturnValue('https://api.cloudinary.com/signed'),
  } as unknown as CloudinaryService;

  const configMock = {
    get: (key: string) =>
      (
        {
          MAX_FILE_SIZE_MB: '10',
          ALLOWED_MIME_TYPES: 'image/png,image/jpeg',
          SIGNED_URL_TTL_SECONDS: '300',
        } as Record<string, string>
      )[key],
  } as ConfigService;

  let service: FilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FilesService(prismaMock, cloudinaryMock, configMock);
  });

  it('should create upload signature', () => {
    const result = service.createUploadSignature({
      resourceType: 'image',
      contentType: 'image/png',
      size: 1024,
      folder: 'users/avatar',
    });

    expect(result.signature).toBe('sig');
    expect(result.apiKey).toBe('api-key');
  });

  it('should reject upload signature for unsupported mime type', () => {
    expect(() =>
      service.createUploadSignature({
        resourceType: 'image',
        contentType: 'application/x-msdownload',
        size: 1024,
        folder: 'users/avatar',
      }),
    ).toThrow(BadRequestException);
  });

  it('should throw not found when file id does not exist', async () => {
    prismaMock.file.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      service.getFileById('f8ec6fd6-49cb-4612-afdc-650431e1c5fa'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should map prisma enum to cloudinary resource type when generating download url', async () => {
    prismaMock.file.findUnique = jest.fn().mockResolvedValue({
      id: 'f8ec6fd6-49cb-4612-afdc-650431e1c5fa',
      publicId: 'users/avatar/file_1',
      format: 'png',
      type: FileType.IMAGE,
    });

    const result = await service.getDownloadUrl(
      'f8ec6fd6-49cb-4612-afdc-650431e1c5fa',
      {},
    );

    expect(result.url).toContain('cloudinary');
    expect(cloudinaryMock.generateDownloadUrl).toHaveBeenCalled();
  });
});
