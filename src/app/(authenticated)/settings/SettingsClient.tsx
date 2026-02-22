'use client';

import { useState } from 'react';
import { connectWhatsApp, connectInstagram, addOrigin, deleteOrigin } from '@/app/actions/settings';

export default function SettingsClient({ initialIntegrations, initialOrigins }: { initialIntegrations: any[], initialOrigins: any[] }) {
    const [origins, setOrigins] = useState(initialOrigins);
    const [integrations, setIntegrations] = useState(initialIntegrations);

    // Origin Form
    const [originName, setOriginName] = useState('');
    const [originRegex, setOriginRegex] = useState('');

    const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);

    // Instagram Login Form
    const [showIgLogin, setShowIgLogin] = useState(false);
    const [igUser, setIgUser] = useState('');
    const [igPass, setIgPass] = useState('');

    const handleConnectWhatsapp = async () => {
        setLoadingWhatsapp(true);
        try {
            const up = await connectWhatsApp();
            const wpIntegrationIndex = integrations.findIndex(i => i.channel === 'whatsapp');
            if (wpIntegrationIndex > -1) {
                const newInts = [...integrations];
                newInts[wpIntegrationIndex] = up;
                setIntegrations(newInts);
            } else {
                setIntegrations([...integrations, up]);
            }
            alert("WhatsApp Web iniciado! Leia o QRCode logado no console (Simulação MVP).");
        } catch (e: any) {
            alert(e.message);
        }
        setLoadingWhatsapp(false);
    };

    const handleConnectInstagram = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const up = await connectInstagram(igUser, igPass);
            const igIntegrationIndex = integrations.findIndex(i => i.channel === 'instagram');
            if (igIntegrationIndex > -1) {
                const newInts = [...integrations];
                newInts[igIntegrationIndex] = up;
                setIntegrations(newInts);
            } else {
                setIntegrations([...integrations, up]);
            }
            setShowIgLogin(false);
            alert("Instagram Conectado! (Simulação MVP)");
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleAddOrigin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addOrigin(originName, originRegex);
            setOriginName('');
            setOriginRegex('');
            window.location.reload(); // Simplest way to refresh since state sync without Server Action return is tricky here
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDeleteOrigin = async (id: string) => {
        if (!confirm('Tem certeza?')) return;
        try {
            await deleteOrigin(id);
            setOrigins(origins.filter(o => o.id !== id));
        } catch (e: any) {
            alert(e.message);
        }
    };

    const whatsappIntegration = integrations.find(i => i.channel === 'whatsapp');
    const instagramIntegration = integrations.find(i => i.channel === 'instagram');

    return (
        <div className="space-y-12">

            {/* Integrações */}
            <section>
                <h3 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">Integrações (Canais)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* WhatsApp */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="w-8 h-8 bg-green-100 text-green-600 rounded flex items-center justify-center">W</span>
                                    WhatsApp Web
                                </h4>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${whatsappIntegration?.status === 'connected' ? 'bg-green-100 text-green-700' :
                                        whatsappIntegration?.status === 'connecting' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {whatsappIntegration?.status === 'connecting' && 'Aguardando QRCode'}
                                    {whatsappIntegration?.status === 'connected' && 'Conectado'}
                                    {!whatsappIntegration?.status && 'Desconectado'}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mb-6">Conecte seu WhatsApp lendo o QR Code como um dispositivo adicional.</p>
                        </div>
                        <button
                            disabled={loadingWhatsapp}
                            onClick={handleConnectWhatsapp}
                            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loadingWhatsapp ? "Iniciando..." :
                                whatsappIntegration?.status === 'connecting' ? "Gerar QR Code Novamente" :
                                    "Conectar WhatsApp"}
                        </button>
                    </div>

                    {/* Instagram */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="w-8 h-8 bg-pink-100 text-pink-600 rounded flex items-center justify-center">IG</span>
                                    Instagram DMs
                                </h4>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${instagramIntegration?.status === 'connected' ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                    {instagramIntegration?.status === 'connected' ? 'Conectado' : 'Desconectado'}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mb-6">Entre com login e senha da sua conta comercial ou criador para gerenciar DMs.</p>
                        </div>

                        {showIgLogin ? (
                            <form onSubmit={handleConnectInstagram} className="space-y-3">
                                <input type="text" placeholder="Username" required value={igUser} onChange={e => setIgUser(e.target.value)} className="w-full text-black px-3 py-2 border rounded-lg focus:ring-blue-500" />
                                <input type="password" placeholder="Password" required value={igPass} onChange={e => setIgPass(e.target.value)} className="w-full text-black px-3 py-2 border rounded-lg focus:ring-blue-500" />
                                <div className="flex gap-2">
                                    <button type="submit" className="flex-1 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors">Entrar</button>
                                    <button type="button" onClick={() => setShowIgLogin(false)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg">Voltar</button>
                                </div>
                            </form>
                        ) : (
                            <button
                                onClick={() => setShowIgLogin(true)}
                                className="w-full py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Conectar Instagram
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* Origens */}
            <section>
                <h3 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">Origens de Lead & Rastreamento Automático</h3>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <form onSubmit={handleAddOrigin} className="flex gap-4 items-end mb-6">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Origem</label>
                            <input required type="text" value={originName} onChange={e => setOriginName(e.target.value)} placeholder="Ex: Campanha Black Friday IG" className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Regex de Captura de Primeira Mensagem (Opcional)</label>
                            <input type="text" value={originRegex} onChange={e => setOriginRegex(e.target.value)} placeholder="Ex: .*quero a promoção.*" className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 h-[42px]">Adicionar</button>
                    </form>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-700 uppercase">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Nome da Origem</th>
                                    <th className="px-4 py-3">Regex Ativador</th>
                                    <th className="px-4 py-3 rounded-tr-lg text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {origins.map((o) => (
                                    <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900">{o.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{o.auto_match_regex || '-'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => handleDeleteOrigin(o.id)} className="text-red-500 hover:text-red-700 font-medium text-xs">Excluir</button>
                                        </td>
                                    </tr>
                                ))}
                                {origins.length === 0 && (
                                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">Nenhuma origem cadastrada.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
