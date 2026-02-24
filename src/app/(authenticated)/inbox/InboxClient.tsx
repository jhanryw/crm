'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { approveConversationAsLead, archiveConversation, sendMessage, getMessages } from '@/app/actions/inbox';
import { Send, MessageSquare, Instagram, Phone, RefreshCw, Check, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
    initialConversations: any[];
    orgId: string;
}

function formatContactDisplay(contactId: string): string {
    if (!contactId) return 'Contato desconhecido';
    if (/^\d{10,15}$/.test(contactId)) {
        const d = contactId;
        if (d.startsWith('55') && d.length === 13)
            return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
        if (d.startsWith('55') && d.length === 12)
            return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
        return `+${d}`;
    }
    return contactId;
}

function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ChannelBadge({ channel }: { channel: string }) {
    if (channel === 'whatsapp') {
        return (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#e8faf7', color: '#107c65' }}>
                WhatsApp
            </span>
        );
    }
    return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700">
            Instagram
        </span>
    );
}

export default function InboxClient({ initialConversations, orgId }: Props) {
    const [tab, setTab] = useState<'pending' | 'active'>('pending');
    const [conversations, setConversations] = useState<any[]>(initialConversations);
    const [selectedConv, setSelectedConv] = useState<any | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [approving, setApproving] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const supabase = createClient();

    const showToast = (type: 'success' | 'error', message: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ type, message });
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    };

    const filteredConvs = conversations.filter(c => c.status === tab);
    const pendingCount = conversations.filter(c => c.status === 'pending').length;

    // Realtime
    useEffect(() => {
        const channel = supabase
            .channel('inbox-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
                if (payload.new.conversation_id === selectedConv?.id) {
                    setMessages(prev => [...prev, payload.new]);
                }
                setConversations(prev =>
                    prev.map(c => c.id === payload.new.conversation_id ? { ...c, updated_at: payload.new.created_at } : c)
                );
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inbox_conversations' }, (payload: any) => {
                setConversations(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [selectedConv?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!orgId) return;
        const hasInstagram = conversations.some(c => c.channel === 'instagram');
        if (!hasInstagram) return;
        const sync = () => fetch(`/api/instagram/sync?orgId=${orgId}`).catch(() => null);
        sync();
        const interval = setInterval(sync, 60000);
        return () => clearInterval(interval);
    }, [orgId]);

    const handleSelectConv = async (conv: any) => {
        setSelectedConv(conv);
        setMessages([]);
        setLoadingMessages(true);
        try {
            setMessages(await getMessages(conv.id));
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || !selectedConv || sending) return;
        const text = inputText.trim();
        setInputText('');
        setSending(true);
        const optimistic = { id: `opt-${Date.now()}`, body: text, direction: 'out', created_at: new Date().toISOString() };
        setMessages(prev => [...prev, optimistic]);
        try {
            await sendMessage(selectedConv.id, text);
        } catch (err: any) {
            showToast('error', `Erro ao enviar: ${err.message}`);
            setMessages(prev => prev.filter(m => m.id !== optimistic.id));
            setInputText(text);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleApprove = async () => {
        if (!selectedConv || approving) return;
        setApproving(true);
        try {
            await approveConversationAsLead(selectedConv.id);
            setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, status: 'active' } : c));
            const approvedConv = { ...selectedConv, status: 'active' };
            showToast('success', 'Lead criado no Pipeline com sucesso!');
            // Switch to Ativas tab and keep conversation selected
            setTimeout(() => {
                setTab('active');
                setSelectedConv(approvedConv);
            }, 800);
        } catch (e: any) {
            showToast('error', e.message || 'Erro ao aprovar conversa');
        } finally {
            setApproving(false);
        }
    };

    const handleArchive = async () => {
        if (!selectedConv) return;
        try {
            await archiveConversation(selectedConv.id);
            setConversations(prev => prev.filter(c => c.id !== selectedConv.id));
            setSelectedConv(null);
            showToast('success', 'Conversa arquivada.');
        } catch (e: any) {
            showToast('error', e.message || 'Erro ao arquivar');
        }
    };

    const handleManualSync = async () => {
        if (!orgId || syncing) return;
        setSyncing(true);
        try {
            const res = await fetch(`/api/instagram/sync?orgId=${orgId}`);
            const data = await res.json();
            if (data.synced > 0) window.location.reload();
        } finally { setSyncing(false); }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* ── Coluna de conversas ── */}
            <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-100" style={{ background: '#fafafa' }}>
                {/* Tabs */}
                <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setTab('pending'); setSelectedConv(null); }}
                            className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all"
                            style={tab === 'pending'
                                ? { background: '#1fc2a9', color: '#111' }
                                : { background: 'transparent', color: '#6b7280' }
                            }
                        >
                            Pendentes
                            {pendingCount > 0 && (
                                <span
                                    className="ml-1.5 text-xs rounded-full px-1.5 py-0.5"
                                    style={tab === 'pending'
                                        ? { background: 'rgba(0,0,0,0.15)', color: '#111' }
                                        : { background: '#e8faf7', color: '#107c65' }
                                    }
                                >
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setTab('active'); setSelectedConv(null); }}
                            className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all"
                            style={tab === 'active'
                                ? { background: '#1fc2a9', color: '#111' }
                                : { background: 'transparent', color: '#6b7280' }
                            }
                        >
                            Ativas
                        </button>
                        <button
                            onClick={handleManualSync}
                            disabled={syncing}
                            title="Sincronizar"
                            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto">
                    {filteredConvs
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                        .map(c => {
                            const isSelected = selectedConv?.id === c.id;
                            return (
                                <div
                                    key={c.id}
                                    onClick={() => handleSelectConv(c)}
                                    className="px-4 py-3.5 border-b border-gray-100 cursor-pointer transition-all"
                                    style={isSelected
                                        ? { background: '#e8faf7', borderLeft: '3px solid #1fc2a9' }
                                        : { borderLeft: '3px solid transparent' }
                                    }
                                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#f0f0f0'; }}
                                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                                >
                                    <div className="flex justify-between items-center mb-1.5">
                                        <ChannelBadge channel={c.channel} />
                                        <span className="text-xs text-gray-400">{formatTime(c.updated_at)}</span>
                                    </div>
                                    <h4 className="font-semibold text-gray-800 text-sm truncate">{formatContactDisplay(c.contact_id)}</h4>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                        {c.lead_origins?.name || 'Origem desconhecida'}
                                    </p>
                                </div>
                            );
                        })}
                    {filteredConvs.length === 0 && (
                        <div className="p-8 text-center">
                            <MessageSquare size={28} className="mx-auto mb-2 text-gray-200" />
                            <p className="text-gray-400 text-sm">Nenhuma conversa {tab === 'pending' ? 'pendente' : 'ativa'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Área de chat ── */}
            <div className="flex-1 flex flex-col bg-white min-w-0 relative">
                {/* Toast notification */}
                {toast && (
                    <div
                        className="absolute top-4 left-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2"
                        style={{
                            transform: 'translateX(-50%)',
                            background: toast.type === 'success' ? '#e8faf7' : '#fef2f2',
                            color: toast.type === 'success' ? '#107c65' : '#b91c1c',
                            border: `1px solid ${toast.type === 'success' ? '#1fc2a9' : '#fca5a5'}`,
                        }}
                    >
                        {toast.type === 'success'
                            ? <CheckCircle2 size={15} />
                            : <AlertCircle size={15} />}
                        {toast.message}
                    </div>
                )}
                {selectedConv ? (
                    <>
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0 bg-white">
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: '#e8faf7' }}
                                >
                                    {selectedConv.channel === 'instagram'
                                        ? <Instagram size={17} className="text-pink-500" />
                                        : <Phone size={17} style={{ color: '#1fc2a9' }} />}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-800 truncate">{formatContactDisplay(selectedConv.contact_id)}</h3>
                                    <p className="text-xs text-gray-500">{selectedConv.lead_origins?.name || 'Origem desconhecida'}</p>
                                </div>
                            </div>
                            {tab === 'pending' && (
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={handleArchive}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                                    >
                                        Arquivar
                                    </button>
                                    <button
                                        onClick={handleApprove}
                                        disabled={approving}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 text-white disabled:opacity-60"
                                        style={{ background: '#1fc2a9' }}
                                        onMouseEnter={e => { if (!approving) (e.currentTarget as HTMLButtonElement).style.background = '#107c65'; }}
                                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#1fc2a9'}
                                    >
                                        {approving
                                            ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Criando...</>
                                            : <><Check size={13} /> Aprovar → Pipeline</>
                                        }
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mensagens */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ background: '#f8f9fb' }}>
                            {loadingMessages ? (
                                <div className="text-center text-gray-400 text-sm py-8">Carregando mensagens...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-8">
                                    <MessageSquare size={32} className="mx-auto mb-2 text-gray-200" />
                                    Nenhuma mensagem ainda
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={msg.id || i} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className="max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm"
                                            style={msg.direction === 'out'
                                                ? { background: '#1fc2a9', color: '#fff', borderBottomRightRadius: '4px' }
                                                : { background: '#ffffff', color: '#111', border: '1px solid #e5e7eb', borderBottomLeftRadius: '4px' }
                                            }
                                        >
                                            <p className="break-words">{msg.body}</p>
                                            <p className="text-xs mt-1" style={msg.direction === 'out' ? { color: 'rgba(255,255,255,0.65)' } : { color: '#9ca3af' }}>
                                                {formatTime(msg.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-white border-t border-gray-100 flex gap-2 flex-shrink-0">
                            <input
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Digite uma resposta... (Enter para enviar)"
                                disabled={sending}
                                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none disabled:opacity-50 transition-colors"
                                style={{ outline: 'none' }}
                                onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#1fc2a9'}
                                onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputText.trim() || sending}
                                className="px-4 py-2.5 rounded-xl disabled:opacity-40 transition-all flex items-center gap-2 text-white"
                                style={{ background: '#1fc2a9' }}
                                onMouseEnter={e => { if (inputText.trim() && !sending) (e.currentTarget as HTMLButtonElement).style.background = '#107c65'; }}
                                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#1fc2a9'}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col gap-3">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#e8faf7' }}>
                            <MessageSquare size={28} style={{ color: '#1fc2a9' }} />
                        </div>
                        <p className="font-semibold text-gray-700">Selecione uma conversa</p>
                        <p className="text-sm text-gray-400">WhatsApp e Instagram unificados</p>
                    </div>
                )}
            </div>
        </div>
    );
}
