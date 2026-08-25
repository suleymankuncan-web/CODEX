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

function fakeFs(receiptPath, { missingPaths = [], symlinkPaths = [], unsafeStats = {} } = {}) {
  const files = new Map()
  const writes = []
  const created = new Set()
  const missing = new Set(missingPaths)
  const symlinks = new Set(symlinkPaths)
  const rootPaths = [hostContract.dockerDataRoot, hostContract.dockerExecRoot, hostContract.containerdRoot, hostContract.containerdState]
  const isCoveredByCreatedPath = (target) => [...created].some((pathname) => target === pathname || target.startsWith(`${pathname}/`))
  const isMissing = (target) => !isCoveredByCreatedPath(target) && [...missing].some((pathname) => target === pathname || target.startsWith(`${pathname}/`))
  return {
    writes,
    created,
    markCreated(target) {
      created.add(target)
      missing.delete(target)
    },
    lstatSync(target) {
      if (target === receiptPath) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      if (files.has(target)) return files.get(target).stat
      if (isMissing(target)) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      if (symlinks.has(target)) return { ...directoryStat(), isSymbolicLink: () => true }
      if (Object.prototype.hasOwnProperty.call(unsafeStats, target)) return unsafeStats[target]
      if (created.has(target)) return directoryStat()
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

function baseRunner({ record = [], mountMode = 'none', inspectOrder = [], disableKeepsEnabled = false, dockerServiceInitiallyEnabled = false, onInstall } = {}) {
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
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: hostContract.dockerDataRoot, source: `/dev/sdf[${hostContract.dockerDataRoot}]`, fstype: 'ext4', fsroot: hostContract.dockerDataRoot }] }), stderr: '' }
      }
      if (mountMode === 'foreign' && actualArgs.includes('--mountpoint') && actualArgs.at(-1) === hostContract.dockerDataRoot) {
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: hostContract.dockerDataRoot, source: `/dev/vdb1[${hostContract.dockerDataRoot}]`, fstype: 'ext4', fsroot: hostContract.dockerDataRoot }] }), stderr: '' }
      }
      if (mountMode === 'direct' && !unmounted && actualArgs.includes('--json') && actualArgs.includes('--submounts') && actualArgs.at(-1) === '/') {
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: '/', source: '/dev/sdf', fstype: 'ext4', fsroot: '/' }, { target: hostContract.dockerDataRoot, source: `/dev/sdf[${hostContract.dockerDataRoot}]`, fstype: 'ext4', fsroot: hostContract.dockerDataRoot }] }), stderr: '' }
      }
      if (mountMode === 'foreign' && actualArgs.includes('--json') && actualArgs.includes('--submounts') && actualArgs.at(-1) === '/') {
        return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: '/', source: '/dev/sdf', fstype: 'ext4', fsroot: '/' }, { target: hostContract.dockerDataRoot, source: `/dev/vdb1[${hostContract.dockerDataRoot}]`, fstype: 'ext4', fsroot: hostContract.dockerDataRoot }] }), stderr: '' }
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
    if (actualFile === 'install' && actualArgs[0] === '-d') {
      onInstall?.(actualArgs.at(-1))
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

function mountVariantRunner(variant, record = []) {
  const runner = baseRunner({ record, mountMode: 'direct' })
  const originalRun = runner.run
  let unmountSeen = false
  const run = (file, args, options) => {
    const executable = file === 'sudo' && args[0] === '-n' ? args[1] : file
    const actualFile = executable.replace(/^.*\//, '')
    const actualArgs = file === 'sudo' && args[0] === '-n' ? args.slice(2) : args
    if (actualFile === 'umount') unmountSeen = true
    const result = originalRun(file, args, options)
    if (unmountSeen && ['post-target-present-full-absent', 'post-remains'].includes(variant) && actualFile === 'findmnt' && actualArgs.includes('--mountpoint')) {
      return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: hostContract.dockerDataRoot, source: `/dev/sdf[${hostContract.dockerDataRoot}]`, fstype: 'ext4', fsroot: hostContract.dockerDataRoot }] }), stderr: '' }
    }
    if (actualFile !== 'findmnt' || result.status !== 0 || !result.stdout.trim()) return result
    let parsed
    try { parsed = JSON.parse(result.stdout) } catch { return result }
    const mounts = parsed.filesystems
    if (!Array.isArray(mounts)) return result
    const root = mounts.find((mount) => mount.target === '/')
    let direct = mounts.find((mount) => mount.target === hostContract.dockerDataRoot)
    if (unmountSeen && actualArgs.at(-1) === '/' && ['post-target-absent-full-direct', 'post-remains'].includes(variant) && root && !direct) {
      mounts.push({ target: hostContract.dockerDataRoot, source: `/dev/sdf[${hostContract.dockerDataRoot}]`, fstype: 'ext4', fsroot: hostContract.dockerDataRoot })
      direct = mounts.find((mount) => mount.target === hostContract.dockerDataRoot)
    }
    if (unmountSeen && actualArgs.at(-1) === '/' && variant === 'post-descendant' && root && !direct) {
      mounts.push({ target: `${hostContract.dockerDataRoot}/nested`, source: '/dev/sdf', fstype: 'ext4', fsroot: '/' })
    }
    if (!direct) return { ...result, stdout: JSON.stringify(parsed) }
    if (variant === 'source-equality') direct.source = '/dev/sdf'
    if (variant === 'source-suffix') direct.source = `${direct.source}/suffix`
    if (variant === 'source-prefix') direct.source = `/prefix${direct.source}`
    if (root && variant === 'root-bracket') root.source = '/dev/sdf[part]'
    if (root && variant === 'root-whitespace') root.source = '/dev/sdf bad'
    if (root && variant === 'root-non-device') root.source = 'tmpfs'
    if (root && variant === 'root-fstype') root.fstype = 'xfs'
    if (root && variant === 'root-overlay') root.fstype = 'overlay'
    if (variant === 'direct-fstype') direct.fstype = 'xfs'
    if (variant === 'overlay') direct.fstype = 'overlay'
    if (root && variant === 'root-fsroot') root.fsroot = '/foreign'
    if (variant === 'direct-fsroot') direct.fsroot = '/foreign'
    if (variant === 'duplicate' && actualArgs.at(-1) === '/') mounts.push({ ...direct })
    if (variant === 'descendant' && actualArgs.at(-1) === '/') mounts.push({ target: `${hostContract.dockerDataRoot}/nested`, source: '/dev/sdf', fstype: 'ext4', fsroot: '/' })
    if (variant === 'disagree' && actualArgs.includes('--mountpoint')) direct.source = '/dev/sdf'
    if (variant === 'disagree' && actualArgs.at(-1) === '/') direct.source = `/dev/vdb1[${hostContract.dockerDataRoot}]`
    return { ...result, stdout: JSON.stringify(parsed) }
  }
  runner.run = run
  return runner
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
  const observedSiblingPidfile = `/usr/bin/dockerd --host=unix:///var/run/docker.sock --data-root=${hostContract.dockerDataRoot} --exec-root=/var/run/hr-axis-onprem-rehearsal-docker --pidfile=/var/run/hr-axis-onprem-rehearsal-docker.pid --iptables=true --ip6tables=true`
  assert.equal(exactLegacyDockerdCommand(normal), true)
  assert.equal(exactLegacyDockerdCommand(compat), true)
  assert.equal(exactLegacyDockerdCommand(`${normal} --containerd=${hostContract.containerdSocket}`), true)
  assert.equal(exactLegacyDockerdCommand(observedSiblingPidfile), true)
  assert.equal(exactLegacyDockerdCommand(`${normal} --log-level=debug`), false)
  assert.equal(exactLegacyDockerdCommand(observedSiblingPidfile.replace('.pid', '.pid.bak')), false)
  assert.equal(exactLegacyDockerdCommand(observedSiblingPidfile.replace('rehearsal-docker --pidfile', 'rehearsal-docker-other --pidfile')), false)
  assert.throws(() => detectLegacyDockerd((file) => file === 'sudo' ? { status: 0, stdout: '421 /usr/bin/dockerd --host=unix:///tmp/foreign.sock\n', stderr: '' } : { status: 0, stdout: '', stderr: '' }), /unknown|ambiguous/)
  const ordinaryPidOne = (file, args) => file === 'sudo' && args[1] === '/usr/bin/ps'
    ? { status: 0, stdout: '1 /sbin/init\n2 /usr/bin/other-daemon\n', stderr: '' }
    : { status: 0, stdout: '', stderr: '' }
  assert.equal(detectLegacyDockerd(ordinaryPidOne), null)
  assert.throws(() => detectLegacyDockerd((file, args) => file === 'sudo' && args[1] === '/usr/bin/ps'
    ? { status: 0, stdout: '1 /usr/bin/dockerd --host=unix:///tmp/foreign.sock\n', stderr: '' }
    : { status: 0, stdout: '', stderr: '' }), /process inventory is invalid/)
  assert.throws(() => detectLegacyDockerd((file, args) => file === 'sudo' && args[1] === '/usr/bin/ps'
    ? { status: 0, stdout: 'dockerd --host=unix:///tmp/foreign.sock\n', stderr: '' }
    : { status: 0, stdout: '', stderr: '' }), /process inventory is invalid/)
})

