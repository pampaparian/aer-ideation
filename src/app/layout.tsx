import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ÆR IDEATION',
  description: 'Innovationsbiologi — förgrenade noder baserade på din input',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  )
}
