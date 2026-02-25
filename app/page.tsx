'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/components/app-shell'

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        console.log('[v0] Session check:', { session: !!session, error: sessionError })

        if (sessionError) {
          console.error('[v0] Session error:', sessionError)
          setError(sessionError.message)
          setIsLoading(false)
          return
        }

        if (!session) {
          console.log('[v0] No session, redirecting to login')
          router.push('/auth/login')
        } else {
          console.log('[v0] Session found, authenticated')
          setIsAuthenticated(true)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('[v0] Auth check error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase.auth])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md px-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Connection Error</h2>
            <p className="text-sm text-red-800 mb-4">{error}</p>
            <p className="text-xs text-red-700">Please check that your Supabase URL and API key are correct in the environment variables.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
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

  if (!isAuthenticated) {
    return null
  }

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
