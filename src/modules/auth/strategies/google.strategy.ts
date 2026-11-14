import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'placeholder_client_id',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'placeholder_client_secret',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const user = {
      provider: 'GOOGLE',
      providerAccountId: id,
      email: emails?.[0]?.value,
      name: name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : undefined,
      avatar: photos?.[0]?.value,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
