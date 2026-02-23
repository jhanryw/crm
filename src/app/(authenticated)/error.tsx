'use client';

export default function AuthenticatedError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
            <h2 className="text-xl font-semibold text-gray-800">Algo deu errado</h2>
            <p className="text-sm text-gray-500 max-w-md">
                Ocorreu um erro ao carregar esta página. Verifique sua conexão e tente novamente.
            </p>
            {error?.digest && (
                <p className="text-xs text-gray-400 font-mono">Código: {error.digest}</p>
            )}
            <button
                onClick={reset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
                Tentar novamente
            </button>
        </div>
    );
}
