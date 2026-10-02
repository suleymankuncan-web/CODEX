export function axisLoginIconPath(html, host) {
  if (!/<title>\s*Axis Lufian\s*<\/title>/.test(html)) throw new Error('Keycloak browser title does not match Axis Lufian')
  const href = html.match(/<link rel="icon" type="image\/png" href="([^"]+)"/)?.[1]
  if (!href) throw new Error('Keycloak browser icon is missing')
  const icon = new URL(href, `https://${host}`)
  if (icon.protocol !== 'https:' || icon.hostname !== host || icon.port || icon.search || icon.hash ||
    !/^\/resources\/[A-Za-z0-9_-]+\/login\/hr-axis\/img\/axis-lufian-favicon\.png$/.test(icon.pathname)) {
    throw new Error('Keycloak browser icon escaped the approved theme resource')
  }
  return icon.pathname
}

export function assertAxisLoginIcon(response, original) {
  if (response.status !== 200 || !String(response.headers['content-type']).startsWith('image/png') ||
    !Buffer.isBuffer(response.bodyBuffer) || !response.bodyBuffer.equals(original)) {
    throw new Error('Keycloak browser icon does not match the original logo')
  }
}
