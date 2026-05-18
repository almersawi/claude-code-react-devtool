import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Toolbar } from '../../../src/component/Toolbar'

describe('Toolbar', () => {
  it('renders Pick Component and Screenshot buttons', () => {
    const { getByRole, queryByRole } = render(
      <Toolbar
        onScreenshotRequest={vi.fn()}
        pickerActive="none"
        setPickerActive={vi.fn()}
      />,
    )
    expect(getByRole('button', { name: /pick component/i })).toBeInTheDocument()
    expect(getByRole('button', { name: /screenshot/i })).toBeInTheDocument()
    // No DOM picker, no Route button.
    expect(queryByRole('button', { name: /^dom$/i })).toBeNull()
    expect(queryByRole('button', { name: /route/i })).toBeNull()
  })

  it('clicks "Pick Component" → setPickerActive("component")', () => {
    const setPickerActive = vi.fn()
    const { getByRole } = render(
      <Toolbar onScreenshotRequest={vi.fn()}
        pickerActive="none" setPickerActive={setPickerActive} />,
    )
    fireEvent.click(getByRole('button', { name: /pick component/i }))
    expect(setPickerActive).toHaveBeenCalledWith('component')
  })

  it('clicks "Screenshot" calls onScreenshotRequest', () => {
    const onScreenshotRequest = vi.fn()
    const { getByRole } = render(
      <Toolbar onScreenshotRequest={onScreenshotRequest}
        pickerActive="none" setPickerActive={vi.fn()} />,
    )
    fireEvent.click(getByRole('button', { name: /screenshot/i }))
    expect(onScreenshotRequest).toHaveBeenCalled()
  })
})
