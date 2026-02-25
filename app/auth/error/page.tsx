'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function ErrorPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-red-50 p-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>

          <h1 className="text-center text-2xl font-bold text-foreground mb-2">
            Authentication Failed
          </h1>
          <p className="text-center text-sm text-muted-foreground mb-6">
            Something went wrong during sign in. Please try again.
          </p>

          <Button
            onClick={() => router.push('/auth/login')}
            className="w-full"
          >
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  )
}
