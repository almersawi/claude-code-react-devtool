import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Toolbar } from '../../../src/component/Toolbar'

describe('Toolbar', () => {
  it('renders four buttons', () => {
    const { getByRole } = render(
      <Toolbar
        onInject={vi.fn()}
        onScreenshotRequest={vi.fn()}
        pickerActive="none"
        setPickerActive={vi.fn()}
      />,
    )
    expect(getByRole('button', { name: /pick/i })).toBeInTheDocument()
    expect(getByRole('button', { name: /dom/i })).toBeInTheDocument()
    expect(getByRole('button', { name: /route/i })).toBeInTheDocument()
    expect(getByRole('button', { name: /screenshot/i })).toBeInTheDocument()
  })

  it('clicks "Pick" → setPickerActive("component")', () => {
    const setPickerActive = vi.fn()
    const { getByRole } = render(
      <Toolbar onInject={vi.fn()} onScreenshotRequest={vi.fn()}
        pickerActive="none" setPickerActive={setPickerActive} />,
    )
    fireEvent.click(getByRole('button', { name: /pick/i }))
    expect(setPickerActive).toHaveBeenCalledWith('component')
  })

  it('clicks "Route" injects current pathname tag', () => {
    const onInject = vi.fn()
    window.history.replaceState({}, '', '/dashboard')
    const { getByRole } = render(
      <Toolbar onInject={onInject} onScreenshotRequest={vi.fn()}
        pickerActive="none" setPickerActive={vi.fn()} />,
    )
    fireEvent.click(getByRole('button', { name: /route/i }))
    expect(onInject).toHaveBeenCalledWith('[route: /dashboard] ')
  })

  it('clicks "Screenshot" calls onScreenshotRequest', () => {
    const onScreenshotRequest = vi.fn()
    const { getByRole } = render(
      <Toolbar onInject={vi.fn()} onScreenshotRequest={onScreenshotRequest}
        pickerActive="none" setPickerActive={vi.fn()} />,
    )
    fireEvent.click(getByRole('button', { name: /screenshot/i }))
    expect(onScreenshotRequest).toHaveBeenCalled()
  })
})
