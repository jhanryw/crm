'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Inbox, Kanban, Megaphone, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
    user?: {
        name?: string | null;
        email?: string | null;
        sub?: string;
    }
}

const navItems = [
    { name: 'Dashboard',  href: '/dashboard',  icon: LayoutDashboard },
    { name: 'Inbox',      href: '/inbox',       icon: Inbox },
    { name: 'Pipeline',   href: '/kanban',      icon: Kanban },
    { name: 'Campanhas',  href: '/campaigns',   icon: Megaphone },
];

const settingsItem = { name: 'Configurações', href: '/settings', icon: Settings };

function getInitials(name?: string | null) {
    if (!name) return 'Q';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside
            className="w-64 flex-shrink-0 flex flex-col h-screen"
            style={{ background: '#111111', borderRight: '1px solid #1e1e1e' }}
        >
            {/* Logo */}
            <div className="px-5 py-6 flex items-center gap-3">
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: '#1fc2a9', color: '#111111' }}
                >
                    Q
                </div>
                <div>
                    <p className="text-white font-bold text-base leading-tight">Qarvon</p>
                    <p className="text-xs leading-tight" style={{ color: '#6b7280' }}>CRM</p>
                </div>
            </div>

            {/* Seção principal */}
            <div className="px-3 mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest px-3 mb-2" style={{ color: '#444' }}>
                    Menu
                </p>
                <nav className="space-y-0.5">
                    {navItems.map(item => {
                        const active = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium"
                                style={active
                                    ? { background: '#1fc2a9', color: '#111111' }
                                    : { color: '#a3a3a3' }
                                }
                                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#1c1c1c'; (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'; }}
                                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#a3a3a3'; } }}
                            >
                                <item.icon className="w-4 h-4 flex-shrink-0" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Seção configurações */}
            <div className="px-3 mt-2">
                <p className="text-xs font-semibold uppercase tracking-widest px-3 mb-2" style={{ color: '#444' }}>
                    Sistema
                </p>
                <Link
                    href={settingsItem.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium"
                    style={pathname.startsWith(settingsItem.href)
                        ? { background: '#1fc2a9', color: '#111111' }
                        : { color: '#a3a3a3' }
                    }
                    onMouseEnter={e => { if (!pathname.startsWith(settingsItem.href)) { (e.currentTarget as HTMLAnchorElement).style.background = '#1c1c1c'; (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'; } }}
                    onMouseLeave={e => { if (!pathname.startsWith(settingsItem.href)) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#a3a3a3'; } }}
                >
                    <settingsItem.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{settingsItem.name}</span>
                </Link>
            </div>

            {/* Footer — usuário */}
            <div className="mt-auto px-3 pb-5">
                <div className="h-px mx-3 mb-4" style={{ background: '#1e1e1e' }} />

                <div className="flex items-center gap-3 px-3 mb-2">
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: '#222', color: '#1fc2a9', border: '1px solid #2a2a2a' }}
                    >
                        {getInitials(user?.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{user?.name || 'Usuário'}</p>
                        <p className="text-xs truncate" style={{ color: '#555' }}>{user?.email || ''}</p>
                    </div>
                </div>

                <button
                    onClick={() => import('@/app/actions/auth').then(m => m.signOutAction())}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium mt-1"
                    style={{ color: '#666' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#666'; }}
                >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    <span>Sair</span>
                </button>
            </div>
        </aside>
    );
}
