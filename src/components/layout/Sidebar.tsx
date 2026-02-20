'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Inbox, Kanban, BarChart3, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
    user?: {
        name?: string | null;
        email?: string | null;
        sub?: string;
    }
}

export default function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();

    const navItems = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Inbox', href: '/inbox', icon: Inbox },
        { name: 'Kanban', href: '/kanban', icon: Kanban },
        { name: 'Campaigns', href: '/campaigns', icon: BarChart3 },
        { name: 'Settings', href: '/settings', icon: Settings },
    ];

    const isActive = (path: string) => pathname === path;

    return (
        <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-blue-400">Antigravity</h1>
                <p className="text-xs text-gray-400">CRM for Growth</p>
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${active
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto pt-4 border-t border-gray-800">
                {user && (
                    <div className="px-4 mb-4">
                        <p className="text-sm font-medium text-white truncate">{user.name || 'User'}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                )}

                <Link
                    href="/settings"
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition-colors ${isActive('/settings') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Configurações</span>
                </Link>

                <a
                    href="/api/auth/sign-out"
                    className="flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sair</span>
                </a>
            </div>
        </aside>
    );
}
