import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import ServiceWorkerRegistration from '@/components/app/ServiceWorkerRegistration'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ficha Médica',
  description: 'Gestión de registros quirúrgicos',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  )
}
