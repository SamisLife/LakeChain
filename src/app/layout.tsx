import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LakeChain — Michigan Supply Chain Intelligence',
  description: 'Discover and rank Michigan manufacturers scored on Great Lakes watershed impact and local economic value.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-lc-bg text-lc-text font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
