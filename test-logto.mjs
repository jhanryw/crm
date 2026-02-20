const endpoint = 'https://crm-logto.vodct5.easypanel.host/oidc';
const oidcUrl = `${endpoint}/.well-known/openid-configuration`;
const appId = 'im6ttdhnsb50k091d7g2a';
const appSecret = 'WRONG_SECRET';
const base64Credentials = btoa(`${appId}:${appSecret}`);

console.log('Fetching OIDC config from:', oidcUrl);
console.log('Using Basic Auth (WRONG):', base64Credentials);

async function test() {
    try {
        const res = await fetch(oidcUrl, {
            headers: {
                Authorization: `Basic ${base64Credentials}`
            }
        });
        console.log('Status:', res.status);
        if (!res.ok) {
            console.error('Failed request:', await res.text());
            return;
        }
        const data = await res.json();
        console.log('Issuer:', data.issuer);
        console.log('Authorization Endpoint:', data.authorization_endpoint);
        console.log('Token Endpoint:', data.token_endpoint);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

test();
