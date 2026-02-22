import { signIn, handleSignIn, signOut } from '@logto/next/server-actions';
import { NextRequest, NextResponse } from 'next/server';
import { logtoConfig } from '@/lib/auth/logto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const action = pathname.split('/').pop();

    try {
        if (action === 'sign-in') {
            console.log('Iniciando Sign-In com appId:', logtoConfig.appId);
            return await signIn(logtoConfig, {
                redirectUri: `${logtoConfig.baseUrl}/api/auth/sign-in-callback`,
            });
        }

        if (action === 'sign-in-callback') {
            const url = new URL(request.url);
            const callbackUrl = new URL(logtoConfig.baseUrl);
            callbackUrl.pathname = '/api/auth/sign-in-callback';
            callbackUrl.search = url.search;

            return await handleSignIn(logtoConfig, callbackUrl);
        }

        if (action === 'sign-out') {
            return await signOut(logtoConfig, `${logtoConfig.baseUrl}/`);
        }
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT' || error.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }

        console.error('Logto Auth Error:', error);
        return NextResponse.json({
            error: 'Auth failed',
            details: error.message,
        }, { status: 500 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
