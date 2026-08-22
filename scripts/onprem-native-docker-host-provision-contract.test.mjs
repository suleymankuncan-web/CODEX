import assert from 'node:assert/strict'
import test from 'node:test'

import { expectedNativeDockerHostMarker, hostContract } from './onprem-native-docker-host.mjs'
import {
  PROVISION_STAGING_DIRECTORY,
  SAFE_BINARIES,
  detectLegacyDockerd,
  exactLegacyDockerdCommand,
  expectedNativeDockerUnit,
  parseProvisionArguments,
  parseUbuntuRelease,
  proveAndUnmountDirectSelfBind,
  provisionNativeDockerHost,
} from './onprem-native-docker-host-provision.mjs'

const release = 'ID=ubuntu\nVERSION_ID="24.04"\nPRETTY_NAME="Ubuntu 24.04.3 LTS"\n'

function directoryStat(mode = 0o700, uid = 0, gid = 0) {
  return { uid, gid, mode, dev: 8, ino: 100, isDirectory: () => true, isSymbolicLink: () => false }
}

function fakeFs(receiptPath) {
  const files = new Map()
  const writes = []
  const rootPaths = [hostContract.dockerDataRoot, hostContract.dockerExecRoot, hostContract.containerdRoot, hostContract.containerdState]
  return {
    writes,
    lstatSync(target) {
      if (target === receiptPath) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      if (files.has(target)) return files.get(target).stat
      if (rootPaths.includes(target)) return directoryStat()
      if (target === '/var/lib/hr-axis-onprem-rehearsal') return directoryStat(0o755)
      if (target === hostContract.lockDirectory) return directoryStat(0o1770, 0, 123)
      if (target === '/tmp/shared' || target === '/tmp/shared/writable') return directoryStat(0o777, 1000, 123)
      if (target === '/var' || target === '/var/lib' || target === '/run' || target === '/') return directoryStat(0o755)
      throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    },
    realpathSync(target) {
      if (target === '/var/run') return '/run'
      if (target === hostContract.socket) return '/run/docker.sock'
      return target
    },
    writeFileSync(target, content, options = {}) {
      if (options.flag === 'wx' && files.has(target)) throw Object.assign(new Error('exists'), { code: 'EEXIST' })
      const mode = options.mode ?? 0o600
      const isMarker = target === hostContract.marker
      files.set(target, {
        content: String(content),
        stat: isMarker
          ? { uid: 0, gid: 0, mode: 0o644, nlink: 1, isFile: () => true, isSymbolicLink: () => false }
          : { uid: 1000, gid: 123, mode, nlink: 1, isFile: () => true, isSymbolicLink: () => false },
      })
      writes.push({ target, content: String(content), options })
    },
    readFileSync(target) {
      if (!files.has(target)) throw new Error('missing')
      return files.get(target).content
    },
    unlinkSync(target) {
      if (!files.delete(target)) throw new Error('missing')
    },
    chmodSync() {},
  }
}

