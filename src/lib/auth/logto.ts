import { UserScope, LogtoNextConfig } from '@logto/next';

export const logtoConfig: LogtoNextConfig = {
    endpoint: process.env.LOGTO_ENDPOINT || 'https://logto.dev',
    appId: process.env.LOGTO_APP_ID || 'missing_app_id',
    appSecret: process.env.LOGTO_APP_SECRET || 'missing_app_secret',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    cookieSecret: process.env.LOGTO_COOKIE_SECRET || 'complex_password_at_least_32_characters_long',
    cookieSecure: process.env.NODE_ENV === 'production',
    scopes: [UserScope.Email, UserScope.Profile, UserScope.Roles],
};
