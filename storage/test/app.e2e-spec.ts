import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { PrismaService } from '../src/prisma/prisma.service';

type StoredFile = {
  id: string;
  publicId: string;
  secureUrl: string;
  type: string;
  format?: string | null;
  size: number;
  ownerId: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type CreateFileArgs = {
  data: {
    id?: string;
    publicId: string;
    secureUrl: string;
    type: string;
    format?: string | null;
    size: number;
    ownerId: string;
    metadata?: unknown;
  };
};

type FindUniqueArgs = { where: { id: string } };
type FindManyArgs = { take: number };

describe('StorageService (e2e)', () => {
  let app: INestApplication;

  const db: StoredFile[] = [];

  const prismaMock = {
    file: {
      create: jest.fn().mockImplementation(async ({ data }: CreateFileArgs) => {
        const record: StoredFile = {
          id: data.id ?? '11111111-1111-4111-8111-111111111111',
          publicId: data.publicId,
          secureUrl: data.secureUrl,
          type: data.type,
          format: data.format,
          size: data.size,
          ownerId: data.ownerId,
          metadata: data.metadata ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.push(record);
        return record;
      }),
      findUnique: jest
        .fn()
        .mockImplementation(async ({ where }: FindUniqueArgs) => {
          return db.find((f) => f.id === where.id) ?? null;
        }),
      findMany: jest.fn().mockImplementation(async ({ take }: FindManyArgs) => {
        return db.slice(0, take);
      }),
    },
  };

  const cloudinaryMock = {
    apiKey: 'api-key',
    cloudName: 'demo',
    generateUploadSignature: jest.fn().mockReturnValue({
      signature: 'sig',
      timestamp: 1700000000,
      folder: 'users/avatar',
      resourceType: 'image',
    }),
    generateDownloadUrl: jest
      .fn()
      .mockReturnValue('https://api.cloudinary.com/v1_1/demo/download'),
  };

  beforeAll(async () => {
    process.env.MAX_FILE_SIZE_MB = '10';
    process.env.ALLOWED_MIME_TYPES = 'image/png,image/jpeg';
    process.env.SIGNED_URL_TTL_SECONDS = '300';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(CloudinaryService)
      .useValue(cloudinaryMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/files/upload-signature should return 200 when trusted headers exist', async () => {
    await request(app.getHttpServer())
      .post('/v1/files/upload-signature')
      .set('x-user-id', '63d27eca-fb7a-4035-ad5d-ad6df31b20c2')
      .send({
        resourceType: 'image',
        contentType: 'image/png',
        size: 1024,
        folder: 'users/avatar',
      })
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body.signature).toBe('sig');
      });
  });

  it('POST /v1/files/upload-signature should return 401 when trusted header is missing', async () => {
    await request(app.getHttpServer())
      .post('/v1/files/upload-signature')
      .send({
        resourceType: 'image',
        contentType: 'image/png',
        size: 1024,
        folder: 'users/avatar',
      })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('POST /v1/files should persist metadata', async () => {
    await request(app.getHttpServer())
      .post('/v1/files')
      .set('x-user-id', '63d27eca-fb7a-4035-ad5d-ad6df31b20c2')
      .send({
        publicId: 'users/avatar/file_1',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/file_1.png',
        type: 'image',
        format: 'png',
        size: 2048,
      })
      .expect(HttpStatus.CREATED)
      .expect(({ body }) => {
        expect(body.publicId).toBe('users/avatar/file_1');
      });
  });

  it('GET /v1/files/:id/download-url should return signed url', async () => {
    await request(app.getHttpServer())
      .get('/v1/files/11111111-1111-4111-8111-111111111111/download-url')
      .set('x-user-id', '63d27eca-fb7a-4035-ad5d-ad6df31b20c2')
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body.url).toContain('cloudinary.com');
      });
  });

  it('GET /v1/files should support list response', async () => {
    await request(app.getHttpServer())
      .get('/v1/files?limit=10')
      .set('x-user-id', '63d27eca-fb7a-4035-ad5d-ad6df31b20c2')
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.pagination).toBeDefined();
      });
  });

  it('POST /v1/files/upload-signature should return 400 on invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/v1/files/upload-signature')
      .set('x-user-id', '63d27eca-fb7a-4035-ad5d-ad6df31b20c2')
      .send({
        resourceType: 'image',
        contentType: 'image/png',
        folder: 'users/avatar',
      })
      .expect(HttpStatus.BAD_REQUEST);
  });
});
