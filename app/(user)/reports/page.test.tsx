import { render, screen } from '@testing-library/react'
import ReportsPage from '@/app/(user)/reports/page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/auth/guards', () => ({
  requireOperationalContext: vi.fn(async () => ({
    profile: { id: 'user-1', email: 'user@example.com', role: 'user', preferred_model: null },
    effectiveUserId: 'user-1',
  })),
}))

const orderMock = vi.fn()
const limitMock = vi.fn()
const eqMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: fromMock,
  })),
}))

describe('ReportsPage', () => {
  beforeEach(() => {
    orderMock.mockReset()
    limitMock.mockReset()
    eqMock.mockReset()
    selectMock.mockReset()
    fromMock.mockReset()

    orderMock.mockResolvedValue({ data: [] })
    limitMock.mockReturnValue({ order: orderMock })
    eqMock
      .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ data: [] }) })
      .mockReturnValueOnce({ order: vi.fn().mockReturnValue({ limit: limitMock }) })
    selectMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValue({ select: selectMock })
  })

  it('renders calendar-based date inputs for the report range', async () => {
    render(await ReportsPage({ searchParams: {} }))

    expect(screen.getByLabelText('Desde')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('type', 'date')
  })
})
