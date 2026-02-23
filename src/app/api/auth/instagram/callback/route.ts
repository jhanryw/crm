import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import { requireAuth, getServiceSupabase } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const errorParam = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description');

    if (errorParam || !code) {
        const msg = errorDesc || errorParam || 'Acesso negado pelo usuário';
        redirect(`/settings?instagram_error=${encodeURIComponent(msg)}`);
    }

    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

    try {
        // 1. Exchange code → short-lived user access token
        const tokenRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?` +
            new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: callbackUrl, code }),
        );
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            throw new Error(tokenData.error?.message || 'Falha ao obter access token do Meta');
        }
        const shortToken: string = tokenData.access_token;

        // 2. Exchange for long-lived token (valid 60 days)
        const longRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?` +
            new URLSearchParams({
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: shortToken,
            }),
        );
        const longData = await longRes.json();
        const accessToken: string = longData.access_token || shortToken;

        // 3. Get Pages + linked Instagram Business Account
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?` +
            new URLSearchParams({
                fields: 'id,name,access_token,instagram_business_account{id,username,name}',
                access_token: accessToken,
            }),
        );
        const pagesData = await pagesRes.json();
        const pages: any[] = pagesData.data || [];

        // Find first page with a linked Instagram Business Account
        const pageWithIg = pages.find((p: any) => p.instagram_business_account);
        const igAccount = pageWithIg?.instagram_business_account;
        const pageAccessToken = pageWithIg?.access_token || accessToken;

        const username = igAccount?.username || igAccount?.name || 'conta instagram';
        const igAccountId = igAccount?.id || null;

        // 4. Save to integrations table
        const { orgId } = await requireAuth();
        const { error: upsertErr } = await getServiceSupabase()
            .from('integrations')
            .upsert(
                {
                    organization_id: orgId,
                    channel: 'instagram',
                    status: 'connected',
                    config: {
                        username,
                        ig_account_id: igAccountId,
                        page_access_token: pageAccessToken,
                        user_access_token: accessToken,
                    },
                },
                { onConflict: 'organization_id, channel' },
            );

        if (upsertErr) throw new Error(`Erro ao salvar: ${upsertErr.message}`);

        revalidatePath('/settings');
        console.log('[Instagram OAuth] Conectado:', username, igAccountId);
    } catch (err: any) {
        console.error('[Instagram OAuth callback]', err?.message);
        redirect(`/settings?instagram_error=${encodeURIComponent(err?.message || 'Erro desconhecido')}`);
    }

    redirect('/settings?instagram_success=1');
}
