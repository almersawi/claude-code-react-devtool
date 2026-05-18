export type ClientMsg =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'screenshot'; png: string; meta: { width: number; height: number } }
  | { type: 'restart' }

export type ServerMsg =
  | { type: 'hello'; sessionId: string; cwd: string; cols: number; rows: number }
  | { type: 'output'; data: string }
  | { type: 'screenshot-saved'; path: string }
  | { type: 'error'; message: string }
  | { type: 'exit'; code: number }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number'

export function isClientMsg(v: unknown): v is ClientMsg {
  if (!isObj(v) || !isStr(v.type)) return false
  switch (v.type) {
    case 'input': return isStr(v.data)
    case 'resize': return isNum(v.cols) && isNum(v.rows)
    case 'screenshot':
      return isStr(v.png) && isObj(v.meta) && isNum(v.meta.width) && isNum(v.meta.height)
    case 'restart': return true
    default: return false
  }
}

export function isServerMsg(v: unknown): v is ServerMsg {
  if (!isObj(v) || !isStr(v.type)) return false
  switch (v.type) {
    case 'hello':
      return isStr(v.sessionId) && isStr(v.cwd) && isNum(v.cols) && isNum(v.rows)
    case 'output': return isStr(v.data)
    case 'screenshot-saved': return isStr(v.path)
    case 'error': return isStr(v.message)
    case 'exit': return isNum(v.code)
    default: return false
  }
}
