import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const VERSION = '1.85'
const MAVEN_ROOT = 'https://repo.maven.apache.org/maven2/org/bouncycastle'

export const BOUNCY_CASTLE_PATCHES = Object.freeze([
  ['bcprov-jdk18on', '20af26bf6060bb8005cc2389916812c1e0e998dc48d2ced7131b89461b54cff7'],
  ['bcpkix-jdk18on', 'c9f82b2d4e99c4bbdfccf684e52cc06ea06a0b567bfd0d08f9c5a3f417055996'],
  ['bcutil-jdk18on', '590f55ed5d68529239898a4a5c4f730b6e37f45d1cfa3fbe51f8485abe32c42d'],
].map(([artifact, sha256]) => Object.freeze({
  artifact,
  sha256,
  url: `${MAVEN_ROOT}/${artifact}/${VERSION}/${artifact}-${VERSION}.jar`,
})))

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function download(url) {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'hr-axis-onprem-image-proof/1.0' },
        redirect: 'follow',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
      if (attempt < 4) await delay(attempt * 1_000)
    }
  }
  throw new Error(`download failed for ${url}: ${lastError?.message ?? 'unknown error'}`)
}

export async function downloadBouncyCastlePatches(outputDirectory = '/patch/bouncycastle') {
  mkdirSync(outputDirectory, { recursive: true, mode: 0o755 })
  for (const artifact of BOUNCY_CASTLE_PATCHES) {
    const body = await download(artifact.url)
    const observed = createHash('sha256').update(body).digest('hex')
    if (observed !== artifact.sha256) {
      throw new Error(`checksum mismatch for ${artifact.artifact}: expected ${artifact.sha256}, observed ${observed}`)
    }
    writeFileSync(`${outputDirectory}/${artifact.artifact}.jar`, body, { mode: 0o644 })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  downloadBouncyCastlePatches().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
