import Link from 'next/link';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-gray-950 text-white selection:bg-blue-500 selection:text-white overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl opacity-50 mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <header className="py-6 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span className="font-bold text-white text-lg">Q</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight">Qarvon</span>
                    </div>
                    <nav>
                        <Link
                            href="/dashboard"
                            className="bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white px-5 py-2 rounded-full font-medium transition-all text-sm hover:shadow-lg hover:shadow-blue-500/20"
                        >
                            Entrar
                        </Link>
                    </nav>
                </header>

                {/* Hero Section */}
                <main className="mt-20 lg:mt-32 text-center">
                    <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-8">
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                        <span className="text-blue-300 text-xs font-semibold tracking-wide uppercase">Novo: Atribuição via WhatsApp</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                        Crescimento Real <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Sem Achismos.</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 mb-10 leading-relaxed">
                        O primeiro CRM desenhado exclusivamente para operações de tráfego pago no WhatsApp.
                        Monitore atribuição granular, ROI de campanhas e performance de vendas em tempo real.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <Link
                            href="/dashboard"
                            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-600/20 transition-all transform hover:-translate-y-1"
                        >
                            Começar Agora
                        </Link>
                        <button className="w-full sm:w-auto px-8 py-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold text-lg border border-gray-700 transition-all">
                            Agendar Demo
                        </button>
                    </div>

                    {/* Feature Grid */}
                    <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                        <div className="p-8 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors group">
                            <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center mb-6 group-hover:bg-blue-600/20 transition-colors">
                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Atribuição Granular</h3>
                            <p className="text-gray-400">Saiba exatamente qual campanha, criativo e keyword gerou a venda no WhatsApp, sem depender de cookies.</p>
                        </div>

                        <div className="p-8 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors group">
                            <div className="w-12 h-12 bg-purple-900/30 rounded-lg flex items-center justify-center mb-6 group-hover:bg-purple-600/20 transition-colors">
                                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Inbox Unificado</h3>
                            <p className="text-gray-400">Centralize WhatsApp e Instagram Direct em uma única tela. Nunca mais perca um lead por demora na resposta.</p>
                        </div>

                        <div className="p-8 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors group">
                            <div className="w-12 h-12 bg-green-900/30 rounded-lg flex items-center justify-center mb-6 group-hover:bg-green-600/20 transition-colors">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">ROI em Tempo Real</h3>
                            <p className="text-gray-400">Metrifique o retorno exato de cada real investido. Dashboards automáticos que mostram a verdade.</p>
                        </div>
                    </div>
                </main>

                <footer className="mt-32 border-t border-gray-800 py-12 text-center text-gray-500">
                    <p>&copy; 2026 Qarvon CRM. Todos os direitos reservados.</p>
                </footer>
            </div>
        </div>
    );
}
