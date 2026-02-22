import LogtoClient from '@logto/node';

const config = {
    endpoint: 'https://crm-logto.vodct5.easypanel.host/oidc',
    appId: '73jkkm3hsueix2pnh9i2z',
    appSecret: 'AT8OL96Cg1s96QljKJtYuwWH4jgWPKDn',
    baseUrl: 'http://localhost:3000',
    cookieSecret: 'complex_password_at_least_32_characters_long_cookie_secret',
};

async function test() {
    try {
        const SessionStorage = class { };
        const client = new LogtoClient(config, {
            navigate: (url) => { console.log('navigatin to', url); },
            storage: {
                setItem: (key, value) => { console.log('set', key); },
                getItem: (key) => null,
                removeItem: (key) => { }
            }
        });
        await client.signIn({ redirectUri: 'http://localhost:3000/callback' });
    } catch (err) {
        console.error("error!", err);
    }
}
test();
