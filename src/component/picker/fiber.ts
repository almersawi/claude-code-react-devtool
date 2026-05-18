export interface ComponentInfo {
  name: string
  file?: string
  line?: number
  /** React `key` if set on the component element. */
  key?: string
  /** Distinguishing primitive props (string/number/boolean), truncated. */
  props?: Record<string, string | number | boolean>
  /** Visible text content of the picked DOM element, normalised + truncated. */
  text?: string
}

export function findFiberKey(node: Element): string | null {
  for (const k of Object.keys(node)) {
    if (k.startsWith('__reactFiber$')) return k
  }
  return null
}

interface DebugSource { fileName: string; lineNumber: number }

interface Fiber {
  type: unknown
  key: string | number | null
  return: Fiber | null
  _debugSource?: DebugSource | null
  _debugOwner?: Fiber | null
  memoizedProps?: Record<string, unknown> | null
  pendingProps?: Record<string, unknown> | null
  stateNode?: unknown
}

function fiberOf(node: Element): Fiber | null {
  const key = findFiberKey(node)
  if (!key) return null
  return (node as unknown as Record<string, Fiber>)[key] ?? null
}

function isComponentType(t: unknown): boolean {
  if (typeof t === 'function') return true
  if (typeof t === 'object' && t !== null) {
    const obj = t as Record<string, unknown>
    if ('render' in obj || 'type' in obj || '$$typeof' in obj) return true
  }
  return false
}

function typeName(t: unknown): string | null {
  if (typeof t === 'function') {
    const fn = t as { displayName?: string; name?: string }
    return fn.displayName || fn.name || null
  }
  if (typeof t === 'object' && t !== null) {
    const o = t as { displayName?: string; type?: { displayName?: string; name?: string }; render?: { displayName?: string; name?: string } }
    if (o.displayName) return o.displayName
    if (o.type) return typeName(o.type)
    if (o.render) return typeName(o.render)
  }
  return null
}

function getDebugSource(fiber: Fiber): DebugSource | null {
  const direct = fiber._debugSource
  if (direct?.fileName) return direct
  const mp = (fiber.memoizedProps as { __source?: DebugSource } | undefined)?.__source
  if (mp?.fileName) return mp
  const pp = (fiber.pendingProps as { __source?: DebugSource } | undefined)?.__source
  if (pp?.fileName) return pp
  return null
}

function isUserSource(file: string | undefined): boolean {
  if (!file) return false
  if (file.includes('/node_modules/')) return false
  if (file.startsWith('virtual:')) return false
  if (file.includes('?v=') && file.includes('.vite/deps/')) return false
  return true
}

const SKIP_PROPS = new Set(['children', '__source', '__self', 'ref', 'key', 'style', 'className'])
const MAX_PROP_VALUE_LEN = 40
const MAX_PROPS = 6

function distinguishingProps(fiber: Fiber): Record<string, string | number | boolean> {
  const raw = (fiber.memoizedProps || fiber.pendingProps || {}) as Record<string, unknown>
  const out: Record<string, string | number | boolean> = {}
  let count = 0
  for (const [k, v] of Object.entries(raw)) {
    if (count >= MAX_PROPS) break
    if (SKIP_PROPS.has(k)) continue
    if (typeof v === 'string') {
      out[k] = v.length > MAX_PROP_VALUE_LEN ? v.slice(0, MAX_PROP_VALUE_LEN) + '…' : v
      count++
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
      count++
    }
  }
  return out
}

function visibleText(node: Element): string | undefined {
  const raw = (node as HTMLElement).textContent
  if (!raw) return undefined
  const norm = raw.replace(/\s+/g, ' ').trim()
  if (!norm) return undefined
  return norm.length > 80 ? norm.slice(0, 80) + '…' : norm
}

function buildInfo(fiber: Fiber, node: Element, name: string, src: DebugSource | null): ComponentInfo {
  const info: ComponentInfo = { name }
  if (src) { info.file = src.fileName; info.line = src.lineNumber }
  if (fiber.key !== null && fiber.key !== undefined) info.key = String(fiber.key)
  const props = distinguishingProps(fiber)
  if (Object.keys(props).length) info.props = props
  const text = visibleText(node)
  if (text) info.text = text
  return info
}

export function findComponentForNode(node: Element): ComponentInfo | null {
  const fiber = fiberOf(node)
  // First pass: nearest user component (has source AND lives in user code).
  let cur = fiber
  while (cur) {
    if (isComponentType(cur.type)) {
      const name = typeName(cur.type)
      const src = getDebugSource(cur)
      if (name && src && isUserSource(src.fileName)) {
        return buildInfo(cur, node, name, src)
      }
    }
    cur = cur.return
  }
  // Fallback: nearest named component, even without source.
  cur = fiber
  while (cur) {
    if (isComponentType(cur.type)) {
      const name = typeName(cur.type)
      if (name) {
        return buildInfo(cur, node, name, getDebugSource(cur))
      }
    }
    cur = cur.return
  }
  return null
}
