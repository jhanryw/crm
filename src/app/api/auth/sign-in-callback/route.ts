import { handleSignIn } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { logtoConfig } from '@/lib/auth/logto';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const callbackUrl = new URL(logtoConfig.baseUrl);
    callbackUrl.pathname = '/api/auth/sign-in-callback';
    callbackUrl.search = url.search;

    await handleSignIn(logtoConfig, callbackUrl);

    redirect('/dashboard');
}