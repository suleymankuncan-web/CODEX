import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function deleteSyntheticVolumes({
  confirmed,
  execFileSyncImpl = execFileSync,
  project,
  releaseId,
}) {
  if (!confirmed || project !== 'hr-axis-onprem-core' || !releaseId || !/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(releaseId)) {
    throw new Error('exact --project, --release-id, and --confirm-delete-synthetic-volumes are required')
  }

  const expected = new Map([
    [`${project}_postgres_data`, 'postgres'],
    [`${project}_redis_data`, 'redis-aof'],
  ])
  for (const [volume, volumeClass] of expected) {
    const inspect = JSON.parse(execFileSyncImpl('docker', ['volume', 'inspect', volume], { encoding: 'utf8' }))[0]
    const labels = inspect.Labels ?? {}
    if (inspect.Name !== volume || labels['com.hr-axis.project'] !== project || labels['com.hr-axis.data-class'] !== 'synthetic' || labels['com.hr-axis.release-id'] !== releaseId || labels['com.hr-axis.volume-class'] !== volumeClass) {
      throw new Error(`refusing volume deletion after exact identity mismatch: ${volume}`)
    }
  }

  const containerIds = execFileSyncImpl('docker', ['ps', '--all', '--quiet'], { encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
  const containers = containerIds.length === 0
    ? []
    : JSON.parse(execFileSyncImpl('docker', ['inspect', ...containerIds], { encoding: 'utf8' }))
  const referenced = new Set(
    containers.flatMap((container) =>
      (container.Mounts ?? []).map((mount) => mount.Name).filter(Boolean),
    ),
  )
  const inUse = [...expected.keys()].filter((volume) => referenced.has(volume))
  if (inUse.length > 0) {
    throw new Error('refusing volume deletion while an expected volume is referenced by a container')
  }

  execFileSyncImpl('docker', ['volume', 'rm', ...expected.keys()], { stdio: 'inherit' })
}

export function parseArgs(argv) {
  const valueOptions = new Map([
    ['--project', 'project'],
    ['--release-id', 'releaseId'],
  ])
  const confirmation = '--confirm-delete-synthetic-volumes'
  const parsed = {}
  const seen = new Set()

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (seen.has(argument)) throw new Error(`${argument} must be supplied exactly once`)
    if (argument === confirmation) {
      seen.add(argument)
      continue
    }
    const property = valueOptions.get(argument)
    if (!property) throw new Error(`unknown destructive volume deletion argument: ${argument}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`)
    seen.add(argument)
    parsed[property] = value
    index += 1
  }

  for (const required of [...valueOptions.keys(), confirmation]) {
    if (!seen.has(required)) throw new Error(`${required} must be supplied exactly once`)
  }
  return { confirmed: true, project: parsed.project, releaseId: parsed.releaseId }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    deleteSyntheticVolumes(parseArgs(process.argv.slice(2)))
  } catch (error) {
    console.error(`on-prem core volume deletion refused: ${error.message}`)
    process.exitCode = 2
  }
}
