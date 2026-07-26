import { spawn } from 'node:child_process'

const port = /^\d{4,5}$/.test(process.argv[2] || '') ? process.argv[2] : '5173'
const stagingOrigin = 'https://staging.hr-axis.com'

async function discoverPublicClerkKey() {
  const configuredKey = String(process.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim()
  if (/^pk_(test|live)_/.test(configuredKey)) {
    return configuredKey
  }

  const pending = [stagingOrigin]
  const visited = new Set()

  while (pending.length > 0 && visited.size < 80) {
    const url = pending.shift()
    if (!url || visited.has(url)) continue
    visited.add(url)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Workshop auth discovery failed (${response.status})`)
    }

    const source = await response.text()
    const key = source.match(/pk_(?:test|live)_[A-Za-z0-9_-]+/)?.[0]
    if (key) return key

    const assetPattern = /(?:src|href|["'])(\/?assets\/[A-Za-z0-9_.-]+\.js)(?:["'])/g
    for (const match of source.matchAll(assetPattern)) {
      pending.push(new URL(match[1], stagingOrigin).toString())
    }
  }

  throw new Error('Workshop auth discovery could not find the public Clerk key')
}

const clerkPublishableKey = await discoverPublicClerkKey()
const child = spawn(
  process.env.ComSpec || 'cmd.exe',
  ['/d', '/s', '/c', `npm.cmd run dev -- --host 127.0.0.1 --port ${port} --strictPort`],
  {
    env: {
      ...process.env,
      VITE_API_BASE_URL: '/api',
      VITE_AUTH_PROVIDER: 'clerk',
      VITE_CLERK_JWT_TEMPLATE: 'hr-axis-api',
      VITE_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
      VITE_SENTRY_ENABLED: 'false',
      HR_AXIS_VITE_API_PROXY_TARGET: 'https://api-staging.hr-axis.com',
      HR_AXIS_VITE_PROXY_ORIGIN: stagingOrigin,
      HR_AXIS_VITE_PROXY_READ_ONLY: 'true',
    },
    stdio: 'inherit',
  },
)

child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})
