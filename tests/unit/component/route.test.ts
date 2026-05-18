import { describe, it, expect, beforeEach } from 'vitest'
import { detectRoute } from '../../../src/component/route'

describe('detectRoute', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/dashboard/settings')
  })

  it('returns the current pathname', () => {
    expect(detectRoute()).toEqual({ pathname: '/dashboard/settings' })
  })

  it('returns "/" when at root', () => {
    window.history.replaceState({}, '', '/')
    expect(detectRoute()).toEqual({ pathname: '/' })
  })
})