test('direct self-bind is the only mount accepted for unmount', () => {
  const direct = baseRunner({ mountMode: 'direct' })
  assert.equal(proveAndUnmountDirectSelfBind(direct.run), true)
  assert.ok(direct.inspectOrder.includes('umount'))
  assert.throws(() => proveAndUnmountDirectSelfBind(baseRunner({ mountMode: 'foreign' }).run), /exact direct self-bind/)
  assert.throws(() => proveAndUnmountDirectSelfBind(baseRunner({ mountMode: 'nested' }).run), /nested mount/)
})

test('provisioner rejects non-contract mount identity and records finite mount classification', () => {
  const variants = [
    ['source-equality', 'bind-source-notation-mismatch'],
    ['source-suffix', 'bind-source-notation-mismatch'],
    ['source-prefix', 'bind-source-notation-mismatch'],
    ['root-bracket', 'bind-source-notation-mismatch'],
    ['root-whitespace', 'bind-source-notation-mismatch'],
    ['root-non-device', 'bind-source-notation-mismatch'],
    ['root-fstype', 'filesystem-type-mismatch'],
    ['direct-fstype', 'filesystem-type-mismatch'],
    ['root-overlay', 'overlay-filesystem'],
    ['overlay', 'overlay-filesystem'],
    ['root-fsroot', 'fsroot-mismatch'],
    ['direct-fsroot', 'fsroot-mismatch'],
    ['duplicate', 'duplicate-direct-mount'],
    ['descendant', 'descendant-mount'],
    ['disagree', 'mount-state-unreadable'],
  ]
  for (const [variant, classification] of variants) {
    const receiptPath = `/tmp/native-host-mount-${variant}.json`
    const fsApi = fakeFs(receiptPath)
    const record = []
    const runner = mountVariantRunner(variant, record)
    assert.throws(() => provisionNativeDockerHost({
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
      env: {},
    }), /exact direct self-bind|nested mount|duplicate direct|mount state cannot be proved/)
    const receipt = JSON.parse(fsApi.writes.find((entry) => entry.target === receiptPath).content)
    assert.equal(receipt.status, 'failed')
    assert.equal(receipt.failureStage, 'mount-preflight')
    assert.equal(receipt.failureClassification, classification, variant)
    assert.equal(record.filter(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/umount').length, 0)
  }
})

test('provisioner rejects every non-contract umount target before host commands', () => {
  const record = []
  const runner = baseRunner({ record, mountMode: 'direct' })
  assert.throws(() => proveAndUnmountDirectSelfBind(runner.run, '/tmp/not-the-fixed-docker-root'), /fixed Docker data root/)
  assert.equal(record.length, 0)
})

test('post-unmount target/tree disagreement and remaining mounts fail closed before root cleanup', () => {
  const variants = [
    ['post-target-absent-full-direct', 'mount-state-unreadable'],
    ['post-target-present-full-absent', 'mount-state-unreadable'],
    ['post-remains', 'self-bind-remains-mounted'],
    ['post-descendant', 'descendant-mount'],
  ]
  for (const [variant, classification] of variants) {
    const receiptPath = `/tmp/native-host-post-unmount-${variant}.json`
    const fsApi = fakeFs(receiptPath)
    const record = []
    const runner = mountVariantRunner(variant, record)
    assert.throws(() => provisionNativeDockerHost({
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
      env: {},
    }), /mount state cannot be proved|self-bind remains mounted|nested mount/)
    const receipt = JSON.parse(fsApi.writes.find((entry) => entry.target === receiptPath).content)
    assert.equal(receipt.failureStage, 'mount-preflight')
    assert.equal(receipt.failureClassification, classification, variant)
    assert.equal(record.filter(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/umount').length, 1)
    assert.equal(record.filter(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/rm' && args.includes('--recursive')).length, 0)
    const umountIndex = record.findIndex(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/umount')
    const postTargetIndex = record.findIndex((entry, index) => index > umountIndex && entry.file === 'sudo' && entry.args[1] === '/usr/bin/findmnt' && entry.args.includes('--mountpoint') && entry.args.at(-1) === hostContract.dockerDataRoot)
    const postTreeIndex = record.findIndex((entry, index) => index > umountIndex && entry.file === 'sudo' && entry.args[1] === '/usr/bin/findmnt' && entry.args.includes('--submounts') && entry.args.at(-1) === '/')
    assert.ok(umountIndex >= 0 && postTargetIndex > umountIndex && postTreeIndex > postTargetIndex, variant)
  }
})

test('unit contents have exact daemon arguments, controlled cgroups, and runtime preservation', () => {
  const containerd = expectedNativeDockerUnit('containerd')
  const dockerd = expectedNativeDockerUnit('dockerd')
  assert.match(containerd, /ExecStart=\/usr\/bin\/containerd --root=\/var\/lib\/hr-axis-onprem-rehearsal\/containerd --state=\/run\/hr-axis-onprem-rehearsal-containerd --address=\/run\/hr-axis-onprem-rehearsal-containerd\/containerd\.sock\n/)
  assert.match(dockerd, /ExecStart=\/usr\/bin\/dockerd --host=unix:\/\/\/var\/run\/docker\.sock --data-root=\/var\/lib\/hr-axis-onprem-rehearsal\/docker --exec-root=\/run\/hr-axis-onprem-rehearsal-docker --pidfile=\/run\/hr-axis-onprem-rehearsal-docker\/dockerd\.pid --containerd=\/run\/hr-axis-onprem-rehearsal-containerd\/containerd\.sock --iptables=true --ip6tables=true\n/)
  assert.match(containerd, /KillMode=control-group/)
  assert.match(dockerd, /KillMode=control-group/)
  assert.match(containerd, /RuntimeDirectory=hr-axis-onprem-rehearsal-containerd\nRuntimeDirectoryMode=0700\nRuntimeDirectoryPreserve=yes/)
  assert.doesNotMatch(containerd, /RuntimeDirectoryMode=(?!0700\n)/)
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

test('provision retries only declared post-start readiness lag before controller inspection', () => {
  const receiptPath = '/tmp/native-host-post-start-readiness.json'
  const fsApi = fakeFs(receiptPath)
  const record = []
  const runner = baseRunner({ record })
  let inspectCalls = 0
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
    inspect: (options) => {
      inspectCalls += 1
      assert.equal(options.allowStartupReadiness, true)
      if (inspectCalls < 3) {
        const error = new Error('native Docker host post-start readiness is not yet proved')
        error.code = 'NATIVE_DOCKER_POST_START_NOT_READY'
        throw error
      }
      return { inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } }
    },
    engineIdentity: { engineId: 'engine-test-id' },
    env: {},
  })
  assert.equal(result.receipt.status, 'passed')
  assert.equal(inspectCalls, 3)
  assert.equal(record.filter((entry) => entry.file === 'sleep').length, 2)
})

test('provision readiness retry has a finite deadline and never produces a success receipt', () => {
  const receiptPath = '/tmp/native-host-post-start-readiness-timeout.json'
  const fsApi = fakeFs(receiptPath)
  const record = []
  const runner = baseRunner({ record })
  let inspectCalls = 0
  assert.throws(() => provisionNativeDockerHost({
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
    inspect: () => {
      inspectCalls += 1
      const error = new Error('native Docker host post-start readiness is not yet proved')
      error.code = 'NATIVE_DOCKER_POST_START_NOT_READY'
      throw error
    },
    env: {},
  }), /post-start readiness was not proved before deadline/)
  assert.equal(inspectCalls, 32)
  assert.equal(record.filter((entry) => entry.file === 'sleep').length, 31)
  const receipt = JSON.parse(fsApi.writes.find((entry) => entry.target === receiptPath).content)
  assert.equal(receipt.status, 'failed')
  assert.equal(receipt.failureStage, 'controller-inspect')
})

test('provision does not retry an inspection identity failure that resembles socket drift', () => {
  const receiptPath = '/tmp/native-host-post-start-identity-failure.json'
  const fsApi = fakeFs(receiptPath)
  const record = []
  const runner = baseRunner({ record })
  let inspectCalls = 0
  assert.throws(() => provisionNativeDockerHost({
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
    inspect: () => {
      inspectCalls += 1
      throw new Error('private containerd socket canonical path is not exact')
    },
    env: {},
  }), /private containerd socket canonical path is not exact/)
  assert.equal(inspectCalls, 1)
  assert.equal(record.filter((entry) => entry.file === 'sleep').length, 0)
  const receipt = JSON.parse(fsApi.writes.find((entry) => entry.target === receiptPath).content)
  assert.equal(receipt.status, 'failed')
  assert.equal(receipt.failureStage, 'controller-inspect')
})

test('clean and partially missing fixed roots are created safely before any recursive removal', () => {
  const receiptPath = '/tmp/native-host-partial-roots.json'
  const fsApi = fakeFs(receiptPath, {
    missingPaths: [hostContract.containerdRoot, hostContract.containerdState],
  })
  const record = []
  const runner = baseRunner({ record, onInstall: (target) => fsApi.markCreated(target) })
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
    inspect: () => ({ inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } }),
    engineIdentity: { engineId: 'engine-test-id' },
    env: {},
  })
  assert.equal(result.receipt.status, 'passed')

  const rootCreates = record.filter(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/install' && args[2] === '-d')
  const rootRemoves = record.filter(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/rm' && args.includes('--recursive'))
  assert.equal(rootRemoves.length, 4)
  assert.ok(rootCreates.some(({ args }) => args.includes(hostContract.containerdRoot)))
  assert.ok(rootCreates.some(({ args }) => args.includes(hostContract.containerdState)))
  for (const target of [hostContract.containerdRoot, hostContract.containerdState]) {
    const create = rootCreates.find(({ args }) => args.includes(target))
    assert.ok(create)
    assert.ok(create.args.includes('-o') && create.args.includes('root'))
    assert.ok(create.args.includes('-g') && create.args.includes('root'))
    assert.ok(create.args.includes('-m') && create.args.includes('0700'))
  }
  const firstRemove = record.indexOf(rootRemoves[0])
  assert.ok(firstRemove > -1)
  for (const target of [hostContract.containerdRoot, hostContract.containerdState]) {
    const preflightCreate = rootCreates.find((entry) => entry.args.includes(target) && record.indexOf(entry) < firstRemove)
    assert.ok(preflightCreate)
  }
})

test('missing fixed-root parents are created only beneath a validated existing ancestor', () => {
  const receiptPath = '/tmp/native-host-missing-parent.json'
  const parent = '/var/lib/hr-axis-onprem-rehearsal'
  const fsApi = fakeFs(receiptPath, { missingPaths: [parent] })
  const record = []
  const runner = baseRunner({ record, onInstall: (target) => fsApi.markCreated(target) })
  const result = provisionNativeDockerHost({
    confirmDisposableNativeHost: true,
    receiptPath,
    platform: 'linux',
    uid: 1000,
    callerGid: 123,
    osRelease: release,
    uname: 'Linux',
    fsApi,
    commandRunner: runner.run,
    inspect: () => ({ inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } }),
    engineIdentity: { engineId: 'engine-test-id' },
    env: {},
  })
  assert.equal(result.receipt.status, 'passed')
  const parentCreate = record.find(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/install' && args[2] === '-d' && args.includes(parent))
  assert.ok(parentCreate)
  assert.ok(parentCreate.args.includes('-o') && parentCreate.args.includes('root'))
  assert.ok(parentCreate.args.includes('-g') && parentCreate.args.includes('root'))
  assert.ok(parentCreate.args.includes('-m') && parentCreate.args.includes('0700'))
  const firstRemove = record.findIndex(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/rm' && args.includes('--recursive'))
  assert.ok(firstRemove > record.indexOf(parentCreate))
})

test('unsafe fixed roots and parents fail closed before recursive removal', () => {
  const symlinkReceipt = '/tmp/native-host-symlink-root.json'
  const symlinkFs = fakeFs(symlinkReceipt, { symlinkPaths: [hostContract.containerdRoot] })
  const symlinkRecord = []
  const symlinkRunner = baseRunner({ record: symlinkRecord })
  assert.throws(() => provisionNativeDockerHost({
    confirmDisposableNativeHost: true,
    receiptPath: symlinkReceipt,
    platform: 'linux',
    uid: 1000,
    callerGid: 123,
    osRelease: release,
    uname: 'Linux',
    fsApi: symlinkFs,
    commandRunner: symlinkRunner.run,
    env: {},
  }), /non-symlink|symlink/)
  assert.equal(symlinkRecord.filter(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/rm' && args.includes('--recursive')).length, 0)

  const unsafeReceipt = '/tmp/native-host-unsafe-parent.json'
  const parent = '/var/lib/hr-axis-onprem-rehearsal'
  const unsafeFs = fakeFs(unsafeReceipt, { unsafeStats: { [parent]: directoryStat(0o755, 1000, 123) } })
  const unsafeRecord = []
  const unsafeRunner = baseRunner({ record: unsafeRecord })
  assert.throws(() => provisionNativeDockerHost({
    confirmDisposableNativeHost: true,
    receiptPath: unsafeReceipt,
    platform: 'linux',
    uid: 1000,
    callerGid: 123,
    osRelease: release,
    uname: 'Linux',
    fsApi: unsafeFs,
    commandRunner: unsafeRunner.run,
    env: {},
  }), /root-owned|writable/)
  assert.equal(unsafeRecord.filter(({ file, args }) => file === 'sudo' && args[1] === '/usr/bin/rm' && args.includes('--recursive')).length, 0)
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
