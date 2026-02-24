'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Phone, User } from 'lucide-react';
import { getStages, getLeads, updateLeadStage, createLead, Stage, Lead } from '@/lib/api/kanban';
import LeadDetailPanel from './LeadDetailPanel';

interface Props { userId: string; }

function timeAgo(dateStr?: string) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

function channelColor(source?: string): { bg: string; color: string } {
    if (!source) return { bg: '#f3f4f6', color: '#6b7280' };
    const s = source.toLowerCase();
    if (s.includes('whatsapp')) return { bg: '#e8faf7', color: '#107c65' };
    if (s.includes('instagram')) return { bg: '#fdf2f8', color: '#db2777' };
    if (s === 'manual') return { bg: '#f3f4f6', color: '#6b7280' };
    return { bg: '#eef2ff', color: '#4f46e5' };
}

// Paleta de cores para colunas (barra de progresso topo)
const STAGE_COLORS = ['#1fc2a9', '#6366f1', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6'];

export default function KanbanBoard({ userId }: Props) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

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
                console.error('Erro ao carregar Kanban:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const onDragStart = (e: React.DragEvent, leadId: string) => {
        setDraggingLeadId(leadId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', leadId);
    };

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };

    const onDrop = async (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault();
        if (!draggingLeadId) return;
        const lead = leads.find(l => l.id === draggingLeadId);
        if (!lead || lead.stage_id === targetStageId) return;
        const oldStageId = lead.stage_id;
        setLeads(prev => prev.map(l => l.id === draggingLeadId ? { ...l, stage_id: targetStageId } : l));
        try {
            await updateLeadStage(draggingLeadId, targetStageId, oldStageId, userId);
        } catch {
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
        return (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm gap-3">
                <div className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#1fc2a9' }} />
                Carregando pipeline...
            </div>
        );
    }

    return (
        <>
            {/* Botão Novo Lead */}
            <div className="flex justify-end mb-5">
                <button
                    onClick={() => openNewLeadModal()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm text-white"
                    style={{ background: '#1fc2a9' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#107c65'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#1fc2a9'}
                >
                    <Plus size={16} /> Novo Lead
                </button>
            </div>

            {/* Board */}
            <div className="flex h-full gap-4 overflow-x-auto pb-4">
                {stages.map((stage, idx) => {
                    const stageLeads = leads.filter(l => l.stage_id === stage.id);
                    const totalValue = stageLeads.reduce((s, l) => s + (l.value || 0), 0);
                    const accentColor = STAGE_COLORS[idx % STAGE_COLORS.length];

                    return (
                        <div
                            key={stage.id}
                            className="w-72 flex-shrink-0 flex flex-col rounded-2xl border border-gray-100 overflow-hidden"
                            style={{ background: '#f8f9fb' }}
                            onDragOver={onDragOver}
                            onDrop={e => onDrop(e, stage.id)}
                        >
                            {/* Topo colorido */}
                            <div className="h-1 w-full flex-shrink-0" style={{ background: accentColor }} />

                            {/* Cabeçalho */}
                            <div className="px-4 py-3 bg-white border-b border-gray-100">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-gray-800 text-sm">{stage.name}</h3>
                                    <span
                                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: `${accentColor}20`, color: accentColor }}
                                    >
                                        {stageLeads.length}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                                </p>
                            </div>

                            {/* Cards */}
                            <div className="p-3 flex-1 overflow-y-auto space-y-2.5 min-h-[160px]">
                                {stageLeads.map(lead => {
                                    const ch = channelColor(lead.source);
                                    return (
                                        <div
                                            key={lead.id}
                                            draggable
                                            onDragStart={e => onDragStart(e, lead.id)}
                                            onClick={() => setSelectedLeadId(lead.id)}
                                            className="bg-white rounded-xl px-4 py-3.5 border border-gray-100 cursor-pointer transition-all"
                                            style={draggingLeadId === lead.id ? { opacity: 0.4, transform: 'scale(0.97)' } : {}}
                                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1fc2a9'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(31,194,169,0.12)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#f3f4f6'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <User size={12} className="text-gray-400 flex-shrink-0" />
                                                    <span className="text-sm font-semibold text-gray-800 truncate">
                                                        {lead.contact_name || 'Lead sem nome'}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: '#1fc2a9' }}>
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value || 0)}
                                                </span>
                                            </div>
                                            {lead.contact_phone && (
                                                <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                                                    <Phone size={11} />
                                                    <span>{lead.contact_phone}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                {lead.source && (
                                                    <span
                                                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                                        style={{ background: ch.bg, color: ch.color }}
                                                    >
                                                        {lead.source}
                                                    </span>
                                                )}
                                                {lead.created_at && (
                                                    <span className="text-xs text-gray-400 ml-auto">{timeAgo(lead.created_at)}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {stageLeads.length === 0 && (
                                    <div
                                        onClick={() => openNewLeadModal(stage.id)}
                                        className="text-center py-8 text-sm border-2 border-dashed rounded-xl cursor-pointer transition-all text-gray-300"
                                        style={{ borderColor: '#e5e7eb' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1fc2a9'; (e.currentTarget as HTMLDivElement).style.color = '#1fc2a9'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLDivElement).style.color = '#d1d5db'; }}
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
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Novo Lead</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {[
                                { label: 'Nome do Contato *', key: 'contact_name', placeholder: 'Ex: João Silva', type: 'text', autoFocus: true },
                                { label: 'Telefone', key: 'contact_phone', placeholder: 'Ex: 5511999999999', type: 'text', autoFocus: false },
                                { label: 'Valor (R$)', key: 'value', placeholder: '0,00', type: 'number', autoFocus: false },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                                    <input
                                        type={f.type}
                                        autoFocus={f.autoFocus}
                                        value={(form as any)[f.key]}
                                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                        placeholder={f.placeholder}
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 transition-colors"
                                        style={{ outline: 'none' }}
                                        onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#1fc2a9'}
                                        onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'}
                                    />
                                </div>
                            ))}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estágio *</label>
                                <select
                                    value={modalStageId}
                                    onChange={e => setModalStageId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 transition-colors"
                                    style={{ outline: 'none' }}
                                    onFocus={e => (e.target as HTMLSelectElement).style.borderColor = '#1fc2a9'}
                                    onBlur={e => (e.target as HTMLSelectElement).style.borderColor = '#e5e7eb'}
                                >
                                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            {formError && (
                                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">{formError}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateLead}
                                    disabled={creating}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
                                    style={{ background: '#1fc2a9' }}
                                    onMouseEnter={e => { if (!creating) (e.currentTarget as HTMLButtonElement).style.background = '#107c65'; }}
                                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#1fc2a9'}
                                >
                                    {creating ? 'Criando...' : 'Criar Lead'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
