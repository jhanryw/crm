import { createClient } from '@supabase/supabase-js';
import { getLogtoContext } from '@logto/next/server-actions';
import { logtoConfig } from '@/lib/auth/logto';
import KanbanBoard from '@/components/kanban/KanbanBoard';

async function getUserId(): Promise<string | null> {
    try {
        const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
        if (!isAuthenticated || !claims?.sub) return null;

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('logto_id', claims.sub)
            .single();

        return user?.id || null;
    } catch {
        return null;
    }
}

export default async function KanbanPage() {
    const userId = await getUserId();

    return (
        <div className="h-full flex flex-col">
            <header className="mb-6 flex justify-between items-center px-1">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Pipeline</h2>
                    <p className="text-gray-500 text-sm">Gerencie seus leads e negociações</p>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                <KanbanBoard userId={userId || ''} />
            </div>
        </div>
    );
}
