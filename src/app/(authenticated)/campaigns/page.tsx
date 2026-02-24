import { Megaphone } from 'lucide-react';

export default function CampaignsPage() {
    return (
        <div className="space-y-6 max-w-4xl">
            <header>
                <h2 className="text-3xl font-bold text-gray-900">Campanhas</h2>
                <p className="text-gray-500 text-sm mt-1">Gerencie suas campanhas de marketing</p>
            </header>

            <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: '#e8faf7' }}
                >
                    <Megaphone size={28} style={{ color: '#1fc2a9' }} />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2">Em breve</h3>
                <p className="text-gray-500 text-sm">Funcionalidade de campanhas em desenvolvimento.</p>
            </div>
        </div>
    );
}
