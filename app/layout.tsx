import type { Metadata, Viewport } from 'next'
import { DM_Sans, Source_Serif_4 } from 'next/font/google'

import './globals.css'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

const _dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-inter',
})

const _sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
})

export const metadata: Metadata = {
  title: 'EcoExchange - Citizen Science Data Exchange',
  description:
    'Discover citizen-science programs and collect standardized, quality-checked sustainability data that organizations can confidently share and reuse.',
}

export const viewport: Viewport = {
  themeColor: '#2D5E46',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${_dmSans.variable} ${_sourceSerif.variable}`}>
      <body className="font-sans">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
