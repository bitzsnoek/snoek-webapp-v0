'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/components/app-shell'
import { LoginForm } from '@/components/login-form'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  const checkAuth = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // Check if there's a pending invite token to process
        const pendingInvite = localStorage.getItem('pending_invite_token')
        if (pendingInvite) {
          localStorage.removeItem('pending_invite_token')
          router.push(`/invitations/accept?token=${pendingInvite}`)
          return
        }
      }

      setStatus(session ? 'authenticated' : 'unauthenticated')
    } catch {
      setStatus('unauthenticated')
    }
  }, [router])

  useEffect(() => {
    checkAuth()

    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const pendingInvite = localStorage.getItem('pending_invite_token')
        if (pendingInvite) {
          localStorage.removeItem('pending_invite_token')
          router.push(`/invitations/accept?token=${pendingInvite}`)
          return
        }
      }
      setStatus(session ? 'authenticated' : 'unauthenticated')
    })

    return () => subscription.unsubscribe()
  }, [checkAuth, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <LoginForm />
  }

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
