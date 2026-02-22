import { UserScope, LogtoNextConfig } from '@logto/next';

export const logtoConfig: LogtoNextConfig = {
    endpoint: (process.env.LOGTO_ENDPOINT || 'https://crm-logto.vodct5.easypanel.host/oidc').replace(/\/$/, ''),
    appId: '73jkkm3hsueix2pnh9i2z',
    appSecret: 'AT8OL96Cg1s96QljKJtYuwWH4jgWPKDn',
    baseUrl: (process.env.NEXT_PUBLIC_APP_URL || 'https://crm-crm.vodct5.easypanel.host').replace(/\/$/, ''),
    cookieSecret: process.env.LOGTO_COOKIE_SECRET || 'complex_password_at_least_32_characters_long_cookie_secret',
    cookieSecure: process.env.NODE_ENV === 'production',
    scopes: [UserScope.Email, UserScope.Profile],
};
