import SignInButton from '@/components/auth/SignIn';
import { signInAction } from '@/app/actions/auth';

export default function SignInPage() {
    return (
        <div
            className="flex flex-col items-center justify-center min-h-screen overflow-hidden"
            style={{ background: '#0d0d0d' }}
        >
            {/* Glow de fundo */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-20"
                    style={{ background: '#1fc2a9' }}
                />
                <div
                    className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[100px] opacity-10"
                    style={{ background: '#107c65' }}
                />
            </div>

            <div
                className="relative z-10 p-8 rounded-2xl md:w-96 text-center"
                style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(16px)',
                }}
            >
                {/* Logo */}
                <div
                    className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-bold text-2xl mb-6 shadow-lg"
                    style={{ background: '#1fc2a9', color: '#0d0d0d' }}
                >
                    Q
                </div>

                <h1 className="text-2xl font-bold text-white mb-1">Bem-vindo ao Qarvon</h1>
                <p className="mb-8 text-sm" style={{ color: '#6b7280' }}>Faça login para continuar</p>

                {/* Wrapper que aplica o hover via CSS */}
                <style>{`
                    .signin-btn {
                        background: #1fc2a9 !important;
                        transition: background 0.2s;
                    }
                    .signin-btn:hover {
                        background: #107c65 !important;
                    }
                `}</style>
                <SignInButton
                    className="signin-btn w-full px-8 py-3.5 rounded-xl font-bold text-base text-white transition-all"
                    onSignIn={signInAction}
                />

                <p className="mt-6 text-xs" style={{ color: '#444' }}>
                    Ao continuar, você concorda com nossos Termos de Uso.
                </p>
            </div>
        </div>
    );
}
