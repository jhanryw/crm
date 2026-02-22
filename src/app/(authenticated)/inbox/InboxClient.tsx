'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { approveConversationAsLead, archiveConversation, sendMessage, getMessages } from '@/app/actions/inbox';
import { Send, MessageSquare, Instagram, Phone, RefreshCw } from 'lucide-react';

interface Props {
    initialConversations: any[];
    orgId: string;
}

function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ChannelIcon({ channel }: { channel: string }) {
    if (channel === 'whatsapp') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">WhatsApp</span>;
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">Instagram</span>;
}

export default function InboxClient({ initialConversations, orgId }: Props) {
    const [tab, setTab] = useState<'pending' | 'active'>('pending');
    const [conversations, setConversations] = useState<any[]>(initialConversations);
    const [selectedConv, setSelectedConv] = useState<any | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    const filteredConvs = conversations.filter(c => c.status === tab);

    // Supabase Realtime — novas mensagens entram em tempo real
    useEffect(() => {
        const channel = supabase
            .channel('inbox-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload: any) => {
                    if (payload.new.conversation_id === selectedConv?.id) {
                        setMessages(prev => [...prev, payload.new]);
                    }
                    // Atualizar updated_at da conversa na lista
                    setConversations(prev =>
                        prev.map(c => c.id === payload.new.conversation_id
                            ? { ...c, updated_at: payload.new.created_at }
                            : c
                        )
                    );
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'inbox_conversations' },
                (payload: any) => {
                    setConversations(prev =>
                        prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c)
                    );
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedConv?.id]);

    // Scroll automático para última mensagem
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Sync Instagram ao abrir inbox (se houver integração)
    useEffect(() => {
        if (!orgId) return;
        const hasInstagram = conversations.some(c => c.channel === 'instagram');
        if (!hasInstagram) return;

        const syncInstagram = () => {
            fetch(`/api/instagram/sync?orgId=${orgId}`).catch(() => null);
        };

        syncInstagram();
        const interval = setInterval(syncInstagram, 60000);
        return () => clearInterval(interval);
    }, [orgId]);

    const handleSelectConv = async (conv: any) => {
        setSelectedConv(conv);
        setMessages([]);
        setLoadingMessages(true);
        try {
            const msgs = await getMessages(conv.id);
            setMessages(msgs);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || !selectedConv || sending) return;
        const text = inputText.trim();
        setInputText('');
        setSending(true);

        // Adicionar mensagem otimisticamente
        const optimistic = { id: `opt-${Date.now()}`, body: text, direction: 'out', created_at: new Date().toISOString() };
        setMessages(prev => [...prev, optimistic]);

        try {
            await sendMessage(selectedConv.id, text);
        } catch (err: any) {
            alert(`Erro ao enviar: ${err.message}`);
            // Remover mensagem otimista em caso de erro
            setMessages(prev => prev.filter(m => m.id !== optimistic.id));
            setInputText(text);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleApprove = async () => {
        if (!selectedConv) return;
        try {
            await approveConversationAsLead(selectedConv.id);
            setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, status: 'active' } : c));
            setSelectedConv((prev: any) => prev ? { ...prev, status: 'active' } : null);
            alert("Lead criado no Pipeline!");
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleArchive = async () => {
        if (!selectedConv) return;
        try {
            await archiveConversation(selectedConv.id);
            setConversations(prev => prev.filter(c => c.id !== selectedConv.id));
            setSelectedConv(null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleManualSync = async () => {
        if (!orgId || syncing) return;
        setSyncing(true);
        try {
            const res = await fetch(`/api/instagram/sync?orgId=${orgId}`);
            const data = await res.json();
            if (data.synced > 0) {
                window.location.reload();
            }
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Sidebar de Conversas */}
            <div className="w-80 border-r border-gray-100 bg-gray-50 flex flex-col flex-shrink-0">
                {/* Tabs */}
                <div className="flex p-3 border-b border-gray-200 gap-2 items-center">
                    <button
                        onClick={() => { setTab('pending'); setSelectedConv(null); }}
                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-white shadow-sm border border-blue-400 text-blue-700' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                        Pendentes {filteredConvs.length > 0 && tab === 'pending' && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5">{filteredConvs.length}</span>}
                    </button>
                    <button
                        onClick={() => { setTab('active'); setSelectedConv(null); }}
                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white shadow-sm border border-blue-400 text-blue-700' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                        Ativas
                    </button>
                    <button
                        onClick={handleManualSync}
                        disabled={syncing}
                        title="Sincronizar Instagram"
                        className="p-1.5 rounded-md hover:bg-gray-200 text-gray-400 disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Lista de conversas */}
                <div className="flex-1 overflow-y-auto">
                    {filteredConvs
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                        .map(c => (
                            <div
                                key={c.id}
                                onClick={() => handleSelectConv(c)}
                                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${selectedConv?.id === c.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-100'}`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <ChannelIcon channel={c.channel} />
                                    <span className="text-xs text-gray-400">{formatTime(c.updated_at)}</span>
                                </div>
                                <h4 className="font-semibold text-gray-800 text-sm mt-1 truncate">{c.contact_id}</h4>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {c.lead_origins?.name || 'Origem desconhecida'}
                                </p>
                            </div>
                        ))}
                    {filteredConvs.length === 0 && (
                        <p className="p-6 text-center text-gray-400 text-sm">Nenhuma conversa {tab === 'pending' ? 'pendente' : 'ativa'}.</p>
                    )}
                </div>
            </div>

            {/* Área de chat */}
            <div className="flex-1 flex flex-col bg-white min-w-0">
                {selectedConv ? (
                    <>
                        {/* Header da conversa */}
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    {selectedConv.channel === 'instagram'
                                        ? <Instagram size={18} className="text-pink-600" />
                                        : <Phone size={18} className="text-green-600" />}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-800 truncate">{selectedConv.contact_id}</h3>
                                    <p className="text-xs text-gray-500">{selectedConv.lead_origins?.name || 'Origem desconhecida'}</p>
                                </div>
                            </div>
                            {tab === 'pending' && (
                                <div className="flex gap-2 flex-shrink-0">
                                    <button onClick={handleArchive} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium">
                                        Arquivar
                                    </button>
                                    <button onClick={handleApprove} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
                                        Aprovar → Pipeline
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mensagens */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                            {loadingMessages ? (
                                <div className="text-center text-gray-400 text-sm py-8">Carregando mensagens...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-8">
                                    <MessageSquare size={32} className="mx-auto mb-2 text-gray-300" />
                                    Nenhuma mensagem ainda
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={msg.id || i} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.direction === 'out'
                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'}`}>
                                            <p className="break-words">{msg.body}</p>
                                            <p className={`text-xs mt-1 ${msg.direction === 'out' ? 'text-blue-200' : 'text-gray-400'}`}>
                                                {formatTime(msg.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input de mensagem */}
                        <div className="p-4 bg-white border-t border-gray-100 flex gap-2 flex-shrink-0">
                            <input
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Digite uma resposta... (Enter para enviar)"
                                disabled={sending}
                                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputText.trim() || sending}
                                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col text-gray-400 gap-3">
                        <MessageSquare size={48} className="text-gray-200" />
                        <p className="text-gray-500 font-medium">Selecione uma conversa</p>
                        <p className="text-sm text-gray-400">WhatsApp e Instagram unificados</p>
                    </div>
                )}
            </div>
        </div>
    );
}
