'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/records', icon: '📋', label: 'Registros' },
  { href: '/search', icon: '🔍', label: 'Buscar' },
  { href: '/new', icon: '📷', label: 'Nueva', cta: true },
  { href: '/reports', icon: '📊', label: 'Reportes' },
  { href: '/settings', icon: '⚙️', label: 'Config' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(item => {
          const active = item.href === '/settings'
            ? pathname === '/settings'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 flex-1"
            >
              {item.cta ? (
                <span className="bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center text-lg">
                  {item.icon}
                </span>
              ) : (
                <span className="text-xl">{item.icon}</span>
              )}
              <span className={`text-[10px] ${active ? 'text-blue-400' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
