import type { RouteInfo } from './picker/tags'

export function detectRoute(): RouteInfo {
  return { pathname: window.location.pathname }
}
