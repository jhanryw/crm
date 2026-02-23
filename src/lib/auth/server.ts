import { getLogtoContext } from '@logto/next/server-actions';
import { logtoConfig } from './logto';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_STAGES = [
    { name: 'Novo Lead', order_index: 0, probability: 10 },
    { name: 'Qualificado', order_index: 1, probability: 30 },
    { name: 'Proposta', order_index: 2, probability: 50 },
    { name: 'Negociação', order_index: 3, probability: 70 },
    { name: 'Fechado Ganho', order_index: 4, probability: 100 },
    { name: 'Fechado Perdido', order_index: 5, probability: 0 },
];

export function getServiceSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase não configurado. Adicione NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no EasyPanel.');
    return createClient(url, key);
}

export async function requireAuth() {
    const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
    if (!isAuthenticated || !claims?.sub) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const supabase = getServiceSupabase();

    // Try to find existing user
    const { data: existingUser } = await supabase
        .from('users')
        .select('id, organization_id, role')
        .eq('logto_id', claims.sub)
        .maybeSingle();

    if (existingUser) {
        return {
            logtoId: claims.sub,
            orgId: existingUser.organization_id,
            role: existingUser.role as string,
            userId: existingUser.id,
        };
    }

    // First time — auto-provision org + user + stages
    const email = (claims.email as string | undefined) || `user-${claims.sub.slice(0, 8)}@app.local`;
    const orgName = (claims.name as string | undefined) || email.split('@')[0];

    const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: orgName })
        .select('id')
        .single();

    if (orgErr || !org) {
        throw new Error(`Erro ao criar organização: ${orgErr?.message ?? 'desconhecido'}`);
    }

    const { data: newUser, error: userErr } = await supabase
        .from('users')
        .insert({ organization_id: org.id, role: 'admin', email, logto_id: claims.sub })
        .select('id, organization_id, role')
        .single();

    if (userErr || !newUser) {
        throw new Error(`Erro ao criar usuário: ${userErr?.message ?? 'desconhecido'}`);
    }

    // Create default pipeline stages
    await supabase
        .from('stages')
        .insert(DEFAULT_STAGES.map(s => ({ ...s, organization_id: org.id })));

    console.log('[requireAuth] User auto-provisioned:', org.id, claims.sub);

    return {
        logtoId: claims.sub,
        orgId: newUser.organization_id,
        role: newUser.role as string,
        userId: newUser.id,
    };
}
