import { getIntegrations, getOrigins, getStages, getFacebookPixelConfig } from '@/app/actions/settings';
import SettingsClient from './SettingsClient';

interface SearchParams {
    instagram_error?: string;
    instagram_success?: string;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const params = await searchParams;

    const [integrations, origins, stages, pixelConfig] = await Promise.all([
        getIntegrations().catch(() => []),
        getOrigins().catch(() => []),
        getStages().catch(() => []),
        getFacebookPixelConfig().catch(() => null),
    ]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Definições da Conta</h2>
            <SettingsClient
                initialIntegrations={integrations}
                initialOrigins={origins}
                initialStages={stages}
                pixelConfig={pixelConfig}
                instagramError={params.instagram_error}
                instagramSuccess={!!params.instagram_success}
            />
        </div>
    );
}
