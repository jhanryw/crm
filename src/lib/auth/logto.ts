import { UserScope, LogtoNextConfig } from '@logto/next';

export const logtoConfig: LogtoNextConfig = {
    endpoint: (process.env.LOGTO_ENDPOINT || 'https://crm-logto.vodct5.easypanel.host/oidc'),
    appId: process.env.LOGTO_APP_ID || '8xqcwaa3648zgjk6hwbkr',
    appSecret: process.env.LOGTO_APP_SECRET || '8t5XBEK3K66WiYA3rPqdGL5Rc5kJrII8',
    baseUrl: (process.env.NEXT_PUBLIC_APP_URL || 'https://crm-crm.vodct5.easypanel.host').replace(/\/$/, ''),
    cookieSecret: process.env.LOGTO_COOKIE_SECRET || 'complex_password_at_least_32_characters_long_cookie_secret',
    cookieSecure: process.env.NODE_ENV === 'production',
    scopes: [UserScope.Email, UserScope.Profile, UserScope.Roles],
};
