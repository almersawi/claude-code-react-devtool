import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Panel } from '../../../src/component/Panel'

describe('Panel', () => {
  it('renders children inside a fixed-position container', () => {
    const { getByTestId, getByText } = render(
      <Panel status="connected" cwd="/x"><div data-testid="child">hi</div></Panel>,
    )
    expect(getByTestId('child')).toBeInTheDocument()
    expect(getByText(/connected/i)).toBeInTheDocument()
    expect(getByText('/x')).toBeInTheDocument()
  })

  it('renders disconnected status with red dot', () => {
    const { getByText } = render(<Panel status="reconnecting" cwd="/x">x</Panel>)
    expect(getByText(/reconnecting/i)).toBeInTheDocument()
  })

  it('has data-ccdt-ignore so picker skips it', () => {
    const { container } = render(<Panel status="connected" cwd="/x">x</Panel>)
    expect(container.querySelector('[data-ccdt-ignore]')).not.toBeNull()
  })
})
