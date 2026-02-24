'use client';

import { useState, useEffect, useRef } from 'react';
import { connectWhatsApp, syncWhatsAppStatus, importWhatsAppChats, getIntegrations, addOrigin, deleteOrigin } from '@/app/actions/settings';
import { CheckCircle, Wifi, WifiOff, Loader2, ExternalLink, RefreshCw, Trash2, Download } from 'lucide-react';

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

function PrimaryBtn({ onClick, disabled, children, className = '' }: {
    onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center justify-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 text-white ${className}`}
            style={{ background: '#1fc2a9' }}
            onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#107c65'; }}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#1fc2a9'}
        >
            {children}
        </button>
    );
}

function StatusBadge({ status }: { status?: string }) {
    if (status === 'connected')
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-semibold" style={{ background: '#e8faf7', color: '#107c65' }}><CheckCircle size={12} /> Conectado</span>;
    if (status === 'connecting')
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-semibold bg-amber-50 text-amber-600"><Loader2 size={12} className="animate-spin" /> Aguardando QR</span>;
    return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-semibold bg-gray-100 text-gray-500"><WifiOff size={12} /> Desconectado</span>;
}

export default function SettingsClient({ initialIntegrations, initialOrigins, instagramError, instagramSuccess }: Props) {
    const [origins, setOrigins] = useState(initialOrigins);
    const [integrations, setIntegrations] = useState(initialIntegrations);
    const [originName, setOriginName] = useState('');
    const [originRegex, setOriginRegex] = useState('');
    const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
    const [syncingWhatsapp, setSyncingWhatsapp] = useState(false);
    const [importingChats, setImportingChats] = useState(false);
    const [waError, setWaError] = useState('');
    const [waSuccess, setWaSuccess] = useState('');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [originError, setOriginError] = useState('');
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const whatsappIntegration = integrations.find((i: any) => i.channel === 'whatsapp');
    const instagramIntegration = integrations.find((i: any) => i.channel === 'instagram');

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
        setLoadingWhatsapp(true); setWaError(''); setWaSuccess(''); setQrCode(null);
        const result = await connectWhatsApp();
        if (!result.success) { setWaError(result.error); }
        else {
            setIntegrations(prev => [...prev.filter((i: any) => i.channel !== 'whatsapp'), result]);
            if (result.alreadyConnected) setWaSuccess('WhatsApp já estava conectado — status atualizado!');
            else if (result.qrBase64) setQrCode(result.qrBase64);
        }
        setLoadingWhatsapp(false);
    };

    const handleSyncWhatsapp = async () => {
        setSyncingWhatsapp(true); setWaError(''); setWaSuccess('');
        const result = await syncWhatsAppStatus();
        if (!result.success) { setWaError(result.error); }
        else {
            setWaSuccess(
                result.status === 'connected' ? '✅ Status sincronizado: Conectado!' :
                result.status === 'disconnected' ? 'Status: Desconectado' : 'Status: Aguardando QR'
            );
            const fresh = await getIntegrations();
            setIntegrations(fresh);
            if (result.status === 'connected') setQrCode(null);
        }
        setSyncingWhatsapp(false);
    };

    const handleImportChats = async () => {
        setImportingChats(true); setWaError(''); setWaSuccess('');
        const result = await importWhatsAppChats();
        if (!result.success) {
            setWaError(result.error);
        } else {
            const { imported, skipped, errors } = result;
            setWaSuccess(
                imported === 0
                    ? `Nenhuma conversa nova encontrada (${skipped} já existiam).`
                    : `✅ ${imported} conversa${imported > 1 ? 's' : ''} importada${imported > 1 ? 's' : ''}!${skipped > 0 ? ` (${skipped} já existiam)` : ''}${errors > 0 ? ` • ${errors} erro(s)` : ''}`
            );
        }
        setImportingChats(false);
    };

    const handleAddOrigin = async (e: React.FormEvent) => {
        e.preventDefault(); setOriginError('');
        const result = await addOrigin(originName, originRegex);
        if (!result.success) { setOriginError(result.error); return; }
        setOrigins(prev => [...prev, { id: Date.now(), name: originName, auto_match_regex: originRegex || null }]);
        setOriginName(''); setOriginRegex('');
    };

    const handleDeleteOrigin = async (id: string) => {
        if (!confirm('Excluir esta origem?')) return;
        setOriginError('');
        const result = await deleteOrigin(id);
        if (!result.success) { setOriginError(result.error); return; }
        setOrigins(prev => prev.filter(o => o.id !== id));
    };

    const qrSrc = toImgSrc(qrCode ?? (whatsappIntegration?.status === 'connecting' ? whatsappIntegration?.config?.qrCode : null));
    const inputClass = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white transition-colors outline-none";

    return (
        <div className="space-y-10 max-w-4xl">

            {/* Integrações */}
            <section>
                <h3 className="text-lg font-bold text-gray-800 mb-4">Integrações (Canais)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {/* WhatsApp */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-gray-800 flex items-center gap-2.5">
                                <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: '#e8faf7', color: '#107c65' }}>WA</span>
                                WhatsApp
                            </h4>
                            <StatusBadge status={whatsappIntegration?.status} />
                        </div>

                        <p className="text-sm text-gray-500">Conecte via Evolution API escaneando o QR Code.</p>

                        {qrSrc && (
                            <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-xs text-gray-500">Escaneie com o WhatsApp do seu celular</p>
                                <img
                                    src={qrSrc} alt="QR Code"
                                    className="w-48 h-48 rounded-lg"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                    <Loader2 size={11} className="animate-spin" /> Aguardando conexão...
                                </p>
                            </div>
                        )}

                        {whatsappIntegration?.status === 'connected' && (
                            <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ background: '#e8faf7', borderColor: '#b2ece3' }}>
                                <CheckCircle size={15} style={{ color: '#107c65' }} />
                                <p className="text-sm font-medium" style={{ color: '#107c65' }}>WhatsApp conectado e recebendo mensagens</p>
                            </div>
                        )}

                        {waSuccess && <p className="text-sm px-3 py-2 rounded-xl border font-medium" style={{ color: '#107c65', background: '#e8faf7', borderColor: '#b2ece3' }}>{waSuccess}</p>}
                        {waError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">{waError}</p>}

                        <PrimaryBtn onClick={handleConnectWhatsapp} disabled={loadingWhatsapp} className="w-full">
                            {loadingWhatsapp ? <><Loader2 size={15} className="animate-spin" /> Verificando...</> :
                                whatsappIntegration?.status === 'connecting' ? 'Gerar Novo QR Code' :
                                whatsappIntegration?.status === 'connected' ? <><Wifi size={15} /> Reconectar</> :
                                'Conectar WhatsApp'}
                        </PrimaryBtn>

                        <button
                            disabled={syncingWhatsapp}
                            onClick={handleSyncWhatsapp}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors disabled:opacity-50"
                        >
                            {syncingWhatsapp ? <><Loader2 size={14} className="animate-spin" /> Sincronizando...</> : <><RefreshCw size={14} /> Sincronizar Status</>}
                        </button>

                        <button
                            disabled={importingChats}
                            onClick={handleImportChats}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors disabled:opacity-50"
                        >
                            {importingChats
                                ? <><Loader2 size={14} className="animate-spin" /> Importando conversas...</>
                                : <><Download size={14} /> Importar Todas as Conversas</>}
                        </button>
                    </div>

                    {/* Instagram */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-gray-800 flex items-center gap-2.5">
                                <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm bg-pink-50 text-pink-600">IG</span>
                                Instagram DMs
                            </h4>
                            <StatusBadge status={instagramIntegration?.status} />
                        </div>

                        <p className="text-sm text-gray-500">
                            Login oficial via Meta. Requer conta <strong>Business ou Creator</strong> vinculada a uma Página do Facebook.
                        </p>

                        {instagramSuccess && (
                            <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ background: '#e8faf7', borderColor: '#b2ece3' }}>
                                <CheckCircle size={15} style={{ color: '#107c65' }} />
                                <p className="text-sm font-medium" style={{ color: '#107c65' }}>Instagram conectado com sucesso!</p>
                            </div>
                        )}

                        {instagramIntegration?.status === 'connected' && !instagramSuccess && (
                            <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ background: '#e8faf7', borderColor: '#b2ece3' }}>
                                <CheckCircle size={15} style={{ color: '#107c65' }} />
                                <p className="text-sm font-medium" style={{ color: '#107c65' }}>
                                    @{instagramIntegration.config?.username || 'conta'} conectado
                                </p>
                            </div>
                        )}

                        {instagramError && (
                            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">
                                {decodeURIComponent(instagramError)}
                            </p>
                        )}

                        <a
                            href="/api/auth/instagram/connect"
                            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white text-center flex items-center justify-center gap-2 transition-all"
                            style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88'}
                            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
                        >
                            <ExternalLink size={15} />
                            {instagramIntegration?.status === 'connected' ? 'Reconectar via Meta' : 'Conectar via Meta'}
                        </a>
                        <p className="text-xs text-gray-400 text-center">Você será redirecionado para o Facebook/Instagram.</p>
                    </div>
                </div>
            </section>

            {/* Origens de Lead */}
            <section>
                <h3 className="text-lg font-bold text-gray-800 mb-4">Origens de Lead</h3>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-5">Configure origens com regex para atribuição automática.</p>

                    <form onSubmit={handleAddOrigin} className="flex gap-3 items-end mb-6 flex-wrap">
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Nome</label>
                            <input
                                required type="text" value={originName}
                                onChange={e => setOriginName(e.target.value)}
                                placeholder="Ex: Campanha Black Friday"
                                className={inputClass}
                                onFocus={e => (e.target.style.borderColor = '#1fc2a9')}
                                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                            />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Regex (opcional)</label>
                            <input
                                type="text" value={originRegex}
                                onChange={e => setOriginRegex(e.target.value)}
                                placeholder="Ex: quero a promoção"
                                className={`${inputClass} font-mono`}
                                onFocus={e => (e.target.style.borderColor = '#1fc2a9')}
                                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                            />
                        </div>
                        <PrimaryBtn className="whitespace-nowrap px-5">+ Adicionar</PrimaryBtn>
                    </form>

                    {originError && (
                        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100 mb-4">{originError}</p>
                    )}

                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead style={{ background: '#f8f9fb' }}>
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Regex</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {origins.map((o: any) => (
                                    <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800">{o.name}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.auto_match_regex || <span className="italic text-gray-300">—</span>}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDeleteOrigin(o.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {origins.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-10 text-center text-gray-400 text-sm">Nenhuma origem cadastrada ainda.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
