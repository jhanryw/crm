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
            // Reconstruímos a URL de callback usando o nosso baseUrl oficial.
            // Isso evita erros de mismatch causados por proxies (Nginx) que podem
            // alterar o host ou o protocolo da requisição interna.
            const url = new URL(request.url);
            const callbackUrl = new URL(`${logtoConfig.baseUrl}/api/auth/sign-in-callback${url.search}`);

            console.log('Reconstructed Callback URL:', callbackUrl.toString());
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
