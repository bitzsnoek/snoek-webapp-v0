'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/components/app-shell'
import { LoginForm } from '@/components/login-form'

export default function Home() {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  const checkAuth = useCallback(async () => {
    try {
      console.log('[v0] checkAuth: creating client...')
      const supabase = createClient()
      console.log('[v0] checkAuth: calling getSession...')
      const { data: { session }, error } = await supabase.auth.getSession()
      console.log('[v0] checkAuth: result', { hasSession: !!session, error })
      setStatus(session ? 'authenticated' : 'unauthenticated')
    } catch (err) {
      console.error('[v0] checkAuth: caught error', err)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    checkAuth()

    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'authenticated' : 'unauthenticated')
    })

    return () => subscription.unsubscribe()
  }, [checkAuth])

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
