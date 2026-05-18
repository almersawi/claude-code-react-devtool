import type { ComponentInfo } from './fiber'

function escapeAttr(s: string): string {
  return s.replace(/"/g, '\\"')
}

function renderAttrs(c: ComponentInfo): string {
  const parts: string[] = []
  if (c.key) parts.push(`key="${escapeAttr(c.key)}"`)
  if (c.props) {
    for (const [k, v] of Object.entries(c.props)) {
      if (typeof v === 'string') parts.push(`${k}="${escapeAttr(v)}"`)
      else parts.push(`${k}={${v}}`)
    }
  }
  return parts.length ? ' ' + parts.join(' ') : ''
}

function renderLocation(file?: string, line?: number): string {
  return file ? ` @ ${file}${line ? ':' + line : ''}` : ''
}

function renderText(text?: string): string {
  return text ? ` — "${text.replace(/"/g, '\\"')}"` : ''
}

export function componentTag(c: ComponentInfo): string {
  return `[component: <${c.name}${renderAttrs(c)}>${renderLocation(c.file, c.line)}${renderText(c.text)}] `
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
  const loc = renderLocation(e.component?.file, e.component?.line)
  const text = renderText(e.component?.text)
  return `[element: <${inner}>${loc}${text}] `
}

export interface RouteInfo {
  pathname: string
  file?: string
}

export function routeTag(r: RouteInfo): string {
  return `[route: ${r.pathname}${renderLocation(r.file)}] `
}

export function screenshotTag(relPath: string): string {
  return `[screenshot: ${relPath}] `
}
