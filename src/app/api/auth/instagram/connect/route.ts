import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
    const appId = process.env.META_APP_ID;
    if (!appId) {
        redirect('/settings?instagram_error=META_APP_ID+n%C3%A3o+configurado.+Adicione+no+EasyPanel.');
    }

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

    const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: callbackUrl,
        scope: [
            'instagram_basic',
            'instagram_manage_messages',
            'pages_show_list',
            'pages_read_engagement',
        ].join(','),
        response_type: 'code',
        state: 'instagram_connect',
    });

    redirect(`https://www.facebook.com/dialog/oauth?${params}`);
}