function baseRunner({ record = [], mountMode = 'none', inspectOrder = [], disableKeepsEnabled = false, dockerServiceInitiallyEnabled = false } = {}) {
  let unmounted = false
  const state = new Map([
    ['docker.service', { active: false, enabled: dockerServiceInitiallyEnabled }],
    ['docker.socket', { active: false, enabled: false }],
    ['containerd.service', { active: true, enabled: true }],
    [hostContract.containerdUnit, { active: false, enabled: false }],
    [hostContract.dockerdUnit, { active: false, enabled: false }],
  ])
  const run = (file, args, options = {}) => {
    record.push({ file, args: [...args], options })
    const executable = file === 'sudo' && args[0] === '-n' ? args[1] : file
    const actualFile = executable.replace(/^.*\//, '')
    const actualArgs = file === 'sudo' && args[0] === '-n' ? args.slice(2) : args
    if (actualFile === 'true') return { status: 0, stdout: '', stderr: '' }
    if (actualFile === 'uname') return { status: 0, stdout: 'Linux\n', stderr: '' }
    if (actualFile === 'cat' && actualArgs[0] === '/etc/os-release') return { status: 0, stdout: release, stderr: '' }
    if (actualFile === 'id' && actualArgs[0] === '-g') return { status: 0, stdout: '123\n', stderr: '' }
    if (actualFile === 'ps') return { status: 0, stdout: '', stderr: '' }
    if (actualFile === 'findmnt') {
      if (mountMode === 'direct' && !unmounted && actualArgs.includes('--mountpoint') && actualArgs.at(-1) === hostContract.dockerDataRoot) {
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: hostContract.dockerDataRoot, source: '/dev/vda1', fstype: 'ext4', fsroot: hostContract.dockerDataRoot }] }), stderr: '' }
      }
      if (mountMode === 'foreign' && actualArgs.includes('--mountpoint') && actualArgs.at(-1) === hostContract.dockerDataRoot) {
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: hostContract.dockerDataRoot, source: '/dev/vdb1', fstype: 'ext4', fsroot: '/foreign' }] }), stderr: '' }
      }
      if (mountMode === 'nested' && actualArgs.at(-1) === '/') {
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: '/', source: '/dev/vda1', fstype: 'ext4', fsroot: '/' }, { target: `${hostContract.dockerDataRoot}/nested`, source: '/dev/vdb1', fstype: 'ext4', fsroot: '/' }] }), stderr: '' }
      }
      if (actualArgs.includes('--json') && actualArgs.includes('--submounts') && actualArgs.at(-1) === '/') {
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: '/', source: '/dev/vda1', fstype: 'ext4', fsroot: '/' }] }), stderr: '' }
      }
      if (actualArgs.includes('--mountpoint') && actualArgs.at(-1) === '/') {
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: '/', source: '/dev/vda1', fstype: 'ext4', fsroot: '/' }] }), stderr: '' }
      }
      return { status: 1, stdout: '', stderr: '' }
    }
    if (actualFile === 'umount') {
      unmounted = true
      inspectOrder.push('umount')
      return { status: 0, stdout: '', stderr: '' }
    }
    if (actualFile === 'stat') {
      const target = actualArgs.at(-1)
      if (target === PROVISION_STAGING_DIRECTORY) return { status: 0, stdout: 'directory 0 0 700\n', stderr: '' }
      if (target?.startsWith(`${PROVISION_STAGING_DIRECTORY}/`)) return { status: 0, stdout: 'regular file 0 0 600\n', stderr: '' }
      return { status: 0, stdout: 'regular file 0 0 600\n', stderr: '' }
    }
    if (actualFile === 'test') {
      if (actualArgs[0] === '-L' || actualArgs[0] === '-e') return { status: 1, stdout: '', stderr: '' }
      return { status: 0, stdout: '', stderr: '' }
    }
    if (actualFile === 'tee' || actualFile === 'chmod' || actualFile === 'chown' || actualFile === 'find') {
      return { status: 0, stdout: '', stderr: '' }
    }
    if (actualFile === 'systemctl') {
      const action = actualArgs[0]
      const unit = actualArgs.at(-1)
      if (action === 'is-active') {
        const value = state.get(unit)?.active === true
        return { status: value ? 0 : 3, stdout: '', stderr: '' }
      }
      if (action === 'is-enabled') {
        const value = state.get(unit)?.enabled === true
        return { status: value ? 0 : 1, stdout: '', stderr: '' }
      }
      if (action === 'stop') {
        if (state.has(unit)) state.get(unit).active = false
        inspectOrder.push(`stop:${unit}`)
        return { status: 0, stdout: '', stderr: '' }
      }
      if (action === 'disable') {
        if (state.has(unit) && !(disableKeepsEnabled && unit === 'docker.service')) state.get(unit).enabled = false
        inspectOrder.push(`disable:${unit}`)
        return { status: 0, stdout: '', stderr: '' }
      }
      if (action === 'start') {
        if (state.has(unit)) state.get(unit).active = true
        inspectOrder.push(`start:${unit}`)
        return { status: 0, stdout: '', stderr: '' }
      }
      inspectOrder.push(action)
      return { status: 0, stdout: '', stderr: '' }
    }
    return { status: 0, stdout: '', stderr: '' }
  }
  return { run, record, state, inspectOrder }
}

test('CLI and Ubuntu identity are explicit', () => {
  assert.deepEqual(parseProvisionArguments(['--confirm-disposable-native-host', '--receipt', '/tmp/native-host.json']), {
    confirmDisposableNativeHost: true,
    receiptPath: '/tmp/native-host.json',
  })
  assert.throws(() => parseProvisionArguments(['--receipt', '/tmp/native-host.json']), /usage/)
  assert.deepEqual(parseUbuntuRelease(release), { id: 'ubuntu', versionId: '24.04', prettyName: 'Ubuntu 24.04.3 LTS' })
})

