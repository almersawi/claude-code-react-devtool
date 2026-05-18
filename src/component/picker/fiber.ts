export interface ComponentInfo {
  name: string
  file?: string
  line?: number
}

export function findFiberKey(node: Element): string | null {
  for (const k of Object.keys(node)) {
    if (k.startsWith('__reactFiber$')) return k
  }
  return null
}

interface Fiber {
  type: unknown
  return: Fiber | null
  _debugSource?: { fileName: string; lineNumber: number } | null
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

export function findComponentForNode(node: Element): ComponentInfo | null {
  let fiber: Fiber | null = fiberOf(node)
  while (fiber) {
    if (isComponentType(fiber.type)) {
      const name = typeName(fiber.type)
      if (name) {
        const src = fiber._debugSource
        return {
          name,
          file: src?.fileName,
          line: src?.lineNumber,
        }
      }
    }
    fiber = fiber.return
  }
  return null
}
