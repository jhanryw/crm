import { getLogtoContext } from '@logto/next/server-actions';
import { logtoConfig } from '@/lib/auth/logto';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';

export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);

    if (!isAuthenticated) {
        redirect('/sign-in');
    }

    return (
        <div className="flex h-screen" style={{ background: '#f5f6f8' }}>
            <Sidebar user={claims} />
            <main className="flex-1 overflow-y-auto p-8">
                {children}
            </main>
        </div>
    );
}
