import { describe, it, expect } from 'vitest'
import { isClientMsg, isServerMsg } from '../../../src/shared/protocol'

describe('protocol type guards', () => {
  it('isClientMsg accepts every valid client message type', () => {
    expect(isClientMsg({ type: 'input', data: 'x' })).toBe(true)
    expect(isClientMsg({ type: 'resize', cols: 80, rows: 24 })).toBe(true)
    expect(isClientMsg({ type: 'screenshot', png: 'abc', meta: { width: 1, height: 1 } })).toBe(true)
    expect(isClientMsg({ type: 'restart' })).toBe(true)
  })

  it('isClientMsg rejects malformed input', () => {
    expect(isClientMsg(null)).toBe(false)
    expect(isClientMsg({})).toBe(false)
    expect(isClientMsg({ type: 'bogus' })).toBe(false)
    expect(isClientMsg({ type: 'input' })).toBe(false)
    expect(isClientMsg({ type: 'resize', cols: '80', rows: 24 })).toBe(false)
  })

  it('isServerMsg accepts every valid server message type', () => {
    expect(isServerMsg({ type: 'hello', sessionId: 's', cwd: '/', cols: 80, rows: 24 })).toBe(true)
    expect(isServerMsg({ type: 'output', data: 'x' })).toBe(true)
    expect(isServerMsg({ type: 'screenshot-saved', path: 'a.png' })).toBe(true)
    expect(isServerMsg({ type: 'error', message: 'oops' })).toBe(true)
    expect(isServerMsg({ type: 'exit', code: 0 })).toBe(true)
  })

  it('isServerMsg rejects malformed input', () => {
    expect(isServerMsg({ type: 'hello' })).toBe(false)
    expect(isServerMsg({ type: 'output', data: 5 })).toBe(false)
  })
})
