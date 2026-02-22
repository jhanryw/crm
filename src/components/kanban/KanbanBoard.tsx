'use client';

import React, { useEffect, useState, useRef } from 'react';
import { X, Plus, Phone, User } from 'lucide-react';
import { getStages, getLeads, updateLeadStage, createLead, Stage, Lead } from '@/lib/api/kanban';
import LeadDetailPanel from './LeadDetailPanel';

interface Props {
    userId: string;
}

function timeAgo(dateStr?: string) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

function channelColor(source?: string) {
    if (!source) return '';
    if (source.toLowerCase().includes('whatsapp')) return 'bg-green-100 text-green-700';
    if (source.toLowerCase().includes('instagram')) return 'bg-pink-100 text-pink-700';
    if (source.toLowerCase() === 'manual') return 'bg-gray-100 text-gray-600';
    return 'bg-blue-100 text-blue-700';
}

export default function KanbanBoard({ userId }: Props) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

    // Modal novo lead
    const [showModal, setShowModal] = useState(false);
    const [modalStageId, setModalStageId] = useState('');
    const [form, setForm] = useState({ contact_name: '', contact_phone: '', value: '' });
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        async function fetchData() {
            try {
                const [stagesData, leadsData] = await Promise.all([getStages(), getLeads()]);
                setStages(stagesData);
                setLeads(leadsData);
                if (stagesData.length > 0) setModalStageId(stagesData[0].id);
            } catch (error) {
                console.error("Erro ao carregar Kanban:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const onDragStart = (e: React.DragEvent, leadId: string) => {
        setDraggingLeadId(leadId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", leadId);
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const onDrop = async (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault();
        if (!draggingLeadId) return;

        const lead = leads.find(l => l.id === draggingLeadId);
        if (!lead || lead.stage_id === targetStageId) return;

        const oldStageId = lead.stage_id;
        setLeads(prev => prev.map(l => l.id === draggingLeadId ? { ...l, stage_id: targetStageId } : l));

        try {
            await updateLeadStage(draggingLeadId, targetStageId, oldStageId, userId);
        } catch (error) {
            console.error("Erro ao mover lead:", error);
            setLeads(prev => prev.map(l => l.id === draggingLeadId ? { ...l, stage_id: oldStageId } : l));
        } finally {
            setDraggingLeadId(null);
        }
    };

    const openNewLeadModal = (stageId?: string) => {
        setModalStageId(stageId || stages[0]?.id || '');
        setForm({ contact_name: '', contact_phone: '', value: '' });
        setFormError('');
        setShowModal(true);
    };

    const handleCreateLead = async () => {
        if (!form.contact_name.trim()) { setFormError('Nome do contato é obrigatório'); return; }
        if (!modalStageId) { setFormError('Selecione um estágio'); return; }
        setCreating(true);
        setFormError('');
        try {
            const newLead = await createLead({
                contact_name: form.contact_name.trim(),
                contact_phone: form.contact_phone.trim() || undefined,
                value: parseFloat(form.value.replace(',', '.')) || 0,
                stage_id: modalStageId,
                userId,
            });
            setLeads(prev => [newLead, ...prev]);
            setShowModal(false);
        } catch (err: any) {
            setFormError(err.message || 'Erro ao criar lead');
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando pipeline...</div>;
    }

    return (
        <>
            {/* Botão Novo Lead flutuante */}
            <div className="flex justify-end mb-4 px-1">
                <button
                    onClick={() => openNewLeadModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm shadow-blue-200"
                >
                    <Plus size={16} /> Novo Lead
                </button>
            </div>

            <div className="flex h-full space-x-4 overflow-x-auto pb-4">
                {stages.map(stage => {
                    const stageLeads = leads.filter(l => l.stage_id === stage.id);
                    const totalValue = stageLeads.reduce((s, l) => s + (l.value || 0), 0);

                    return (
                        <div
                            key={stage.id}
                            className="w-80 flex-shrink-0 bg-gray-100/50 rounded-xl flex flex-col border border-gray-200"
                            onDragOver={onDragOver}
                            onDrop={(e) => onDrop(e, stage.id)}
                        >
                            {/* Cabeçalho da coluna */}
                            <div className="p-4 border-b border-gray-200 bg-white/50 rounded-t-xl backdrop-blur-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="font-semibold text-gray-700">{stage.name}</h3>
                                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                        {stageLeads.length}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mb-2">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                                </p>
                                <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all"
                                        style={{ width: `${stage.order_index > 0 ? Math.min(100, (stage.order_index / stages.length) * 100) : 10}%` }}
                                    />
                                </div>
                            </div>

                            {/* Cards */}
                            <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                                {stageLeads.map(lead => (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, lead.id)}
                                        onClick={() => setSelectedLeadId(lead.id)}
                                        className={`bg-white p-4 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all ${draggingLeadId === lead.id ? 'opacity-40 scale-95' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <User size={13} className="text-gray-400 flex-shrink-0" />
                                                <span className="text-sm font-medium text-gray-800 truncate">{lead.contact_name || 'Lead sem nome'}</span>
                                            </div>
                                            <span className="text-xs font-bold text-green-600 ml-2 flex-shrink-0">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value || 0)}
                                            </span>
                                        </div>
                                        {lead.contact_phone && (
                                            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                                <Phone size={11} className="text-gray-400" />
                                                <span>{lead.contact_phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between mt-2">
                                            {lead.source && (
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${channelColor(lead.source)}`}>
                                                    {lead.source}
                                                </span>
                                            )}
                                            {lead.created_at && (
                                                <span className="text-xs text-gray-400 ml-auto">{timeAgo(lead.created_at)}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {stageLeads.length === 0 && (
                                    <div
                                        onClick={() => openNewLeadModal(stage.id)}
                                        className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
                                    >
                                        <Plus size={16} className="mx-auto mb-1" />
                                        Adicionar lead
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Novo Lead */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-gray-800">Novo Lead</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato *</label>
                                <input
                                    type="text"
                                    value={form.contact_name}
                                    onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
                                    placeholder="Ex: João Silva"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                <input
                                    type="text"
                                    value={form.contact_phone}
                                    onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))}
                                    placeholder="Ex: 5511999999999"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                                <input
                                    type="number"
                                    value={form.value}
                                    onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                                    placeholder="0,00"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estágio *</label>
                                <select
                                    value={modalStageId}
                                    onChange={e => setModalStageId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                                >
                                    {stages.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {formError && <p className="text-red-500 text-sm">{formError}</p>}

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateLead}
                                    disabled={creating}
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {creating ? 'Criando...' : 'Criar Lead'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Painel de detalhes */}
            {selectedLeadId && (
                <LeadDetailPanel
                    leadId={selectedLeadId}
                    stages={stages}
                    onClose={() => setSelectedLeadId(null)}
                    onValueUpdated={(id, val) => setLeads(prev => prev.map(l => l.id === id ? { ...l, value: val } : l))}
                />
            )}
        </>
    );
}
