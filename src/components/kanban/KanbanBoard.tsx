'use client';

import React, { useEffect, useState } from 'react';
import { getStages, getLeads, updateLeadStage, Stage, Lead } from '@/lib/api/kanban';

export default function KanbanBoard() {
    const [stages, setStages] = useState<Stage[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [stagesData, leadsData] = await Promise.all([getStages(), getLeads()]);
                setStages(stagesData);
                setLeads(leadsData);
            } catch (error) {
                console.error("Failed to fetch Kanban data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const onDragStart = (e: React.DragEvent, leadId: string) => {
        setDraggingLeadId(leadId);
        e.dataTransfer.effectAllowed = "move";
        // Required for Firefox
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

        // Optimistic Update
        setLeads(prev => prev.map(l =>
            l.id === draggingLeadId ? { ...l, stage_id: targetStageId } : l
        ));

        try {
            // TODO: Get real user ID from context/auth
            const userId = 'user-placeholder-id';
            await updateLeadStage(draggingLeadId, targetStageId, oldStageId, userId);
        } catch (error) {
            console.error("Failed to update stage:", error);
            // Rollback
            setLeads(prev => prev.map(l =>
                l.id === draggingLeadId ? { ...l, stage_id: oldStageId } : l
            ));
        } finally {
            setDraggingLeadId(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading Board...</div>;
    }

    return (
        <div className="flex h-full space-x-4 overflow-x-auto pb-4">
            {stages.map(stage => (
                <div
                    key={stage.id}
                    className="w-80 flex-shrink-0 bg-gray-100/50 rounded-xl flex flex-col border border-gray-200"
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, stage.id)}
                >
                    {/* Column Header */}
                    <div className="p-4 border-b border-gray-200 bg-white/50 rounded-t-xl backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="font-semibold text-gray-700">{stage.name}</h3>
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                {leads.filter(l => l.stage_id === stage.id).length}
                            </span>
                        </div>
                        <div className="h-1 w-full bg-gray-200 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-blue-500 w-1/2"></div> {/* Mock progress */}
                        </div>
                    </div>

                    {/* Cards Container */}
                    <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                        {leads
                            .filter(l => l.stage_id === stage.id)
                            .map(lead => (
                                <div
                                    key={lead.id}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, lead.id)}
                                    className={`
                    bg-white p-4 rounded-lg shadow-sm border border-gray-100 
                    cursor-move hover:shadow-md transition-shadow
                    ${draggingLeadId === lead.id ? 'opacity-50' : 'opacity-100'}
                  `}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-sm font-medium text-gray-800">{lead.contact_name || 'Unnamed Lead'}</span>
                                        <span className="text-xs font-semibold text-green-600">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value || 0)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                                        <div className="flex items-center space-x-1">
                                            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                                            <span>Needs Action</span>
                                        </div>
                                        <span>2d ago</span>
                                    </div>
                                </div>
                            ))}

                        {leads.filter(l => l.stage_id === stage.id).length === 0 && (
                            <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                Empty Stage
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Add Stage Button Placeholder */}
            <div className="w-80 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors opacity-50 hover:opacity-100">
                <span className="text-gray-400 font-medium">+ Add Stage</span>
            </div>
        </div>
    );
}
