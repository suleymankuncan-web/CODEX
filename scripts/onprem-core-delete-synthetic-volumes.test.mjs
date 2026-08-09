import assert from 'node:assert/strict'
import { test } from 'node:test'

import { deleteSyntheticVolumes, parseArgs } from './onprem-core-delete-synthetic-volumes.mjs'

const project = 'hr-axis-onprem-core'
const releaseId = 'synthetic-release-v1'
const volumes = [`${project}_postgres_data`, `${project}_redis_data`]

function volumeInspect(name) {
  return JSON.stringify([{
    Labels: {
      'com.hr-axis.data-class': 'synthetic',
      'com.hr-axis.project': project,
      'com.hr-axis.release-id': releaseId,
      'com.hr-axis.volume-class': name.endsWith('postgres_data') ? 'postgres' : 'redis-aof',
    },
    Name: name,
  }])
}

test('synthetic volume deletion preflights every volume and container before one remove call', () => {
  const calls = []
  const execFileSyncImpl = (_command, args) => {
    calls.push(args)
    if (args[0] === 'volume' && args[1] === 'inspect') return volumeInspect(args[2])
    if (args[0] === 'ps') return ''
    if (args[0] === 'volume' && args[1] === 'rm') return ''
    throw new Error(`unexpected command: ${args.join(' ')}`)
  }

  deleteSyntheticVolumes({ confirmed: true, execFileSyncImpl, project, releaseId })

  assert.deepEqual(calls.at(-1), ['volume', 'rm', ...volumes])
  assert.equal(calls.filter((args) => args[0] === 'volume' && args[1] === 'rm').length, 1)
})

test('an in-use volume refuses before any partial delete is attempted', () => {
  const calls = []
  const execFileSyncImpl = (_command, args) => {
    calls.push(args)
    if (args[0] === 'volume' && args[1] === 'inspect') return volumeInspect(args[2])
    if (args[0] === 'ps') return 'container-one\n'
    if (args[0] === 'inspect') {
      return JSON.stringify([{ Mounts: [{ Name: volumes[1] }] }])
    }
    throw new Error(`unexpected command: ${args.join(' ')}`)
  }

  assert.throws(
    () => deleteSyntheticVolumes({ confirmed: true, execFileSyncImpl, project, releaseId }),
    /referenced by a container/i,
  )
  assert.equal(calls.some((args) => args[0] === 'volume' && args[1] === 'rm'), false)
})

test('destructive CLI parsing requires each exact flag and value once', () => {
  assert.deepEqual(
    parseArgs([
      '--project', project,
      '--release-id', releaseId,
      '--confirm-delete-synthetic-volumes',
    ]),
    { confirmed: true, project, releaseId },
  )

  for (const argv of [
    ['--project', project, '--confirm-delete-synthetic-volumes'],
    ['--project', project, '--release-id', '--confirm-delete-synthetic-volumes'],
    ['--project', project, '--release-id', releaseId],
    ['--project', project, '--project', project, '--release-id', releaseId, '--confirm-delete-synthetic-volumes'],
    ['--project', project, '--release-id', releaseId, '--release-id', releaseId, '--confirm-delete-synthetic-volumes'],
  ]) {
    assert.throws(() => parseArgs(argv), /exactly once|requires a value/i)
  }
})

test('synthetic deletion requires an alphanumeric release identity prefix', () => {
  assert.throws(
    () => deleteSyntheticVolumes({ confirmed: true, execFileSyncImpl: () => '', project, releaseId: '--project' }),
    /exact --project, --release-id/i,
  )
})
