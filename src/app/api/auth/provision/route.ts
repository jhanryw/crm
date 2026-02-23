import { getLogtoContext } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
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

export async function GET() {
    let authenticated = false;

    try {
        const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);

        if (!isAuthenticated || !claims?.sub) {
            // Not authenticated — will redirect to sign-in after try-catch
        } else {
            authenticated = true;
            const supabase = getSupabase();

            if (supabase) {
                const { data: existingUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('logto_id', claims.sub)
                    .maybeSingle();

                if (!existingUser) {
                    const email = (claims.email as string | undefined)
                        || `user-${claims.sub.slice(0, 8)}@app.local`;
                    const orgName = (claims.name as string | undefined)
                        || email.split('@')[0];

                    const { data: org, error: orgErr } = await supabase
                        .from('organizations')
                        .insert({ name: orgName })
                        .select('id')
                        .single();

                    if (!orgErr && org) {
                        await supabase.from('users').insert({
                            organization_id: org.id,
                            role: 'admin',
                            email,
                            logto_id: claims.sub,
                        });

                        await supabase.from('stages').insert(
                            DEFAULT_STAGES.map(s => ({ ...s, organization_id: org.id }))
                        );

                        console.log('[provision] New user provisioned:', org.id, claims.sub);
                    } else if (orgErr) {
                        console.error('[provision] Failed to create org:', orgErr.message);
                    }
                }
            } else {
                console.error('[provision] Supabase env vars not set');
            }
        }
    } catch (err: any) {
        console.error('[provision] Error:', err?.message);
    }

    // Redirects outside try-catch so Next.js NEXT_REDIRECT is never swallowed
    if (!authenticated) {
        redirect('/sign-in');
    }
    redirect('/dashboard');
}
