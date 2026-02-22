import { signIn } from '@logto/next/server-actions';
import SignInButton from '@/components/auth/SignIn';
import { logtoConfig } from '@/lib/auth/logto';

export default function SignInPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white selection:bg-blue-500 selection:text-white overflow-hidden">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl opacity-50 mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl opacity-50 mix-blend-screen"></div>
            </div>

            <div className="relative z-10 p-8 bg-gray-900/50 border border-gray-800 rounded-2xl md:w-96 text-center shadow-xl">
                <div className="w-12 h-12 mx-auto bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6">
                    <span className="font-bold text-white text-2xl">Q</span>
                </div>
                <h1 className="text-2xl font-bold mb-2">Bem-vindo ao Qarvon</h1>
                <p className="text-gray-400 mb-8">Faça login para continuar</p>

                <SignInButton
                    className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-600/20 transition-all transform hover:-translate-y-1"
                    onSignIn={async () => {
                        'use server';
                        await signIn(logtoConfig);
                    }}
                />
            </div>
        </div>
    );
}
