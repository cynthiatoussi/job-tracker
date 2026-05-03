import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DataJob Tracker',
  description: 'Veille emploi data Europe',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
