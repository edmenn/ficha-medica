import { fireEvent, render, screen } from '@testing-library/react'
import ImageCapture from '@/components/capture/ImageCapture'

describe('ImageCapture', () => {
  it('does not mention PDF and exposes a manual entry action', () => {
    const onImageSelected = vi.fn()
    const onManualEntry = vi.fn()

    render(<ImageCapture onImageSelected={onImageSelected} onManualEntry={onManualEntry} />)

    expect(screen.queryByText(/pdf/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cargar manualmente/i }))

    expect(onManualEntry).toHaveBeenCalledTimes(1)
  })
})
