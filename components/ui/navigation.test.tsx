import { fireEvent, render, screen } from '@testing-library/react'
import BottomNav from '@/components/ui/BottomNav'
import BackToRecordsButton from '@/components/ui/BackToRecordsButton'

const pushMock = vi.fn()
const usePathnameMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => usePathnameMock(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch,
    className,
    children,
  }: {
    href: string
    prefetch?: boolean
    className?: string
    children: React.ReactNode
  }) => (
    <a href={href} data-prefetch={String(prefetch)} className={className}>
      {children}
    </a>
  ),
}))

describe('BackToRecordsButton', () => {
  beforeEach(() => {
    pushMock.mockReset()
  })

  it('navigates to /records instead of relying on browser history', () => {
    render(<BackToRecordsButton />)

    fireEvent.click(screen.getByRole('button', { name: '←' }))

    expect(pushMock).toHaveBeenCalledWith('/records')
  })
})

describe('BottomNav', () => {
  beforeEach(() => {
    usePathnameMock.mockReset()
    usePathnameMock.mockReturnValue('/records')
  })

  it('disables prefetch for bottom navigation routes', () => {
    render(<BottomNav />)

    const links = screen.getAllByRole('link')

    expect(links).not.toHaveLength(0)
    for (const link of links) {
      expect(link).toHaveAttribute('data-prefetch', 'false')
    }
  })
})
