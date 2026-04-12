'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos')
      setLoading(false)
    } else {
      window.location.href = '/inbox'
    }
  }

  async function handleMagicLink() {
    if (!email) { setError('Digite seu email primeiro'); return }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError('Erro ao enviar link. Tente novamente.')
    } else {
      setMagicSent(true)
    }
    setLoading(false)
  }

  if (magicSent) {
    return (
      <div className="text-center bg-card border border-border rounded-xl p-8">
        <div className="text-4xl mb-4">📧</div>
        <h2 className="text-lg font-semibold mb-2">Link enviado!</h2>
        <p className="text-muted-foreground text-sm">
          Verifique seu email <strong>{email}</strong> e clique no link para entrar.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleEmailLogin} className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="seu@email.com"
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-qarvon-600"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-qarvon-600"
          />
        </div>
      </div>

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      <Button type="submit" className="w-full" variant="brand" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Entrar
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground">
          <span className="bg-background px-2">ou</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleMagicLink}
        disabled={loading}
      >
        Enviar link mágico por email
      </Button>
    </form>
  )
}
