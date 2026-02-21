import { signIn, handleSignIn, signOut } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import { logtoConfig } from '@/lib/auth/logto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const action = pathname.split('/').pop();

    try {
        console.log('--- LOGTO AUTH ATTEMPT ---');
        console.log('Action:', action);
        console.log('Endpoint:', logtoConfig.endpoint);
        console.log('Base URL:', logtoConfig.baseUrl);
        console.log('Node Version:', process.version);
        console.log('NODE_OPTIONS:', process.env.NODE_OPTIONS);

        if (action === 'sign-in') {
            const redirectUri = `${logtoConfig.baseUrl}/api/auth/sign-in-callback`;
            console.log('Target Redirect URI:', redirectUri);

            await signIn(logtoConfig, {
                redirectUri,
            });
            return;
        }

        if (action === 'sign-in-callback') {
            console.log('Handling Callback URL:', request.url);

            // Força o uso de HTTPS no processamento do callback se o nosso baseUrl for HTTPS
            // Isso resolve o erro de mismatch causado pelo proxy reverso (Nginx)
            const callbackUrl = new URL(request.url);
            if (logtoConfig.baseUrl?.startsWith('https')) {
                callbackUrl.protocol = 'https:';
            }

            console.log('Processed Callback URL:', callbackUrl.toString());
            await handleSignIn(logtoConfig, callbackUrl);
            return;
        }

        if (action === 'sign-out') {
            await signOut(logtoConfig, `${logtoConfig.baseUrl}/`);
            return;
        }
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT' || error.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }

        console.error('--- LOGTO ERROR DETAILS ---');
        console.error('Message:', error.message);
        console.error('Received Endpoint:', logtoConfig.endpoint);
        console.error('Cause:', error.cause);
        if (error.cause) {
            console.error('Cause Details:', JSON.stringify(error.cause));
        }
        console.error('Stack:', error.stack);

        return NextResponse.json({
            error: 'Auth failed',
            details: error.message,
            cause: error.cause,
            debug: {
                endpoint: logtoConfig.endpoint,
                appId: logtoConfig.appId,
                redirectUri: `${logtoConfig.baseUrl}/api/auth/sign-in-callback`,
                baseUrl: logtoConfig.baseUrl
            },
            hint: 'Verify if the redirectUri above is EXACTLY the same as configured in Logto Admin Console',
        }, { status: 500 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
