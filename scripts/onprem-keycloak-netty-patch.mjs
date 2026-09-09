import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const VERSION = '4.1.137.Final'
const MAVEN_ROOT = 'https://repo.maven.apache.org/maven2/io/netty'

export const NETTY_PATCHES = Object.freeze([
  ['buffer', 'f474b14c7734f15e0540394cb6f39d67777b7581a42919e4ac89d253d4efd929'],
  ['codec', '9987b6a660b0a6b1f0d791485dae33180b3d1c63687c006fe6d3fd025e9e3798'],
  ['codec-dns', '2d9a33ce41bd9f6f607df95039e42518a1fca16f83c9bbfe72beb57df6e2489f'],
  ['codec-haproxy', '5ffa58b94c5ac48fb7e41843c18acf7a268e90b5b85423987829c9291ce3a5df'],
  ['codec-http', '0535bb5a736472bef5c948d15eb273c4ab9f796656fc7c5d6b982ad92bddbd49'],
  ['codec-http2', '576ddcfb51b78e86f145c9a52b60e500b1a1d5a257cafec8aa5416ffba044b49'],
  ['codec-socks', '4a6190e08988c058bfeef2b5965e71946439c771abf721c68f4039b4e7b023e8'],
  ['common', 'd31926b01adcc07af86f5e27b81b6d6c115df17d366e835d1fc3f5a1924e7e52'],
  ['handler', 'd0e4c6ee4779f59f6ab2fb5d388e4f57147c82270164b37945764bb9bda96a44'],
  ['handler-proxy', '843de10c4cef34cbc1a5344090f1b57db532fbebf141559862da675f6b656df4'],
  ['resolver', 'b4cf2aeedd9fc7c8c439bbfe574f63cfe5b83392e88bbc07ca0e8424b7cff955'],
  ['resolver-dns', '898d63ca62ed68ff46543c5344f969424b417f1e8d082fe2bb0181ba10144194'],
  ['transport', '6251adc2a2921572382732a2db188d4f4f2251fd6ebb49c5d44bbf33d6bfb1a7'],
  ['transport-classes-epoll', '55049554b799dc8e53bf234fffa36e001f7b5b65c32994b9bd59fc6356f1c52f'],
  ['transport-native-unix-common', '8056e7637f9948f953314894cf995ab664711b66c73c4cd5b593ae84f0b1048c'],
].map(([module, sha256]) => Object.freeze({
  module,
  sha256,
  url: `${MAVEN_ROOT}/netty-${module}/${VERSION}/netty-${module}-${VERSION}.jar`,
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

export async function downloadNettyPatches(outputDirectory = '/patch/jars') {
  mkdirSync(outputDirectory, { recursive: true, mode: 0o755 })
  for (const artifact of NETTY_PATCHES) {
    const body = await download(artifact.url)
    const observed = createHash('sha256').update(body).digest('hex')
    if (observed !== artifact.sha256) {
      throw new Error(`checksum mismatch for netty-${artifact.module}: expected ${artifact.sha256}, observed ${observed}`)
    }
    writeFileSync(`${outputDirectory}/netty-${artifact.module}.jar`, body, { mode: 0o644 })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  downloadNettyPatches().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
