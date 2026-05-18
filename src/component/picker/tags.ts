import type { ComponentInfo } from './fiber'

export function componentTag(c: ComponentInfo): string {
  const loc = c.file ? ` @ ${c.file}${c.line ? ':' + c.line : ''}` : ''
  return `[component: <${c.name}>${loc}] `
}

export interface ElementInfo {
  tag: string
  id: string | null
  classes: string[]
  component: ComponentInfo | null
}

export function elementTag(e: ElementInfo): string {
  const parts: string[] = [e.tag]
  if (e.classes.length) parts.push(`class="${e.classes.join(' ')}"`)
  if (e.id) parts.push(`id="${e.id}"`)
  const inner = parts.join(' ')
  const loc = e.component?.file ? ` @ ${e.component.file}${e.component.line ? ':' + e.component.line : ''}` : ''
  return `[element: <${inner}>${loc}] `
}

export interface RouteInfo {
  pathname: string
  file?: string
}

export function routeTag(r: RouteInfo): string {
  const loc = r.file ? ` @ ${r.file}` : ''
  return `[route: ${r.pathname}${loc}] `
}

export function screenshotTag(relPath: string): string {
  return `[screenshot: ${relPath}] `
}
