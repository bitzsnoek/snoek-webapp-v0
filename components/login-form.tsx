'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'

type AuthMode = 'password' | 'magic-link'

export function LoginForm() {
  const [mode, setMode] = useState<AuthMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Redirect directly to dashboard -- verify-magic-link establishes the session
      const redirectTo =
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${window.location.origin}/`

      const res = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo }),
      })
      const result = await res.json()

      if (!res.ok || result.error) {
        setError(result.error || 'Failed to send magic link')
      } else {
        setSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="mb-6 flex justify-center">
            <Image
              src="/images/snoek-logo.png"
              alt="Snoek"
              width={64}
              height={64}
              className="rounded-full"
            />
          </div>

          <h1 className="text-center text-2xl font-bold text-foreground mb-2">
            Welcome back
          </h1>
          <p className="text-center text-sm text-muted-foreground mb-6">
            {mode === 'password'
              ? 'Sign in with your email and password'
              : 'Enter your email to receive a magic link'}
          </p>

          {sent ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-foreground text-center">
                Check your email! We sent you a magic link to sign in.
              </p>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Password</label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send Magic Link'}
              </Button>
            </form>
          )}

          {!sent && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setMode(mode === 'password' ? 'magic-link' : 'password'); setError(null) }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {mode === 'password' ? 'Sign in with magic link instead' : 'Sign in with password instead'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
