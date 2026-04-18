import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { RedisService } from '../src/modules/redis/redis.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn().mockResolvedValue(true),
        getJson: jest.fn((key: string) => {
          const raw = store.get(key);
          return Promise.resolve(raw ? JSON.parse(raw) : null);
        }),
        setJson: jest.fn((key: string, value: unknown) => {
          store.set(key, JSON.stringify(value));
          return Promise.resolve();
        }),
        get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
        set: jest.fn((key: string, value: string) => {
          store.set(key, value);
          return Promise.resolve();
        }),
        del: jest.fn((key: string) => {
          store.delete(key);
          return Promise.resolve();
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
      service: 'generative',
    });
  });

  it('/tutor/sessions (POST) then interact (POST)', async () => {
    const sessionResponse = await request(app.getHttpServer())
      .post('/tutor/sessions')
      .send({
        cefrLevel: 'A2',
        focusTopics: ['daily_conversation'],
      })
      .expect(201);

    const sessionId = sessionResponse.body.sessionId as string;
    expect(sessionId).toBeTruthy();

    const interactResponse = await request(app.getHttpServer())
      .post(`/tutor/sessions/${sessionId}/interact`)
      .send({
        userInput: 'I goed to school yesterday.',
        inputMode: 'text',
      })
      .expect(201);

    expect(interactResponse.body.sessionId).toBe(sessionId);
    expect(interactResponse.body.tutorText).toEqual(expect.any(String));
    expect(interactResponse.body.facialExpression).toEqual(expect.any(String));
    expect(interactResponse.body.animation).toEqual(expect.any(String));
    expect(interactResponse.body.lipSync).toEqual(
      expect.objectContaining({
        mouthCues: expect.any(Array),
      }),
    );
    expect(interactResponse.body.audio).toEqual(
      expect.objectContaining({
        provider: 'elevenlabs',
      }),
    );
  });
});
