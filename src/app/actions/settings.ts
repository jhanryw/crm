'use server';

import { createClient } from '@supabase/supabase-js';
import { getLogtoContext } from '@logto/next/server-actions';
import { logtoConfig } from '@/lib/auth/logto';
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

async function requireAuth() {
    const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
    if (!isAuthenticated || !claims?.sub) {
        throw new Error("Unauthorized");
    }

    const { data: user } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('logto_id', claims.sub)
        .single();

    if (!user) throw new Error("User org not found");

    return { logtoId: claims.sub, orgId: user.organization_id, role: user.role };
}

// INTEGRATIONS
export async function getIntegrations() {
    const { orgId } = await requireAuth();
    const { data } = await supabase.from('integrations').select('*').eq('organization_id', orgId);
    return data || [];
}

export async function connectWhatsApp() {
    const { orgId, role } = await requireAuth();
    if (role === 'salesperson') throw new Error("Unauthorized");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        throw new Error("Evolution API não configurada. Adicione EVOLUTION_API_URL e EVOLUTION_API_KEY no .env.");
    }

    const instanceName = `qarvon-${orgId.slice(0, 8)}`;

    // 1. Criar instância (ignora erro se já existir)
    await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    }).catch(() => null);

    // 2. Obter QR code
    const qrRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
        headers: { 'apikey': EVOLUTION_API_KEY },
    });

    if (!qrRes.ok) {
        throw new Error(`Evolution API erro ao gerar QR: ${qrRes.status}`);
    }

    const qrData = await qrRes.json();
    // Evolution API v2 retorna { code: "base64..." } ou { qrcode: { base64: "..." } }
    const qrBase64 = qrData.base64 || qrData.qrcode?.base64 || qrData.code || null;

    const { data, error } = await supabase
        .from('integrations')
        .upsert(
            { organization_id: orgId, channel: 'whatsapp', status: 'connecting', config: { instanceName, qrCode: qrBase64 } },
            { onConflict: 'organization_id, channel' }
        )
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath('/settings');
    return { ...data, qrBase64 };
}

export async function connectInstagram(username: string, password: string) {
    const { orgId, role } = await requireAuth();
    if (role === 'salesperson') throw new Error("Unauthorized");
    if (!username || !password) throw new Error("Usuário e senha são obrigatórios");

    let sessionData: string | null = null;

    try {
        // Importação dinâmica para evitar problemas de SSR
        const { IgApiClient } = await import('instagram-private-api');
        const ig = new IgApiClient();
        ig.state.generateDevice(username);
        await ig.account.login(username, password);
        const serialized = await ig.state.serialize();
        // Remover cookies de mídia que podem ser muito grandes
        delete serialized.constants;
        sessionData = JSON.stringify(serialized);
    } catch (err: any) {
        const msg = err?.message || 'Erro desconhecido';
        if (msg.includes('challenge')) {
            throw new Error("Instagram solicitou verificação (2FA/challenge). Desative o 2FA ou use uma conta sem verificação em duas etapas.");
        }
        if (msg.includes('Bad Password') || msg.includes('password')) {
            throw new Error("Usuário ou senha incorretos.");
        }
        throw new Error(`Erro ao conectar Instagram: ${msg}`);
    }

    const { data, error } = await supabase
        .from('integrations')
        .upsert(
            { organization_id: orgId, channel: 'instagram', status: 'connected', config: { username, session: sessionData } },
            { onConflict: 'organization_id, channel' }
        )
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath('/settings');
    return data;
}

// ORIGINS
export async function getOrigins() {
    const { orgId } = await requireAuth();
    const { data } = await supabase.from('lead_origins').select('*').eq('organization_id', orgId).order('created_at', { ascending: true });
    return data || [];
}

export async function addOrigin(name: string, regex: string) {
    const { orgId, role } = await requireAuth();
    if (role === 'salesperson') throw new Error("Unauthorized");

    const { error } = await supabase
        .from('lead_origins')
        .insert({ organization_id: orgId, name, auto_match_regex: regex || null });
    if (error) throw new Error(error.message);
    revalidatePath('/settings');
}

export async function deleteOrigin(id: string) {
    const { orgId, role } = await requireAuth();
    if (role === 'salesperson') throw new Error("Unauthorized");

    const { error } = await supabase
        .from('lead_origins')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId);
    if (error) throw new Error(error.message);
    revalidatePath('/settings');
}
