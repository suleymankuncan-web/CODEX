import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const FREEMARKER_PATCH = Object.freeze({
  version: '2.3.35',
  sha256: '0fac87dddd78f1223139e8ef88e819c7f483c0a3835cdf5982ad5e4576d1d896',
  url: 'https://repo.maven.apache.org/maven2/org/freemarker/freemarker/2.3.35/freemarker-2.3.35.jar',
})

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function downloadFreemarkerPatch(outputDirectory = '/patch/freemarker') {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(FREEMARKER_PATCH.url, {
        headers: { 'user-agent': 'hr-axis-onprem-image-proof/1.0' },
        redirect: 'follow',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = Buffer.from(await response.arrayBuffer())
      const observed = createHash('sha256').update(body).digest('hex')
      if (observed !== FREEMARKER_PATCH.sha256) {
        throw new Error(`checksum mismatch: expected ${FREEMARKER_PATCH.sha256}, observed ${observed}`)
      }
      mkdirSync(outputDirectory, { recursive: true, mode: 0o755 })
      writeFileSync(`${outputDirectory}/freemarker.jar`, body, { mode: 0o644 })
      return
    } catch (error) {
      lastError = error
      if (attempt < 4) await delay(attempt * 1_000)
    }
  }
  throw new Error(`FreeMarker patch download failed: ${lastError?.message ?? 'unknown error'}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  downloadFreemarkerPatch().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
