// Only a presentation timestamp crosses the same-origin OIDC page handoff.
// Keep this key aligned with the small head script in the Keycloak layout.
const MOTION_START_KEY = 'hr-axis-login-entrance-start'
let documentStartedAt: number | undefined

export function prepareLoginEntrance(element: HTMLElement) {
  documentStartedAt ??= Date.now()
  try {
    sessionStorage.setItem(MOTION_START_KEY, String(documentStartedAt))
  } catch {
    // Storage restrictions must never prevent sign-in or hide its form.
  }
  const elapsed = Math.min(2000, Math.max(0, Date.now() - documentStartedAt))
  element.style.setProperty('--login-motion-offset', `-${elapsed}ms`)
}
