'use client';

import { useState, useEffect } from 'react';
import { X, Phone, User, DollarSign, Clock, ChevronRight, Edit2, Check, XCircle } from 'lucide-react';
import { getLead, updateLeadValue, LeadDetail, Stage } from '@/lib/api/kanban';
import { markLeadAsLost } from '@/app/actions/kanban';

const LOSS_REASONS = [
    'Preço alto',
    'Comprou na concorrência',
    'Sem orçamento no momento',
    'Sem interesse',
    'Não retornou o contato',
    'Mudou de ideia',
    'Outros',
];

interface Props {
    leadId: string;
    stages: Stage[];
    onClose: () => void;
    onValueUpdated: (leadId: string, value: number) => void;
    onLeadLost?: (leadId: string) => void;
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

export default function LeadDetailPanel({ leadId, stages, onClose, onValueUpdated, onLeadLost }: Props) {
    const [lead, setLead] = useState<LeadDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingValue, setEditingValue] = useState(false);
    const [valueInput, setValueInput] = useState('');
    const [savingValue, setSavingValue] = useState(false);

    // Lost modal state
    const [showLostModal, setShowLostModal] = useState(false);
    const [lostReason, setLostReason] = useState(LOSS_REASONS[0]);
    const [markingLost, setMarkingLost] = useState(false);
    const [lostError, setLostError] = useState('');

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

    const handleConfirmLost = async () => {
        setMarkingLost(true); setLostError('');
        const result = await markLeadAsLost(leadId, lostReason);
        if (!result.success) { setLostError(result.error); setMarkingLost(false); return; }
        setShowLostModal(false);
        setMarkingLost(false);
        onLeadLost?.(leadId);
        onClose();
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
                    <div className="p-5 border-b border-gray-100">
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

                    {/* Ação Perdido */}
                    <div className="p-5">
                        <button
                            onClick={() => { setLostReason(LOSS_REASONS[0]); setLostError(''); setShowLostModal(true); }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                        >
                            <XCircle size={15} /> Marcar como Perdido
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal Perdido ─────────────────────────────────────────────────── */}
            {showLostModal && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => { if (!markingLost) setShowLostModal(false); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <XCircle size={18} className="text-red-500" /> Marcar como Perdido
                            </h3>
                            {!markingLost && (
                                <button onClick={() => setShowLostModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-500" /></button>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Selecione o motivo para identificar padrões de perda.</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Motivo da Perda</label>
                                <select
                                    value={lostReason}
                                    onChange={e => setLostReason(e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800"
                                    style={{ outline: 'none' }}
                                    onFocus={e => (e.target as HTMLSelectElement).style.borderColor = '#ef4444'}
                                    onBlur={e => (e.target as HTMLSelectElement).style.borderColor = '#e5e7eb'}
                                >
                                    {LOSS_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            {lostError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-100">{lostError}</p>}
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowLostModal(false)} disabled={markingLost} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium disabled:opacity-50">Cancelar</button>
                                <button
                                    onClick={handleConfirmLost} disabled={markingLost}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition-colors"
                                >
                                    {markingLost
                                        ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</>
                                        : 'Confirmar Perda'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
