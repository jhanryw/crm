import { createClient } from '@supabase/supabase-js';
import { getLogtoContext } from '@logto/next/server-actions';
import { logtoConfig } from '@/lib/auth/logto';
import { getConversations } from '@/app/actions/inbox';
import InboxClient from './InboxClient';

async function getOrgId(): Promise<string | null> {
    try {
        const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
        if (!isAuthenticated || !claims?.sub) return null;

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: user } = await supabase
            .from('users')
            .select('organization_id')
            .eq('logto_id', claims.sub)
            .single();

        return user?.organization_id || null;
    } catch {
        return null;
    }
}

export default async function InboxPage() {
    const [conversations, orgId] = await Promise.all([
        getConversations(),
        getOrgId(),
    ]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-800">Inbox</h2>
                <span className="text-sm text-gray-500">WhatsApp + Instagram unificados</span>
            </div>
            <InboxClient initialConversations={conversations} orgId={orgId || ''} />
        </div>
    );
}
