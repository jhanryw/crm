import { UserScope, LogtoNextConfig } from '@logto/next';

if (!process.env.LOGTO_ENDPOINT) console.error('CRITICAL: LOGTO_ENDPOINT is missing!');
if (!process.env.LOGTO_APP_ID) console.error('CRITICAL: LOGTO_APP_ID is missing!');
if (!process.env.NEXT_PUBLIC_APP_URL) console.error('CRITICAL: NEXT_PUBLIC_APP_URL is missing!');

export const logtoConfig: LogtoNextConfig = {
    endpoint: process.env.LOGTO_ENDPOINT || 'ERROR_MISSING_ENDPOINT',
    appId: process.env.LOGTO_APP_ID || 'ERROR_MISSING_APP_ID',
    appSecret: process.env.LOGTO_APP_SECRET || 'ERROR_MISSING_SECRET',
    baseUrl: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
    cookieSecret: process.env.LOGTO_COOKIE_SECRET || 'complex_password_at_least_32_characters_long',
    cookieSecure: process.env.NODE_ENV === 'production',
    scopes: [UserScope.Email, UserScope.Profile, UserScope.Roles],
};