test('legacy dockerd requires the exact dedicated argv and permits only /var/run compatibility', () => {
  const normal = `/usr/bin/dockerd --host=unix:///var/run/docker.sock --data-root=${hostContract.dockerDataRoot} --exec-root=${hostContract.dockerExecRoot} --pidfile=${hostContract.dockerPidfile} --iptables=true --ip6tables=true`
  const compat = normal
    .replace(`--exec-root=${hostContract.dockerExecRoot}`, '--exec-root=/var/run/hr-axis-onprem-rehearsal-docker')
    .replace(`--pidfile=${hostContract.dockerPidfile}`, '--pidfile=/var/run/hr-axis-onprem-rehearsal-docker/dockerd.pid')
    .replace(`--iptables=true`, `--containerd=/var/run/hr-axis-onprem-rehearsal-containerd/containerd.sock --iptables=true`)
  assert.equal(exactLegacyDockerdCommand(normal), true)
  assert.equal(exactLegacyDockerdCommand(compat), true)
  assert.equal(exactLegacyDockerdCommand(`${normal} --containerd=${hostContract.containerdSocket}`), true)
  assert.equal(exactLegacyDockerdCommand(`${normal} --log-level=debug`), false)
  assert.throws(() => detectLegacyDockerd((file) => file === 'sudo' ? { status: 0, stdout: '421 /usr/bin/dockerd --host=unix:///tmp/foreign.sock\n', stderr: '' } : { status: 0, stdout: '', stderr: '' }), /unknown|ambiguous/)
})

test('direct self-bind is the only mount accepted for unmount', () => {
  const direct = baseRunner({ mountMode: 'direct' })
  assert.equal(proveAndUnmountDirectSelfBind(direct.run), true)
  assert.ok(direct.inspectOrder.includes('umount'))
  assert.throws(() => proveAndUnmountDirectSelfBind(baseRunner({ mountMode: 'foreign' }).run), /exact direct self-bind/)
  assert.throws(() => proveAndUnmountDirectSelfBind(baseRunner({ mountMode: 'nested' }).run), /nested mount/)
})

test('unit contents have exact daemon arguments, controlled cgroups, and runtime preservation', () => {
  const containerd = expectedNativeDockerUnit('containerd')
  const dockerd = expectedNativeDockerUnit('dockerd')
  assert.match(containerd, /ExecStart=\/usr\/bin\/containerd --root=\/var\/lib\/hr-axis-onprem-rehearsal\/containerd --state=\/run\/hr-axis-onprem-rehearsal-containerd --address=\/run\/hr-axis-onprem-rehearsal-containerd\/containerd\.sock\n/)
  assert.match(dockerd, /ExecStart=\/usr\/bin\/dockerd --host=unix:\/\/\/var\/run\/docker\.sock --data-root=\/var\/lib\/hr-axis-onprem-rehearsal\/docker --exec-root=\/run\/hr-axis-onprem-rehearsal-docker --pidfile=\/run\/hr-axis-onprem-rehearsal-docker\/dockerd\.pid --containerd=\/run\/hr-axis-onprem-rehearsal-containerd\/containerd\.sock --iptables=true --ip6tables=true\n/)
  assert.match(containerd, /KillMode=control-group/)
  assert.match(dockerd, /KillMode=control-group/)
  assert.match(containerd, /RuntimeDirectoryPreserve=yes/)
  assert.match(dockerd, /RuntimeDirectoryPreserve=yes/)
  assert.equal(SAFE_BINARIES.dockerd, '/usr/bin/dockerd')
})

