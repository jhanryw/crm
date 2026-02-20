const discoveryPath = '/oidc/.well-known/openid-configuration';

function appendPath(url, path) {
    // Simplified simulation of @silverhand/essentials appendPath
    // Usually it joins url.pathname and path
    const newUrl = new URL(url);
    if (newUrl.pathname.endsWith('/') && path.startsWith('/')) {
        newUrl.pathname += path.substring(1);
    } else if (!newUrl.pathname.endsWith('/') && !path.startsWith('/')) {
        newUrl.pathname += '/' + path;
    } else {
        newUrl.pathname += path;
    }
    return newUrl.toString();
}

const endpointRoot = 'https://crm-logto.vodct5.easypanel.host';
const endpointOidc = 'https://crm-logto.vodct5.easypanel.host/oidc';

console.log('Root + Discovery:', new URL(discoveryPath, endpointRoot).toString());
console.log('Oidc + Discovery:', new URL(discoveryPath, endpointOidc).toString());

// Native URL constructor behavior:
// If path starts with /, it replaces the pathname!
// new URL('/foo', 'http://a.com/bar') -> 'http://a.com/foo'
// THIS IS KEY!

console.log('--- Native URL Constructor ---');
console.log('Root:', new URL(discoveryPath, endpointRoot).toString());
console.log('Oidc:', new URL(discoveryPath, endpointOidc).toString());
