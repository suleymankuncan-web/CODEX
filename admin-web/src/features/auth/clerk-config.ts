export function isClerkAuthEnabled() {
  return (import.meta.env.VITE_AUTH_PROVIDER ?? '').trim().toLowerCase() === 'clerk'
}

export function isClerkSessionProviderAvailable() {
  return isClerkAuthEnabled() && Boolean(resolveClerkPublishableKey())
}

export function resolveClerkPublishableKey() {
  return (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim()
}
