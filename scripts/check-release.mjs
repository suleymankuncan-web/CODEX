import { join } from 'node:path'

import { runCanonicalRelease } from './release-stage-runner.mjs'

const supportedArguments = new Set(['--resume'])
const argumentsList = process.argv.slice(2)
const unknownArguments = argumentsList.filter((argument) => !supportedArguments.has(argument))

if (unknownArguments.length > 0) {
  throw new Error(`Unsupported release arguments: ${unknownArguments.join(', ')}`)
}

await runCanonicalRelease({
  workspaceRoot: join(import.meta.dirname, '..'),
  resume: argumentsList.includes('--resume'),
})
