import KanbanBoard from '@/components/kanban/KanbanBoard';

export default function KanbanPage() {
    return (
        <div className="h-full flex flex-col">
            <header className="mb-6 flex justify-between items-center px-1">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Kanban</h2>
                    <p className="text-gray-500 text-sm">Manage your deals pipeline</p>
                </div>
                <div className="flex space-x-3">
                    <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm">
                        Filter
                    </button>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm shadow-blue-200">
                        + New Deal
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                <KanbanBoard />
            </div>
        </div>
    );
}
