import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function LogoutButton() {
  async function handleLogout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  return (
    <form action={handleLogout} className="w-full">
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </form>
  )
}
