'use client';

import { useState } from 'react';
import { approveConversationAsLead, archiveConversation, sendMessage } from '@/app/actions/inbox';

export default function InboxClient({ initialConversations }: { initialConversations: any[] }) {
    const [tab, setTab] = useState<'pending' | 'active'>('pending');
    const [selectedConv, setSelectedConv] = useState<any | null>(null);
    const [activeTabConvs, setActiveTabConvs] = useState<any[]>(initialConversations.filter(c => c.status === tab));

    // Switch tabs dynamically
    const handleTabChange = (newTab: 'pending' | 'active') => {
        setTab(newTab);
        setActiveTabConvs(initialConversations.filter(c => c.status === newTab));
        setSelectedConv(null);
    };

    const handleApprove = async () => {
        if (!selectedConv) return;
        try {
            await approveConversationAsLead(selectedConv.id);
            alert("Aprovado! Lead criado no CRM e movido para Active e Kanban.");
            window.location.reload();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleArchive = async () => {
        if (!selectedConv) return;
        try {
            await archiveConversation(selectedConv.id);
            window.location.reload();
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Sidebar de Conversas */}
            <div className="w-1/3 border-r border-gray-100 bg-gray-50 flex flex-col">
                <div className="flex p-4 border-b border-gray-200 gap-2">
                    <button
                        onClick={() => handleTabChange('pending')}
                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-white shadow-sm border border-blue-500 text-blue-700' : 'bg-transparent text-gray-500 hover:bg-gray-200'}`}
                    >
                        Pendentes
                    </button>
                    <button
                        onClick={() => handleTabChange('active')}
                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white shadow-sm border border-blue-500 text-blue-700' : 'bg-transparent text-gray-500 hover:bg-gray-200'}`}
                    >
                        Ativas
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {activeTabConvs.map(c => (
                        <div
                            key={c.id}
                            onClick={() => setSelectedConv(c)}
                            className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${selectedConv?.id === c.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-100'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-pink-100 text-pink-700'}`}>
                                    {c.channel}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {new Date(c.updated_at).toLocaleDateString()}
                                </span>
                            </div>
                            <h4 className="font-semibold text-gray-800">{c.contact_id}</h4>
                            <p className="text-sm text-gray-500 truncate">
                                Origem: {c.lead_origins?.name || 'Desconhecida'}
                            </p>
                        </div>
                    ))}
                    {activeTabConvs.length === 0 && (
                        <p className="p-4 text-center text-gray-500 text-sm mt-4">Nenhuma conversa encontrada.</p>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedConv ? (
                    <>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{selectedConv.contact_id}</h3>
                                <p className="text-sm text-gray-500 capitalize">{selectedConv.channel} • {selectedConv.lead_origins?.name || 'Origem Desconhecida'}</p>
                            </div>
                            <div className="flex gap-2">
                                {tab === 'pending' && (
                                    <>
                                        <button onClick={handleArchive} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors">Rejeitar / Arquivar</button>
                                        <button onClick={handleApprove} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Validar Lead (Kanban)</button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30 flex flex-col justify-end">
                            <div className="text-center">
                                <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Selecione para abrir o histórico de mensagens</span>
                                <div className="mt-4 p-4 bg-white border border-gray-200 rounded-2xl max-w-sm mx-auto shadow-sm text-sm text-gray-600">
                                    Simulação de chat para o canal <strong>{selectedConv.channel}</strong>.
                                    (Mensagens do webhook aparecem aqui).
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
                            <input type="text" placeholder="Digite uma resposta..." className="flex-1 text-black px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">Enviar</button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col text-gray-400">
                        <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                        <p>Selecione uma conversa na lateral</p>
                    </div>
                )}
            </div>
        </div>
    );
}
