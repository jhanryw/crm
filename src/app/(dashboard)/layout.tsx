import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { WorkspaceProvider } from '@/components/workspace-provider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Load user's workspace membership
  const { data: membership, error: membershipError } = await (supabase as any)
    .schema('crm')
    .from('workspace_members')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!membership) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Sem acesso</h1>
          <p className="text-muted-foreground text-sm">
            Você não está em nenhum workspace. Contate o administrador.
          </p>
          {membershipError && (
            <pre className="mt-4 text-xs text-red-400 text-left bg-black/30 rounded p-3 max-w-lg">
              {JSON.stringify(membershipError, null, 2)}
            </pre>
          )}
        </div>
      </div>
    )
  }

  return (
    <WorkspaceProvider membership={membership as any}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar membership={membership as any} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  )
}
