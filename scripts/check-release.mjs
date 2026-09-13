import { join } from 'node:path'

import { runCanonicalRelease } from './release-stage-runner.mjs'
import { collectRecoveryPlan } from './test-status.mjs'

const supportedArguments = new Set(['--resume', '--plan'])
const argumentsList = process.argv.slice(2)
const unknownArguments = argumentsList.filter((argument) => !supportedArguments.has(argument))

if (unknownArguments.length > 0) {
  throw new Error(`Unsupported release arguments: ${unknownArguments.join(', ')}`)
}

if (argumentsList.includes('--plan')) {
  for (const stage of collectRecoveryPlan(join(import.meta.dirname, '..'))) {
    console.log(stage.action.toUpperCase() + ' ' + stage.stage + ': ' + stage.reason)
  }
  console.log('E2E spec selection is decided after current build and actual test inventory verification.')
} else await runCanonicalRelease({
  workspaceRoot: join(import.meta.dirname, '..'),
  resume: argumentsList.includes('--resume'),
})
