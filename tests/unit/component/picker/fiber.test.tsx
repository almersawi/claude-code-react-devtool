import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { findComponentForNode, findFiberKey } from '../../../../src/component/picker/fiber'

function Hello({ children }: { children?: React.ReactNode }) {
  return <div data-testid="hello">{children}</div>
}
Hello.displayName = 'Hello'

function Inner() { return <span data-testid="inner">x</span> }

describe('fiber walker', () => {
  it('finds the fiber key on a host node', () => {
    const { getByTestId } = render(<Hello><span data-testid="x">y</span></Hello>)
    const key = findFiberKey(getByTestId('x'))
    expect(key).toMatch(/^__reactFiber\$/)
  })

  it('returns nearest function component name and undefined source if not instrumented', () => {
    const { getByTestId } = render(<Hello><Inner /></Hello>)
    const info = findComponentForNode(getByTestId('inner'))
    expect(info?.name).toBe('Inner')
  })

  it('walks up to outer component when the target is a host child of inner', () => {
    const { getByTestId } = render(<Hello><Inner /></Hello>)
    const info = findComponentForNode(getByTestId('hello'))
    expect(info?.name).toBe('Hello')
  })

  it('returns null when given a detached node', () => {
    const div = document.createElement('div')
    expect(findComponentForNode(div)).toBeNull()
  })
})
