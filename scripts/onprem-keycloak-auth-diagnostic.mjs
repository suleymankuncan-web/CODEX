// Exact child-process failures only: never forward response bodies, URLs, or credentials.
const STATIC_FAILURES = new Map([
  ['Keycloak browser title does not match Axis Lufian', 'browser-title'],
  ['Keycloak browser icon is missing', 'browser-icon-missing'],
  ['Keycloak browser icon escaped the approved theme resource', 'browser-icon-path'],
  ['Keycloak browser icon does not match the original logo', 'browser-icon-content'],
  ['Keycloak login form was not rendered', 'login-form-missing'],
  ['Keycloak login form action escaped the approved local host', 'login-form-action'],
  ['OIDC state did not round-trip', 'oidc-state'],
  ['OIDC redirect escaped the approved local host', 'oidc-redirect-host'],
  ['OIDC redirect chain exceeded the bounded limit', 'oidc-redirect-limit'],
  ['OIDC token response omitted access_token', 'token-missing'],
  ['OIDC access token contract is malformed', 'token-malformed'],
  ['OIDC access token issuer contract failed', 'token-issuer'],
  ['OIDC access token audience contract failed', 'token-audience'],
  ['OIDC access token authorized-party contract failed', 'token-authorized-party'],
  ['OIDC access token canonical basic scope contract failed', 'token-basic-scope'],
  ['OIDC access token subject contract failed', 'token-subject'],
  ['OIDC access token role contract failed', 'token-role'],
  ['PAR reference contract failed', 'pushed-authorization-reference'],
  ['browser-session response omitted CSRF nonce', 'browser-session-csrf'],
  ['authorization request timed out', 'authorization-timeout'],
  ['authorization response exceeds the bounded limit', 'authorization-response-limit'],
  ['authorization request body exceeds the bounded limit', 'authorization-request-limit'],
])
const AUTHORIZATION_CATEGORIES = /^(?:malformed-authorization-redirect|redirect-escaped-approved-host|scope-rejected|authorization-request-rejected|client-rejected|authorization-callback-error|unexpected-authorization-(?:redirect|response)(?:-[1-5][0-9]{2})?)$/
const LOGIN_CATEGORIES = /^(?:credentials-rejected|authorization-request-rejected|callback-returned-without-observed-code|application-login-returned|login-form-error|login-form-returned-without-code|unexpected-login-response(?:-[1-5][0-9]{2})?)$/
const SESSION_CATEGORIES = /^(?:invalid-jwt|account-not-mapped|no-active-role-assignment|account-inactive|subject-missing|unauthorized|authorization-context-unavailable|unexpected-browser-session-response(?:-[1-5][0-9]{2})?)$/

export function parseSafeAuthProofFailure(line) {
  const prefix = 'on-prem Keycloak auth proof: '
  if (typeof line !== 'string' || !line.startsWith(prefix) || /[\r\n]/.test(line)) return null
  const message = line.slice(prefix.length)
  const known = STATIC_FAILURES.get(message)
  if (known) return known
  const token = /^OIDC token exchange returned ([1-5][0-9]{2})$/.exec(message)
  if (token) return `token-exchange-${token[1]}`
  for (const [pattern, allowed, phase] of [
    [/^authorization endpoint rejected request \(([^()]+)\)$/, AUTHORIZATION_CATEGORIES, 'authorization-entry'],
    [/^Keycloak login did not return an authorization code \(([^()]+)\)$/, LOGIN_CATEGORIES, 'login-code'],
    [/^browser-session creation failed \(([^()]+)\)$/, SESSION_CATEGORIES, 'browser-session-create'],
  ]) {
    const match = pattern.exec(message)
    if (match && allowed.test(match[1])) return `${phase}-${match[1]}`
  }
  return null
}
