import { signIn, handleSignIn, signOut } from '@logto/next/server-actions';
import { NextRequest, NextResponse } from 'next/server';
import { logtoConfig } from '@/lib/auth/logto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const action = pathname.split('/').pop();

    try {
        if (action === 'sign-in') {
            return await signIn(logtoConfig, {
                redirectUri: `${logtoConfig.baseUrl}/api/auth/sign-in-callback`,
            });
        }

        if (action === 'sign-in-callback') {
            // O Proxy do Easypanel às vezes esconde o HTTPS.
            // Aqui nós garantimos que o SDK do Logto veja a URL correta com HTTPS.
            const url = new URL(request.url);
            if (logtoConfig.baseUrl.startsWith('https')) {
                url.protocol = 'https:';
                console.log('Processed Callback URL:', url.toString());
            }
            return await handleSignIn(logtoConfig, new URL(url.toString()));
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
