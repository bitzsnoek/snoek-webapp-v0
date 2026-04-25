import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono, Noto_Serif } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"], 
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" })
const notoSerif = Noto_Serif({ 
  subsets: ["latin"], 
  variable: "--font-noto-serif",
  weight: ["500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: 'Snoek - Strategy Coaching Dashboard',
  description: 'Track goals, OKRs, and client metrics for the members you coach',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} ${notoSerif.variable} bg-background`} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
