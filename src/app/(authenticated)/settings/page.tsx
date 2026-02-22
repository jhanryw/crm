import { getIntegrations, getOrigins } from '@/app/actions/settings';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
    const integrations = await getIntegrations();
    const origins = await getOrigins();

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Definições da Conta</h2>
            <SettingsClient initialIntegrations={integrations} initialOrigins={origins} />
        </div>
    );
}

