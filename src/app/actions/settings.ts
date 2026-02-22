'use server';

import { createClient } from '@supabase/supabase-js';
import { getLogtoContext } from '@logto/next/server-actions';
import { logtoConfig } from '@/lib/auth/logto';
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// Using service key because RLS with Logto in server actions needs manual jwt passing if we use anon key, 
// but service key bypasses RLS. We'll verify auth manually.
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function requireAuth() {
    const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
    if (!isAuthenticated || !claims?.sub) {
        throw new Error("Unauthorized");
    }

    // Get user's org
    const { data: user } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('logto_id', claims.sub)
        .single();

    if (!user) throw new Error("User org not found");

    return { logtoId: claims.sub, orgId: user.organization_id, role: user.role };
}

// ORGANIZATIONS & INTEGRATIONS
export async function getIntegrations() {
    const { orgId } = await requireAuth();
    const { data } = await supabase.from('integrations').select('*').eq('organization_id', orgId);
    return data || [];
}

export async function connectWhatsApp() {
    const { orgId, role } = await requireAuth();
    if (role === 'salesperson') throw new Error("Unauthorized");

    // Stub: create a pending integration for whatsapp.
    // In a real scenario, this would trigger an Evolution API create instance endpoint to get the QR code.
    const { data, error } = await supabase
        .from('integrations')
        .upsert({ organization_id: orgId, channel: 'whatsapp', status: 'connecting', config: { qrCode: "simulated_qr_code" } }, { onConflict: 'organization_id, channel' })
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath('/settings');
    return data;
}

export async function connectInstagram(username: string, password: string) {
    const { orgId, role } = await requireAuth();
    if (role === 'salesperson') throw new Error("Unauthorized");

    // Stub: simulate connecting instagram
    const { data, error } = await supabase
        .from('integrations')
        .upsert({ organization_id: orgId, channel: 'instagram', status: 'connected', config: { username } }, { onConflict: 'organization_id, channel' })
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath('/settings');
    return data;
}

// ORIGINS
export async function getOrigins() {
    const { orgId } = await requireAuth();
    const { data } = await supabase.from('lead_origins').select('*').eq('organization_id', orgId);
    return data || [];
}

export async function addOrigin(name: string, regex: string) {
    const { orgId, role } = await requireAuth();
    if (role === 'salesperson') throw new Error("Unauthorized");

    const { error } = await supabase
        .from('lead_origins')
        .insert({ organization_id: orgId, name, auto_match_regex: regex });
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
