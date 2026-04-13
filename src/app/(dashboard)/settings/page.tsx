import { createClient } from '@/lib/supabase/server'
import { Settings2, Users, MessageSquare, Webhook } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = createClient()

  const [{ data: workspace }, { data: members }, { data: channels }] = await Promise.all([
    supabase.schema('crm').from('workspaces').select('*').limit(1).single(),
    supabase.schema('crm').from('workspace_members').select('*, user:workspace_members(id)').eq('is_active', true),
    supabase.schema('messaging').from('channels').select('*').eq('is_active', true),
  ])

  const ws = workspace as { id: string; name: string; slug: string; plan: string } | null

  return (
    <div className="h-full overflow-auto">
      <div className="h-14 px-6 flex items-center gap-4 border-b border-border">
        <h1 className="text-base font-semibold">Configurações</h1>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Workspace */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Workspace</h2>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            <SettingRow label="Nome" value={ws?.name ?? '—'} />
            <SettingRow label="Slug" value={ws?.slug ?? '—'} mono />
            <SettingRow label="Plano" value={ws?.plan ?? '—'} badge />
          </div>
        </section>

        {/* Channels */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Canais conectados</h2>
            <span className="text-xs text-muted-foreground ml-auto">{(channels ?? []).length} ativo{(channels ?? []).length !== 1 ? 's' : ''}</span>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {(channels ?? []).length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum canal conectado
              </div>
            ) : (channels as { id: string; type: string; name: string; phone_number: string | null }[]).map(ch => (
              <div key={ch.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{ch.name}</p>
                  {ch.phone_number && (
                    <p className="text-xs text-muted-foreground font-mono">{ch.phone_number}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ch.type === 'whatsapp' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-pink-400/10 text-pink-400'}`}>
                  {ch.type}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Members */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Membros</h2>
            <span className="text-xs text-muted-foreground ml-auto">{(members ?? []).length}</span>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {(members as { id: string; display_name: string | null; role: string }[] ?? []).map(m => (
              <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {(m.display_name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm">{m.display_name ?? 'Sem nome'}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Webhooks */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Webhook className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Webhooks</h2>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            <SettingRow label="WhatsApp" value="/api/webhooks/whatsapp" mono />
            <SettingRow label="Instagram" value="/api/webhooks/instagram" mono />
            <SettingRow label="ERP" value="/api/webhooks/erp" mono />
          </div>
        </section>
      </div>
    </div>
  )
}

function SettingRow({
  label, value, mono, badge,
}: {
  label: string; value: string; mono?: boolean; badge?: boolean
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {badge ? (
        <span className="text-xs px-2 py-0.5 rounded-full bg-qarvon-600/20 text-qarvon-400 font-medium capitalize">
          {value}
        </span>
      ) : (
        <span className={`text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
      )}
    </div>
  )
}
