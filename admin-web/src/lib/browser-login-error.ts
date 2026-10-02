// These failures need a fresh login after site settings are corrected. Replaying
// an already exchanged authorization code cannot repair storage or cookies.
export class BrowserLoginUnavailableError extends Error {
  readonly kind: 'storage' | 'cookie'
  constructor(kind: 'storage' | 'cookie') {
    super(`Browser login ${kind} unavailable`)
    this.kind = kind
  }
}
