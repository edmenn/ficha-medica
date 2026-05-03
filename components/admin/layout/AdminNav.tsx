'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ADMIN_NAV_ITEMS = [
  { href: '/admin', icon: '🏠', label: 'Dashboard' },
  { href: '/admin/users', icon: '🧑‍💼', label: 'Usuarios' },
  { href: '/admin/settings', icon: '⚙️', label: 'Cuenta' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800">
      <div className="flex justify-around items-center h-16 max-w-6xl mx-auto px-2">
        {ADMIN_NAV_ITEMS.map(item => {
          const active = item.href === '/admin'
            ? pathname === '/admin'
            : item.href === '/admin/settings'
              ? pathname === '/admin/settings'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 flex-1"
            >
              <span className="text-xl">{item.icon}</span>
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
