import { fireEvent, render, screen } from '@testing-library/react'
import ImageCapture from '@/components/capture/ImageCapture'

function createFile(name: string, type: string) {
  return new File([new ArrayBuffer(8)], name, { type })
}

describe('ImageCapture', () => {
  it('does not mention PDF and exposes a manual entry action', () => {
    const onImageSelected = vi.fn()
    const onManualEntry = vi.fn()

    render(<ImageCapture onImageSelected={onImageSelected} onManualEntry={onManualEntry} />)

    expect(screen.queryByText(/pdf/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cargar manualmente/i }))

    expect(onManualEntry).toHaveBeenCalledTimes(1)
  })

  it('exposes a folder import action', () => {
    const onImageSelected = vi.fn()
    render(<ImageCapture onImageSelected={onImageSelected} />)

    expect(screen.getByRole('button', { name: /importar de una carpeta/i })).toBeInTheDocument()
  })

  it('shows a gallery from the selected folder and picks a single image', () => {
    const onImageSelected = vi.fn()
    render(<ImageCapture onImageSelected={onImageSelected} />)

    const folderInput = screen.getByRole('button', { name: /importar de una carpeta/i })

    Object.defineProperty(HTMLInputElement.prototype, 'webkitdirectory', { value: true, configurable: true })

    const fileInput = document.querySelector('input[webkitdirectory]')
    expect(fileInput).not.toBeNull()

    const files = [createFile('a.png', 'image/png'), createFile('b.jpg', 'image/jpeg'), createFile('c.txt', 'text/plain')]
    Object.defineProperty(fileInput as HTMLInputElement, 'files', {
      value: files as unknown as FileList,
      configurable: true,
    })

    fireEvent.click(folderInput)
    fireEvent.change(fileInput as HTMLInputElement)

    const galleryButtons = screen.getAllByRole('button', { name: /^captura \d/i })
    expect(galleryButtons).toHaveLength(2)

    fireEvent.click(galleryButtons[0])

    expect(onImageSelected).toHaveBeenCalledTimes(1)
    expect(onImageSelected).toHaveBeenCalledWith(files[0])
  })
})
