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
    return createClient(url, key, {
        auth: { persistSession: false },
    });
}

function fmtErr(e: any): string {
    if (!e) return 'sem erro retornado';
    return e.message || e.details || e.hint || e.code || JSON.stringify(e);
}

export async function requireAuth() {
    const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
    if (!isAuthenticated || !claims?.sub) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const supabase = getServiceSupabase();

    // Try to find existing user — also capture lookup errors
    const { data: existingUser, error: lookupErr } = await supabase
        .from('users')
        .select('id, organization_id, role')
        .eq('logto_id', claims.sub)
        .maybeSingle();

    if (lookupErr) {
        console.error('[requireAuth] Erro ao buscar usuário no banco:', fmtErr(lookupErr));
        throw new Error(`Erro ao buscar usuário: ${fmtErr(lookupErr)}`);
    }

    if (existingUser) {
        return {
            logtoId: claims.sub,
            orgId: existingUser.organization_id,
            role: existingUser.role as string,
            userId: existingUser.id,
        };
    }

    // ── First time: auto-provision org + user + stages ──────────────────────
    const email = (claims.email as string | undefined) || `user-${claims.sub.slice(0, 8)}@app.local`;
    const orgName = (claims.name as string | undefined) || email.split('@')[0];

    // Generate UUIDs in JS so we never depend on .select().single() after insert
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // 1. Create organization
    const { error: orgErr } = await supabase
        .from('organizations')
        .insert({ id: orgId, name: orgName });

    if (orgErr) {
        console.error('[requireAuth] Erro ao criar organização:', fmtErr(orgErr), orgErr);
        throw new Error(`Erro ao criar organização: ${fmtErr(orgErr)}`);
    }

    // 2. Create user
    const { error: userErr } = await supabase
        .from('users')
        .insert({ id: userId, organization_id: orgId, role: 'admin', email, logto_id: claims.sub });

    if (userErr) {
        console.error('[requireAuth] Erro ao criar usuário:', fmtErr(userErr), userErr);
        throw new Error(`Erro ao criar usuário: ${fmtErr(userErr)}`);
    }

    // 3. Create default pipeline stages (best-effort — don't fail if this errors)
    const { error: stagesErr } = await supabase
        .from('stages')
        .insert(DEFAULT_STAGES.map(s => ({ ...s, organization_id: orgId })));

    if (stagesErr) {
        console.warn('[requireAuth] Aviso: erro ao criar estágios padrão:', fmtErr(stagesErr));
    }

    console.log('[requireAuth] Usuário auto-provisionado:', orgId, claims.sub);

    return {
        logtoId: claims.sub,
        orgId,
        role: 'admin',
        userId,
    };
}
