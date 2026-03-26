import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import type { CurrentUser } from '../common/auth/current-user.interface';
import { FileType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFileDto } from './dto/create-file.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import {
  DownloadUrlQueryDto,
  UploadSignatureDto,
} from './dto/upload-signature.dto';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  createUploadSignature(dto: UploadSignatureDto) {
    const maxSizeMb = Number(
      this.configService.get<string>('MAX_FILE_SIZE_MB') ?? '10',
    );
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (dto.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds MAX_FILE_SIZE_MB (${maxSizeMb}MB)`,
      );
    }

    const allowedMimeTypes = this.parseAllowedMimeTypes();
    if (!allowedMimeTypes.includes(dto.contentType)) {
      throw new BadRequestException('MIME type is not allowed');
    }

    const signed = this.cloudinaryService.generateUploadSignature({
      resourceType: dto.resourceType,
      folder: dto.folder,
    });
    const expiresAt = new Date((signed.timestamp + 300) * 1000).toISOString();

    return {
      ...signed,
      apiKey: this.cloudinaryService.apiKey,
      cloudName: this.cloudinaryService.cloudName,
      expiresAt,
    };
  }

  async createFile(dto: CreateFileDto, user: CurrentUser) {
    try {
      return await this.prisma.file.create({
        data: {
          publicId: dto.publicId,
          secureUrl: dto.secureUrl,
          type: this.toPrismaFileType(dto.type),
          format: dto.format,
          size: dto.size,
          ownerId: user.id,
          metadata: dto.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('publicId already exists');
      }
      throw error;
    }
  }

  async getFileById(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async getDownloadUrl(id: string, query: DownloadUrlQueryDto) {
    const file = await this.getFileById(id);

    const defaultTtl = Number(
      this.configService.get<string>('SIGNED_URL_TTL_SECONDS') ?? '300',
    );
    const ttl = query.expiresInSeconds ?? defaultTtl;
    const expiresAtUnix = Math.floor(Date.now() / 1000) + ttl;

    const format = file.format ?? 'bin';
    const resourceType = this.fromPrismaTypeToCloudinaryType(file.type);

    const url = this.cloudinaryService.generateDownloadUrl({
      publicId: file.publicId,
      format,
      resourceType,
      expiresAtUnix,
    });

    return {
      url,
      expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
    };
  }

  async listFiles(query: ListFilesQueryDto) {
    const take = query.limit ?? 20;
    const where: Prisma.FileWhereInput = {
      type: query.type ? this.toPrismaFileType(query.type) : undefined,
      createdAt: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
    };

    const files = await this.prisma.file.findMany({
      where,
      take: take + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const hasMore = files.length > take;
    const data = hasMore ? files.slice(0, take) : files;
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        limit: take,
      },
    };
  }

  private parseAllowedMimeTypes(): string[] {
    const raw =
      this.configService.get<string>('ALLOWED_MIME_TYPES') ??
      'image/png,image/jpeg,image/webp,video/mp4,application/pdf';
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private toPrismaFileType(type: 'image' | 'video' | 'file'): FileType {
    switch (type) {
      case 'image':
        return FileType.IMAGE;
      case 'video':
        return FileType.VIDEO;
      default:
        return FileType.FILE;
    }
  }

  private fromPrismaTypeToCloudinaryType(
    type: FileType,
  ): 'image' | 'video' | 'raw' {
    switch (type) {
      case FileType.IMAGE:
        return 'image';
      case FileType.VIDEO:
        return 'video';
      default:
        return 'raw';
    }
  }
}
