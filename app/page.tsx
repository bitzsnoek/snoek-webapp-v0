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

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('[v0] Creating Supabase client')
        const supabase = createClient()
        
        console.log('[v0] Checking session...')
        
        // Add a timeout for the session check
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        )
        
        const result = await Promise.race([
          sessionPromise,
          timeoutPromise,
        ]) as any

        console.log('[v0] Session check result:', { hasSession: !!result?.data?.session, error: result?.error })

        if (result?.error) {
          console.error('[v0] Session error:', result.error)
          setError(result.error.message)
          setIsLoading(false)
          return
        }

        if (!result?.data?.session) {
          console.log('[v0] No session, redirecting to login')
          setIsLoading(false)
          router.push('/auth/login')
        } else {
          console.log('[v0] Session found, authenticated')
          setIsAuthenticated(true)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('[v0] Auth check error:', err)
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md px-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Connection Error</h2>
            <p className="text-sm text-red-800 mb-4">{error}</p>
            <p className="text-xs text-red-700 mb-4">Please check that your Supabase URL and API key are correct in the environment variables.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              Retry
            </button>
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
