import { sha256, stableJson } from './release-stage-proof.mjs'

export const PINNED_NODE_IMAGE =
  'node:24-trixie-slim@sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d'

const DIGEST_RE = /^[a-f0-9]{64}$/u

function fail(message) {
  throw new Error(message)
}

function runChecked(commandRunner, command, args, { cwd, env }) {
  const result = commandRunner(command, args, { cwd, env })
  if (result.status !== 0) fail(`command failed: ${command}`)
  return result.stdout ?? ''
}

function parseJsonCommand(commandRunner, command, args, options) {
  const text = runChecked(commandRunner, command, args, options).trim()
  try {
    return JSON.parse(text)
  } catch {
    fail(`command returned invalid JSON: ${command}`)
  }
}

export function buildLinuxProofDockerArgs(archivePath, archiveSha256) {
  if (typeof archivePath !== 'string' || archivePath.length === 0 || archivePath.includes('\0')) {
    fail('archive path is invalid')
  }
  if (typeof archiveSha256 !== 'string' || !DIGEST_RE.test(archiveSha256)) {
    fail('archive SHA-256 digest must be a 64-character lowercase SHA-256 digest')
  }
  const script = [
    'set -eu',
    'archive_sha="$(sha256sum /input/onprem-source.tar | cut -d " " -f 1)"',
    'test "$archive_sha" = "$ONPREM_ARCHIVE_SHA256" || { echo "proof source archive digest mismatch" >&2; exit 1; }',
    'mkdir -p /workspace /tmp /var/lib',
    'tar -xf /input/onprem-source.tar -C /workspace',
    'cd /workspace',
    'npm run test:onprem',
    'npm run test:onprem:offline',
  ].join('\n')
  return [
    'run',
    '--pull=never',
    '--rm',
    '--interactive',
    '--read-only',
    '--network',
    'none',
    '--cap-drop',
    'ALL',
    '--cap-add',
    'CHOWN',
    '--cap-add',
    'SETUID',
    '--cap-add',
    'SETGID',
    '--security-opt',
    'no-new-privileges',
    '--tmpfs',
    '/workspace:rw,nosuid,nodev,size=512m,mode=0755',
    '--tmpfs',
    '/tmp:rw,nosuid,nodev,size=512m,mode=0700',
    '--tmpfs',
    '/test-tmp:rw,nosuid,nodev,exec,size=512m,mode=0700',
    '--tmpfs',
    '/var/lib:rw,nosuid,nodev,size=512m,mode=0755',
    '--env',
    'TMPDIR=/test-tmp',
    '--env',
    `ONPREM_ARCHIVE_SHA256=${archiveSha256}`,
    '--volume',
    `${archivePath}:/input/onprem-source.tar:ro`,
    PINNED_NODE_IMAGE,
    'sh',
    '-ec',
    script,
  ]
}

export function collectDockerIdentityWithRunner(workspaceRoot, { commandRunner, env }) {
  const runOptions = { cwd: workspaceRoot, env }
  const server = parseJsonCommand(commandRunner, 'docker', ['version', '--format', '{{json .Server}}'], runOptions)
  if (server?.Os !== 'linux' || !['amd64', 'x86_64'].includes(server?.Arch)) fail('Docker daemon must be Linux amd64')
  const info = parseJsonCommand(commandRunner, 'docker', ['info', '--format', '{{json .}}'], runOptions)
  const image = parseJsonCommand(commandRunner, 'docker', ['image', 'inspect', PINNED_NODE_IMAGE, '--format', '{{json .}}'], runOptions)
  if (
    image?.Os !== 'linux' ||
    !['amd64', 'x86_64'].includes(image?.Architecture) ||
    image?.Id !== `sha256:${PINNED_NODE_IMAGE.slice(PINNED_NODE_IMAGE.indexOf('@sha256:') + 8)}` ||
    !Array.isArray(image?.RepoDigests) ||
    !image.RepoDigests.includes(`node@${PINNED_NODE_IMAGE.slice(PINNED_NODE_IMAGE.indexOf('@') + 1)}`)
  ) fail('pinned Linux proof image is unavailable or mismatched')

  const composeVersion = runChecked(commandRunner, 'docker', ['compose', 'version', '--short'], runOptions).trim()
  const buildxVersion = runChecked(commandRunner, 'docker', ['buildx', 'version'], runOptions).trim()
  if (!buildxVersion || buildxVersion.includes('\n') || buildxVersion.length > 512) fail('Docker buildx identity is invalid')
  const context = runChecked(commandRunner, 'docker', ['context', 'show'], runOptions).trim()
  if (!context || context.includes('\n') || context.length > 128) fail('Docker context identity is invalid')
  const endpoint = parseJsonCommand(
    commandRunner,
    'docker',
    ['context', 'inspect', context, '--format', '{{json .Endpoints.docker.Host}}'],
    runOptions,
  )
  const approvedEndpoint =
    endpoint === 'npipe:////./pipe/dockerDesktopLinuxEngine' ||
    endpoint === 'unix:///var/run/docker.sock' ||
    endpoint === 'unix:///run/docker.sock' ||
    (typeof endpoint === 'string' && /^unix:\/\/\/run\/user\/\d+\/docker\.sock$/u.test(endpoint))
  if (!approvedEndpoint) fail('Docker endpoint is not an approved local Docker socket')

  const stableIdentity = {
    server: {
      apiVersion: server.ApiVersion,
      minApiVersion: server.MinAPIVersion,
      version: server.Version,
      os: server.Os,
      arch: server.Arch,
      gitCommit: server.GitCommit,
    },
    info: {
      id: info.ID,
      serverVersion: info.ServerVersion,
      osType: info.OSType,
      architecture: info.Architecture,
      kernelVersion: info.KernelVersion,
      driver: info.Driver,
    },
    composeVersion,
    buildxVersion,
    context,
    endpoint,
  }
  return {
    identityDigest: sha256(stableJson(stableIdentity)),
    serverVersion: String(server.Version ?? info.ServerVersion ?? ''),
    serverOs: 'linux',
    serverArch: ['amd64', 'x86_64'].includes(server.Arch) ? 'amd64' : server.Arch,
    composeVersion,
    buildxVersion,
    context,
    endpoint,
    nodeImage: { reference: PINNED_NODE_IMAGE, configImageId: image.Id },
  }
}
