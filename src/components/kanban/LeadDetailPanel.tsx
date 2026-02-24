'use client';

import { useState, useEffect } from 'react';
import { X, Phone, User, DollarSign, Clock, ChevronRight, Edit2, Check } from 'lucide-react';
import { getLead, updateLeadValue, LeadDetail, Stage } from '@/lib/api/kanban';

interface Props {
    leadId: string;
    stages: Stage[];
    onClose: () => void;
    onValueUpdated: (leadId: string, value: number) => void;
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
}

function ChannelBadge({ source }: { source?: string }) {
    if (!source) return null;
    const s = source.toLowerCase();
    const style = s.includes('whatsapp')
        ? { bg: '#e8faf7', color: '#107c65' }
        : s.includes('instagram')
            ? { bg: '#fdf2f8', color: '#db2777' }
            : { bg: '#f3f4f6', color: '#6b7280' };
    return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: style.bg, color: style.color }}>
            {source}
        </span>
    );
}

export default function LeadDetailPanel({ leadId, stages, onClose, onValueUpdated }: Props) {
    const [lead, setLead] = useState<LeadDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingValue, setEditingValue] = useState(false);
    const [valueInput, setValueInput] = useState('');
    const [savingValue, setSavingValue] = useState(false);

    useEffect(() => {
        getLead(leadId).then(data => {
            setLead(data);
            setValueInput(String(data?.value || 0));
            setLoading(false);
        });
    }, [leadId]);

    const handleSaveValue = async () => {
        if (!lead) return;
        const newValue = parseFloat(valueInput.replace(',', '.'));
        if (isNaN(newValue)) return;
        setSavingValue(true);
        try {
            await updateLeadValue(leadId, newValue);
            setLead(prev => prev ? { ...prev, value: newValue } : prev);
            onValueUpdated(leadId, newValue);
            setEditingValue(false);
        } finally { setSavingValue(false); }
    };

    const getStageName = (stageId: string) => stages.find(s => s.id === stageId)?.name || stageId;

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-100 shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-base">Detalhes do Lead</h3>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <X size={18} className="text-gray-500" />
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center gap-3 text-gray-400 text-sm">
                    <div className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#1fc2a9' }} />
                    Carregando...
                </div>
            ) : !lead ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Lead não encontrado</div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* Contato */}
                    <div className="p-5 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: '#e8faf7' }}
                            >
                                <User size={22} style={{ color: '#1fc2a9' }} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-base">{lead.contact_name}</h4>
                                <div className="mt-1">
                                    <ChannelBadge source={lead.source} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            {lead.contact_phone && (
                                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                                    <Phone size={14} className="text-gray-400 flex-shrink-0" />
                                    <span>{lead.contact_phone}</span>
                                </div>
                            )}
                            {lead.lead_origins?.name && (
                                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                                    <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                                    <span>Origem: <strong>{lead.lead_origins.name}</strong></span>
                                </div>
                            )}
                            {lead.created_at && (
                                <div className="flex items-center gap-2.5 text-sm text-gray-500">
                                    <Clock size={14} className="text-gray-400 flex-shrink-0" />
                                    <span>Criado {timeAgo(lead.created_at)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Valor */}
                    <div className="p-5 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor do Negócio</span>
                            {!editingValue && (
                                <button
                                    onClick={() => setEditingValue(true)}
                                    className="text-xs flex items-center gap-1 transition-colors"
                                    style={{ color: '#1fc2a9' }}
                                >
                                    <Edit2 size={12} /> Editar
                                </button>
                            )}
                        </div>
                        {editingValue ? (
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                                    <input
                                        type="number"
                                        value={valueInput}
                                        onChange={e => setValueInput(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-800"
                                        style={{ outline: 'none', borderColor: '#1fc2a9' }}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleSaveValue}
                                    disabled={savingValue}
                                    className="px-3 py-2 rounded-xl text-white disabled:opacity-50"
                                    style={{ background: '#1fc2a9' }}
                                >
                                    <Check size={16} />
                                </button>
                                <button
                                    onClick={() => { setEditingValue(false); setValueInput(String(lead.value || 0)); }}
                                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <DollarSign size={18} style={{ color: '#1fc2a9' }} />
                                <span className="text-2xl font-bold text-gray-800">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value || 0)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Stage atual */}
                    <div className="p-5 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Stage Atual</span>
                        <span
                            className="inline-block font-medium px-3 py-1.5 rounded-lg text-sm"
                            style={{ background: '#e8faf7', color: '#107c65' }}
                        >
                            {getStageName(lead.stage_id)}
                        </span>
                    </div>

                    {/* Histórico */}
                    <div className="p-5">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3">Histórico</span>
                        {lead.deals_history && lead.deals_history.length > 0 ? (
                            <div className="space-y-3">
                                {lead.deals_history.map((h, i) => (
                                    <div key={i} className="flex items-start gap-3 text-sm">
                                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#1fc2a9' }} />
                                        <div>
                                            <p className="text-gray-700">
                                                <span className="font-medium">{getStageName(h.old_stage) || '—'}</span>
                                                <span className="text-gray-400 mx-1.5">→</span>
                                                <span className="font-medium">{getStageName(h.new_stage)}</span>
                                            </p>
                                            <p className="text-gray-400 text-xs mt-0.5">{timeAgo(h.moved_at)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Nenhuma movimentação ainda.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
