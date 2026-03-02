import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './modules/db/db.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: 'apps/auth/.env',
    }),
    DbModule,
    RedisModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
