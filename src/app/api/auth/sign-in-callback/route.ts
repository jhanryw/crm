import { handleSignIn, getLogtoContext } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { logtoConfig } from '@/lib/auth/logto';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

const DEFAULT_STAGES = [
    { name: 'Novo Lead', order_index: 0, probability: 10 },
    { name: 'Qualificado', order_index: 1, probability: 30 },
    { name: 'Proposta', order_index: 2, probability: 50 },
    { name: 'Negociação', order_index: 3, probability: 70 },
    { name: 'Fechado Ganho', order_index: 4, probability: 100 },
    { name: 'Fechado Perdido', order_index: 5, probability: 0 },
];

async function provisionUser() {
    try {
        const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
        if (!isAuthenticated || !claims?.sub) return;

        const supabase = getSupabase();
        if (!supabase) return;

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('logto_id', claims.sub)
            .maybeSingle();

        if (existingUser) return; // already provisioned

        // First login — create organization + user + default stages
        const email = (claims.email as string | undefined) || `user-${claims.sub.slice(0, 8)}@app.local`;
        const orgName = (claims.name as string | undefined) || email.split('@')[0];

        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .insert({ name: orgName })
            .select('id')
            .single();

        if (orgErr || !org) {
            console.error('[provisionUser] Failed to create org:', orgErr?.message);
            return;
        }

        // Create user as admin
        const { error: userErr } = await supabase
            .from('users')
            .insert({
                organization_id: org.id,
                role: 'admin',
                email,
                logto_id: claims.sub,
            });

        if (userErr) {
            console.error('[provisionUser] Failed to create user:', userErr.message);
            return;
        }

        // Create default pipeline stages
        await supabase
            .from('stages')
            .insert(DEFAULT_STAGES.map(s => ({ ...s, organization_id: org.id })));

        console.log('[provisionUser] New user provisioned:', { orgId: org.id, logtoId: claims.sub });
    } catch (err: any) {
        // Never block login if provisioning fails
        console.error('[provisionUser] Unexpected error:', err?.message);
    }
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const callbackUrl = new URL(logtoConfig.baseUrl);
    callbackUrl.pathname = '/api/auth/sign-in-callback';
    callbackUrl.search = url.search;

    await handleSignIn(logtoConfig, callbackUrl);
    await provisionUser();

    redirect('/dashboard');
}
