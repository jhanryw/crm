'use client';

import { useState, useEffect, useRef } from 'react';
import { connectWhatsApp, getIntegrations, addOrigin, deleteOrigin } from '@/app/actions/settings';
import { CheckCircle, Wifi, WifiOff, Loader2, ExternalLink } from 'lucide-react';

/** Safely build a valid <img src> from raw base64 or an existing data URI */
function toImgSrc(raw: string | null | undefined): string | null {
    if (!raw) return null;
    if (raw.startsWith('data:')) return raw;
    return `data:image/png;base64,${raw}`;
}

interface Props {
    initialIntegrations: any[];
    initialOrigins: any[];
    instagramError?: string;
    instagramSuccess?: boolean;
}

export default function SettingsClient({ initialIntegrations, initialOrigins, instagramError, instagramSuccess }: Props) {
    const [origins, setOrigins] = useState(initialOrigins);
    const [integrations, setIntegrations] = useState(initialIntegrations);
    const [originName, setOriginName] = useState('');
    const [originRegex, setOriginRegex] = useState('');
    const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
    const [waError, setWaError] = useState('');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [originError, setOriginError] = useState('');
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const whatsappIntegration = integrations.find((i: any) => i.channel === 'whatsapp');
    const instagramIntegration = integrations.find((i: any) => i.channel === 'instagram');

    // Poll WhatsApp status while connecting
    useEffect(() => {
        if (whatsappIntegration?.status === 'connecting') {
            pollingRef.current = setInterval(async () => {
                const fresh = await getIntegrations();
                setIntegrations(fresh);
                const wa = fresh.find((i: any) => i.channel === 'whatsapp');
                if (wa?.status === 'connected') {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setQrCode(null);
                }
            }, 5000);
        } else {
            if (pollingRef.current) clearInterval(pollingRef.current);
        }
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [whatsappIntegration?.status]);

    const handleConnectWhatsapp = async () => {
        setLoadingWhatsapp(true);
        setWaError('');
        setQrCode(null);
        const result = await connectWhatsApp();
        if (!result.success) {
            setWaError(result.error);
        } else {
            setIntegrations(prev => [...prev.filter((i: any) => i.channel !== 'whatsapp'), result]);
            if (result.qrBase64) setQrCode(result.qrBase64);
        }
        setLoadingWhatsapp(false);
    };

    const handleAddOrigin = async (e: React.FormEvent) => {
        e.preventDefault();
        setOriginError('');
        const result = await addOrigin(originName, originRegex);
        if (!result.success) { setOriginError(result.error); return; }
        setOrigins((prev: any[]) => [...prev, { id: Date.now(), name: originName, auto_match_regex: originRegex || null }]);
        setOriginName('');
        setOriginRegex('');
    };

    const handleDeleteOrigin = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta origem?')) return;
        setOriginError('');
        const result = await deleteOrigin(id);
        if (!result.success) { setOriginError(result.error); return; }
        setOrigins((prev: any[]) => prev.filter(o => o.id !== id));
    };

    const statusBadge = (status?: string) => {
        if (status === 'connected') return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-700"><CheckCircle size={12} /> Conectado</span>;
        if (status === 'connecting') return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium bg-yellow-100 text-yellow-700"><Loader2 size={12} className="animate-spin" /> Aguardando QR</span>;
        return <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium bg-gray-100 text-gray-600"><WifiOff size={12} /> Desconectado</span>;
    };

    // QR src — handles raw base64 AND full data URIs from Evolution API
    const qrSrc = toImgSrc(qrCode ?? (whatsappIntegration?.status === 'connecting' ? whatsappIntegration?.config?.qrCode : null));

    return (
        <div className="space-y-12">
            {/* Integrações */}
            <section>
                <h3 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">Integrações (Canais)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* WhatsApp */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                                <span className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center font-bold text-sm">WA</span>
                                WhatsApp Web
                            </h4>
                            {statusBadge(whatsappIntegration?.status)}
                        </div>

                        <p className="text-sm text-gray-500">Conecte seu WhatsApp escaneando o QR Code — funciona como um dispositivo adicional (Evolution API).</p>

                        {/* QR Code — only rendered when src is valid */}
                        {qrSrc && (
                            <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <p className="text-xs text-gray-500 font-medium">Escaneie com o WhatsApp do seu celular</p>
                                <img
                                    src={qrSrc}
                                    alt="QR Code WhatsApp"
                                    className="w-48 h-48 rounded-lg"
                                    onError={(e) => {
                                        console.error('[QR] Falha ao renderizar. Prefixo:', qrSrc.slice(0, 50));
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                                <p className="text-xs text-gray-400">Aguardando conexão... <Loader2 size={11} className="inline animate-spin" /></p>
                            </div>
                        )}

                        {whatsappIntegration?.status === 'connected' && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                                <CheckCircle size={16} className="text-green-600" />
                                <p className="text-sm text-green-700 font-medium">WhatsApp conectado e recebendo mensagens</p>
                            </div>
                        )}

                        {waError && <p className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-200">{waError}</p>}

                        <button
                            disabled={loadingWhatsapp}
                            onClick={handleConnectWhatsapp}
                            className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loadingWhatsapp
                                ? <><Loader2 size={16} className="animate-spin" /> Gerando QR...</>
                                : whatsappIntegration?.status === 'connecting' ? 'Gerar Novo QR Code'
                                    : whatsappIntegration?.status === 'connected' ? <><Wifi size={16} /> Reconectar</>
                                        : 'Conectar WhatsApp'}
                        </button>
                    </div>

                    {/* Instagram — OAuth via Meta */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                                <span className="w-8 h-8 bg-pink-100 text-pink-600 rounded-lg flex items-center justify-center font-bold text-sm">IG</span>
                                Instagram DMs
                            </h4>
                            {statusBadge(instagramIntegration?.status)}
                        </div>

                        <p className="text-sm text-gray-500">
                            Conecte via login oficial do Meta. Requer conta <strong>Business ou Creator</strong> vinculada a uma Página do Facebook.
                        </p>

                        {instagramSuccess && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                                <CheckCircle size={16} className="text-green-600" />
                                <p className="text-sm text-green-700 font-medium">Instagram conectado com sucesso!</p>
                            </div>
                        )}

                        {instagramIntegration?.status === 'connected' && !instagramSuccess && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                                <CheckCircle size={16} className="text-green-600" />
                                <p className="text-sm text-green-700 font-medium">
                                    @{instagramIntegration.config?.username || 'conta'} conectado
                                </p>
                            </div>
                        )}

                        {instagramError && (
                            <p className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-200">
                                {decodeURIComponent(instagramError)}
                            </p>
                        )}

                        {/* Redirect to Meta OAuth — real Instagram website login */}
                        <a
                            href="/api/auth/instagram/connect"
                            className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-center"
                        >
                            <ExternalLink size={16} />
                            {instagramIntegration?.status === 'connected' ? 'Reconectar via Meta' : 'Conectar Instagram via Meta'}
                        </a>

                        <p className="text-xs text-gray-400 text-center">
                            Você será redirecionado para o site do Facebook/Instagram para autorizar.
                        </p>
                    </div>

                </div>
            </section>

            {/* Origens */}
            <section>
                <h3 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">Origens de Lead & Rastreamento</h3>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 mb-5">Configure origens para atribuição automática por regex.</p>
                    <form onSubmit={handleAddOrigin} className="flex gap-3 items-end mb-6 flex-wrap">
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Nome da Origem</label>
                            <input
                                required type="text" value={originName}
                                onChange={e => setOriginName(e.target.value)}
                                placeholder="Ex: Campanha Black Friday"
                                className="text-gray-800 w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Regex (Opcional)</label>
                            <input
                                type="text" value={originRegex}
                                onChange={e => setOriginRegex(e.target.value)}
                                placeholder="Ex: quero a promoção"
                                className="text-gray-800 w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm whitespace-nowrap">
                            + Adicionar
                        </button>
                    </form>

                    {originError && <p className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-200 mb-4">{originError}</p>}
                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="px-4 py-3">Nome</th>
                                    <th className="px-4 py-3">Regex Ativador</th>
                                    <th className="px-4 py-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {origins.map((o: any) => (
                                    <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800">{o.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.auto_match_regex || <span className="italic text-gray-300">—</span>}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => handleDeleteOrigin(o.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Excluir</button>
                                        </td>
                                    </tr>
                                ))}
                                {origins.length === 0 && (
                                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhuma origem cadastrada ainda.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
