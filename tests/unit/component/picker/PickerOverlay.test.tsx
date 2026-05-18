import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { PickerOverlay } from '../../../../src/component/picker/PickerOverlay'

describe('PickerOverlay', () => {
  it('calls onPick with the clicked element', () => {
    const target = document.createElement('button')
    target.textContent = 'go'
    document.body.appendChild(target)

    const onPick = vi.fn()
    const onCancel = vi.fn()
    render(<PickerOverlay onPick={onPick} onCancel={onCancel} />)

    fireEvent.click(target)
    expect(onPick).toHaveBeenCalledWith(target)
    document.body.removeChild(target)
  })

  it('calls onCancel on Escape', () => {
    const onPick = vi.fn()
    const onCancel = vi.fn()
    render(<PickerOverlay onPick={onPick} onCancel={onCancel} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('ignores clicks inside elements marked data-ccdt-ignore', () => {
    const panel = document.createElement('div')
    panel.setAttribute('data-ccdt-ignore', '')
    const inner = document.createElement('span')
    panel.appendChild(inner)
    document.body.appendChild(panel)

    const onPick = vi.fn()
    const onCancel = vi.fn()
    render(<PickerOverlay onPick={onPick} onCancel={onCancel} />)

    fireEvent.click(inner)
    expect(onPick).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
    document.body.removeChild(panel)
  })
})
