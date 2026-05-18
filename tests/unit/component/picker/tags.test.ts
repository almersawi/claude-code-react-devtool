import { describe, it, expect } from 'vitest'
import { componentTag, elementTag, routeTag, screenshotTag } from '../../../../src/component/picker/tags'

describe('tag formatters', () => {
  it('componentTag with source', () => {
    expect(componentTag({ name: 'Button', file: 'src/components/Button.tsx', line: 42 }))
      .toBe('[component: <Button> @ src/components/Button.tsx:42] ')
  })

  it('componentTag without source', () => {
    expect(componentTag({ name: 'Button' })).toBe('[component: <Button>] ')
  })

  it('elementTag with classes and id and source', () => {
    expect(
      elementTag({ tag: 'button', id: 'submit', classes: ['cta', 'primary'], component: { name: 'Login', file: 'src/Login.tsx', line: 88 } }),
    ).toBe('[element: <button class="cta primary" id="submit"> @ src/Login.tsx:88] ')
  })

  it('elementTag minimal', () => {
    expect(elementTag({ tag: 'div', id: null, classes: [], component: null })).toBe('[element: <div>] ')
  })

  it('routeTag without component', () => {
    expect(routeTag({ pathname: '/dashboard' })).toBe('[route: /dashboard] ')
  })

  it('routeTag with matched component', () => {
    expect(routeTag({ pathname: '/dashboard', file: 'src/pages/Dashboard.tsx' }))
      .toBe('[route: /dashboard @ src/pages/Dashboard.tsx] ')
  })

  it('screenshotTag', () => {
    expect(screenshotTag('.claude-code-devtool/screenshots/a.png'))
      .toBe('[screenshot: .claude-code-devtool/screenshots/a.png] ')
  })
})
