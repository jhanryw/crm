import { signIn, handleSignIn, signOut } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import { logtoConfig } from '@/lib/auth/logto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const action = pathname.split('/').pop();

    try {
        if (action === 'sign-in') {
            console.log('Logto Config Check:', {
                endpoint: logtoConfig.endpoint,
                appId: logtoConfig.appId,
                baseUrl: logtoConfig.baseUrl,
                cookieSecure: logtoConfig.cookieSecure,
                hasSecret: !!logtoConfig.appSecret,
                hasCookieSecret: !!logtoConfig.cookieSecret
            });
            console.log('SignIn Redirect URI:', `${logtoConfig.baseUrl}/api/auth/sign-in-callback`);

            await signIn(logtoConfig, {
                redirectUri: `${logtoConfig.baseUrl}/api/auth/sign-in-callback`,
            });
            return;
        }

        if (action === 'sign-in-callback') {
            console.log('Handling Callback URL:', request.url);
            await handleSignIn(logtoConfig, new URL(request.url));
            return; // handleSignIn redirects internally
        }

        if (action === 'sign-out') {
            await signOut(logtoConfig, `${logtoConfig.baseUrl}/`);
            return;
        }
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT' || error.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }

        console.error('Logto Auth Error Full:', error);
        return NextResponse.json({
            error: 'Auth failed',
            details: error.message,
            stack: error.stack,
        }, { status: 500 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
