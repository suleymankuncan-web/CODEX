import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createPlaywrightManualChunks, resolveModulePreload } from './scripts/playwright-build-profile.mjs'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const apiProxyTarget = process.env.HR_AXIS_VITE_API_PROXY_TARGET?.trim() || 'http://localhost:3000'
const apiProxyOrigin = process.env.HR_AXIS_VITE_PROXY_ORIGIN?.trim()
const apiProxyReadOnly = process.env.HR_AXIS_VITE_PROXY_READ_ONLY === 'true'
const dependencyRoot = realpathSync(path.resolve(projectRoot, './node_modules'))
const modulePreload = resolveModulePreload(process.env)
const manualChunks = createPlaywrightManualChunks(process.env)

const safeWorkshopMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
const workshopSessionPaths = new Set(['/api/auth/browser-session'])

function workshopReadOnlyGuard(): Plugin {
  return {
    name: 'hr-axis-workshop-read-only-guard',
    apply: 'serve',
    configureServer(server) {
      if (!apiProxyReadOnly) return

      server.middlewares.use((request, response, next) => {
        const method = (request.method ?? 'GET').toUpperCase()
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        const isSessionLifecycle = workshopSessionPaths.has(pathname) && (method === 'POST' || method === 'DELETE')

        if (!pathname.startsWith('/api/') || safeWorkshopMethods.has(method) || isSessionLifecycle) {
          next()
          return
        }

        response.statusCode = 405
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: 'workshop_read_only', method, path: pathname }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [workshopReadOnlyGuard(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.unit.test.ts'],
  },
  build: {
    ...(modulePreload === false ? { modulePreload } : {}),
    ...(manualChunks ? { rolldownOptions: { output: { manualChunks } } } : {}),
    sourcemap: false,
  },
  server: {
    fs: {
      allow: [projectRoot, dependencyRoot],
    },
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        ...(apiProxyOrigin ? { cookieDomainRewrite: 'localhost' } : {}),
        configure(proxy) {
          if (!apiProxyOrigin) return

          proxy.on('proxyReq', (proxyRequest) => {
            proxyRequest.setHeader('origin', apiProxyOrigin)
            proxyRequest.setHeader('referer', `${apiProxyOrigin}/`)
          })
        },
      },
    },
  },
})
