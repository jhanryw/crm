import { UserScope, LogtoNextConfig } from '@logto/next';

export const logtoConfig: LogtoNextConfig = {
    endpoint: (process.env.LOGTO_ENDPOINT || '').replace(/\/oidc$/, ''),
    appId: process.env.LOGTO_APP_ID || '',
    appSecret: process.env.LOGTO_APP_SECRET || '',
    baseUrl: (process.env.NEXT_PUBLIC_APP_URL || 'https://crm-crm.vodct5.easypanel.host/').replace(/\/$/, ''),
    cookieSecret: process.env.LOGTO_COOKIE_SECRET || 'complex_password_at_least_32_characters_long_cookie_secret',
    cookieSecure: process.env.NODE_ENV === 'production',
    scopes: [UserScope.Email, UserScope.Profile, UserScope.Roles],
};
