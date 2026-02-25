'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(
        new URL(window.location.href).searchParams.get('code') || ''
      )

      if (error) {
        console.error('Auth error:', error)
        router.push('/auth/error')
      } else {
        // Redirect to dashboard
        router.push('/')
      }
    }

    handleCallback()
  }, [router, supabase.auth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}