test('provision order is default Docker stop/disable, roots, units, containerd, dockerd, inspect; system containerd is untouched', () => {
  const receiptPath = '/tmp/shared/writable/native-host-provision-success.json'
  const fsApi = fakeFs(receiptPath)
  const inspectOrder = []
  const runner = baseRunner({ inspectOrder })
  const originalRun = runner.run
  let attackerBaitWritten = false
  runner.run = (file, args, options) => {
    if (!attackerBaitWritten && file === 'sudo' && args[1] === '/usr/bin/tee') {
      // Simulate an attacker racing a shared/writable receipt parent.  The
      // privileged source path must remain the fixed contract-local stage.
      fsApi.writeFileSync(`${receiptPath}.attacker-bait`, 'poison', { flag: 'wx', mode: 0o600 })
      attackerBaitWritten = true
    }
    return originalRun(file, args, options)
  }
  let inspected = false
  const result = provisionNativeDockerHost({
    confirmDisposableNativeHost: true,
    receiptPath,
    platform: 'linux',
    arch: 'x64',
    uid: 1000,
    callerGid: 123,
    osRelease: release,
    uname: 'Linux',
    fsApi,
    commandRunner: runner.run,
    inspect: () => { inspected = true; inspectOrder.push('inspect'); return { inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } } },
    engineIdentity: { engineId: 'engine-test-id' },
    env: {},
  })
  assert.equal(result.receipt.status, 'passed')
  assert.equal(inspected, true)
  assert.ok(inspectOrder.indexOf(`start:${hostContract.containerdUnit}`) < inspectOrder.indexOf(`start:${hostContract.dockerdUnit}`))
  assert.ok(inspectOrder.indexOf(`start:${hostContract.dockerdUnit}`) < inspectOrder.indexOf('inspect'))
  const forbiddenLifecycle = runner.record.filter(({ file, args }) => file === 'sudo' && args[0] === '-n' && ['stop', 'disable'].includes(args[2]))
  assert.ok(forbiddenLifecycle.every(({ args }) => !args.includes('containerd.service')))
  const marker = runner.record.find((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/tee' && entry.args.includes(`${PROVISION_STAGING_DIRECTORY}/marker.json`))
  assert.equal(JSON.parse(marker.options.input.trim()).schema, expectedNativeDockerHostMarker().schema)
  const privilegedStagingCalls = runner.record.filter(({ file, args }) => file === 'sudo' && (args[1] === '/usr/bin/tee' || args[1] === '/usr/bin/install' || args[1] === '/usr/bin/chmod' || args[1] === '/usr/bin/chown'))
  assert.ok(privilegedStagingCalls.length > 0)
  assert.ok(privilegedStagingCalls.every(({ args }) => args.every((value) => !String(value).includes('/tmp/shared/writable'))))
  assert.ok(fsApi.writes.some((entry) => entry.target === `${receiptPath}.attacker-bait`))
  assert.ok(runner.record.some(({ file, args }) => file === 'sudo' && args.includes('01770')))
})

test('inspect failure writes only a failed receipt and never a success receipt', () => {
  const receiptPath = '/tmp/native-host-provision-failure.json'
  const fsApi = fakeFs(receiptPath)
  const runner = baseRunner()
  assert.throws(() => provisionNativeDockerHost({
    confirmDisposableNativeHost: true,
    receiptPath,
    platform: 'linux',
    uid: 1000,
    callerGid: 123,
    osRelease: release,
    uname: 'Linux',
    fsApi,
    commandRunner: runner.run,
    inspect: () => { throw new Error('controller inspect failed') },
    env: {},
  }), /controller inspect failed/)
  const receipt = JSON.parse(fsApi.writes.find((entry) => entry.target === receiptPath).content)
  assert.equal(receipt.status, 'failed')
  assert.equal(receipt.inspect, undefined)
})

test('missing confirmation, unsafe caller, and Docker context fail closed before host work', () => {
  const fsApi = fakeFs('/tmp/native-host-preflight.json')
  const runner = baseRunner()
  assert.throws(() => provisionNativeDockerHost({ receiptPath: '/tmp/native-host-preflight.json', fsApi, commandRunner: runner.run, env: {} }), /confirmation/)
  assert.throws(() => provisionNativeDockerHost({ confirmDisposableNativeHost: true, receiptPath: '/tmp/native-host-preflight.json', fsApi, commandRunner: runner.run, platform: 'win32', env: {} }), /Linux/)
  assert.throws(() => provisionNativeDockerHost({ confirmDisposableNativeHost: true, receiptPath: '/tmp/native-host-preflight.json', fsApi, commandRunner: runner.run, platform: 'linux', uid: 1000, callerGid: 123, osRelease: release, uname: 'Linux', env: { DOCKER_CONTEXT: 'desktop' } }), /DOCKER_CONTEXT/)
})

test('enabled-but-inactive default Docker unit is rejected and cannot produce a success receipt', () => {
  const receiptPath = '/tmp/native-host-enabled-default.json'
  const fsApi = fakeFs(receiptPath)
  const runner = baseRunner({ disableKeepsEnabled: true, dockerServiceInitiallyEnabled: true })
  assert.throws(() => provisionNativeDockerHost({
    confirmDisposableNativeHost: true,
    receiptPath,
    platform: 'linux',
    uid: 1000,
    callerGid: 123,
    osRelease: release,
    uname: 'Linux',
    fsApi,
    commandRunner: runner.run,
    env: {},
  }), /active or enabled/)
  const receipt = JSON.parse(fsApi.writes.find((entry) => entry.target === receiptPath).content)
  assert.equal(receipt.status, 'failed')
  assert.equal(receipt.units.defaults.dockerService.enabled, true)
  assert.equal(receipt.units.defaults.dockerService.active, false)
})
