import assert from 'node:assert/strict'
import test from 'node:test'

import {
  acquireHostLock,
  expectedNativeDockerHostMarker,
  hostContract,
  inspectDedicatedNativeDockerHost,
  isExactDockerDataSelfBind,
  releaseHostLock,
  resetDedicatedNativeDockerHost,
  validateCanonicalDestructiveTarget,
} from './onprem-native-docker-host.mjs'

const markerText = JSON.stringify(expectedNativeDockerHostMarker())
const dirStat = { uid: 0, gid: 0, mode: 0o700, isDirectory: () => true, isSymbolicLink: () => false }
const lockDirStat = { uid: 0, gid: 0, mode: 0o1770, isDirectory: () => true, isSymbolicLink: () => false }
const markerStat = { uid: 0, gid: 0, mode: 0o644, nlink: 1, isFile: () => true, isSymbolicLink: () => false }
const lockStat = { uid: 0, gid: 0, mode: 0o600, nlink: 1, isFile: () => true, isSymbolicLink: () => false }
const socketStat = { uid: 0, gid: 123, mode: 0o660, dev: 9, ino: 99, isSocket: () => true, isSymbolicLink: () => false }
const containerdSocketStat = { uid: 0, gid: 123, mode: 0o660, dev: 10, ino: 200, isSocket: () => true, isSymbolicLink: () => false }

function fakeFs({ symlink = '', varRunTarget = '/run', aliasSame = true, existingLock = false, lockDirectoryMode = 0o1770, lockDirectoryGid = 0, ancestorMode = 0o700, marker = markerText, lockContents = '' } = {}) {
  let lock = existingLock
  const writes = []
  return {
    writes,
    lstatSync(target) {
      if (target === hostContract.marker) return symlink === target ? { ...markerStat, isSymbolicLink: () => true } : markerStat
      if (target === hostContract.lockFile && lock) return lockStat
      if (target === hostContract.lockFile) throw new Error('missing')
      if (target === hostContract.lockDirectory) return { ...lockDirStat, mode: lockDirectoryMode, gid: lockDirectoryGid }
      if (target === hostContract.socket) return socketStat
      if (target === hostContract.containerdSocket) return containerdSocketStat
      if (target === '/var/run') return { isSymbolicLink: () => true }
      if (target === '/run/docker.sock') return aliasSame ? socketStat : { ...socketStat, ino: 100 }
      if (target === symlink) return { ...dirStat, isSymbolicLink: () => true }
      return { ...dirStat, mode: ancestorMode }
    },
    realpathSync(target) {
      if (target === '/var/run') return varRunTarget
      if (target === hostContract.socket) return `${varRunTarget}/docker.sock`
      return target
    },
    readFileSync(target) {
      if (target === hostContract.marker) return marker
      if (target === hostContract.lockFile && lock) return lockContents
      throw new Error('missing')
    },
    openSync(target) {
      if (target !== hostContract.lockFile || lock) {
        const error = new Error('exists')
        error.code = 'EEXIST'
        throw error
      }
      lock = true
      return 7
    },
    writeFileSync(_descriptor, content) {
      writes.push(String(content))
      lockContents = String(content)
    },
    closeSync() {},
    unlinkSync(target) {
      if (target !== hostContract.lockFile || !lock) throw new Error('missing')
      lock = false
    },
  }
}

function baseRunner({ sharedContainerd = false, enabledDockerService = false, enabledDockerSocket = false, wrongSocket = false, wrongContainerdSocket = false, wrongContainerdListener = false, wrongRoot = false, wrongPid = false, wrongExecutable = false, wrongCgroup = false, execExtra = false, alternateHostAlias = false, wrongFirewallFlags = false, bareFirewallAlias = false, mutable = false, cgroupState = 'absent', record = [] } = {}) {
  let active = true
  let inventoryMutable = mutable
  const pids = { dockerd: 421, containerd: 422 }
  const run = (file, args, options = {}) => {
    record.push({ file, args: [...args], options })
    const actualExecutable = file === 'sudo' && args[0] === '-n' ? args[1] : file
    const actualFile = actualExecutable.replace(/^.*\//, '')
    const actualArgs = file === 'sudo' && args[0] === '-n' ? args.slice(2) : args
    if (actualFile === 'findmnt') {
      if (actualArgs.includes('--mountpoint')) return { status: 1, stdout: '', stderr: '' }
      if (actualArgs.includes('--json')) return { status: 0, stdout: JSON.stringify({ filesystems: [{ target: '/' }] }), stderr: '' }
      return { status: 1, stdout: '', stderr: '' }
    }
    if (actualFile === 'systemctl' && actualArgs[0] === 'is-active') {
      const unit = actualArgs.at(-1)
      if (unit === hostContract.dockerdUnit || unit === hostContract.containerdUnit) return { status: active ? 0 : 3, stdout: '', stderr: '' }
      return { status: sharedContainerd && ['docker.service', 'docker.socket'].includes(unit) ? 0 : 3, stdout: '', stderr: '' }
    }
    if (actualFile === 'systemctl' && actualArgs[0] === 'is-enabled') {
      const unit = actualArgs.at(-1)
      const enabled = (unit === 'docker.service' && enabledDockerService) || (unit === 'docker.socket' && enabledDockerSocket)
      return { status: enabled ? 0 : 1, stdout: `${enabled ? 'enabled' : 'disabled'}\n`, stderr: '' }
    }
    if (actualFile === 'systemctl' && actualArgs[0] === 'show') {
      const unit = actualArgs.at(-1)
      if (actualArgs.includes('--property=ControlGroup')) return { status: 0, stdout: `/system.slice/${unit}\n`, stderr: '' }
      if (actualArgs.includes('--property=ExecStart')) {
        if (unit === hostContract.containerdUnit) return { status: 0, stdout: `/usr/bin/containerd --root=${hostContract.containerdRoot} --state=${hostContract.containerdState} --address=${wrongContainerdSocket ? '/run/containerd/containerd.sock' : hostContract.containerdSocket}${execExtra ? ' --log-level=debug' : ''}\n`, stderr: '' }
        return { status: 0, stdout: `/usr/bin/dockerd --host=unix://${hostContract.socket} --data-root=${hostContract.dockerDataRoot} --exec-root=${hostContract.dockerExecRoot} --pidfile=${hostContract.dockerPidfile} --containerd=${hostContract.containerdSocket} --iptables=true --ip6tables=true${execExtra ? ' --log-level=debug' : ''}\n`, stderr: '' }
      }
      return { status: 0, stdout: `${pids[unit === hostContract.dockerdUnit ? 'dockerd' : 'containerd']}\n`, stderr: '' }
    }
    if (actualFile === 'ps') {
      const pid = actualArgs[2]
      if (pid === String(pids.containerd)) return { status: 0, stdout: `containerd --root=${hostContract.containerdRoot} --state=${hostContract.containerdState} --address=${wrongContainerdSocket ? '/run/containerd/containerd.sock' : hostContract.containerdSocket}\n`, stderr: '' }
      const socket = wrongSocket ? '/tmp/not-the-docker.sock' : hostContract.socket
      const root = wrongRoot ? '/var/lib/docker' : hostContract.dockerDataRoot
      const pidfile = wrongPid ? '/run/wrong/dockerd.pid' : hostContract.dockerPidfile
      const alias = alternateHostAlias ? ' -H=/tmp/alternate.sock' : ''
      const firewall = wrongFirewallFlags ? ' --iptables=false --ip6tables=true' : ` --iptables=true --ip6tables=true${bareFirewallAlias ? ' --iptables' : ''}`
      return { status: 0, stdout: `dockerd --host=unix://${socket} --data-root=${root} --exec-root=${hostContract.dockerExecRoot} --pidfile=${pidfile} --containerd=${hostContract.containerdSocket}${firewall}${alias}\n`, stderr: '' }
    }
    if (actualFile === 'cat') {
      const target = actualArgs.at(-1)
      const pid = Number(target.match(/\/proc\/(\d+)\//)?.[1])
      if (target.endsWith('/stat')) {
        const fields = Array(20).fill('0')
        fields[0] = 'S'
        fields[1] = '1'
        fields[19] = pid === 421 ? '778' : '777'
        return { status: 0, stdout: `${pid} (native) ${fields.join(' ')}\n`, stderr: '' }
      }
      return { status: 0, stdout: `0::/system.slice/${wrongCgroup ? 'other.service' : (pid === 421 ? hostContract.dockerdUnit : hostContract.containerdUnit)}\n`, stderr: '' }
    }
    if (actualFile === 'readlink') return { status: 0, stdout: wrongExecutable ? '/tmp/not-approved\n' : (actualArgs.at(-1).includes('/421/') ? '/usr/bin/dockerd\n' : '/usr/bin/containerd\n'), stderr: '' }
    if (actualFile === 'kill') return { status: active ? 0 : 1, stdout: '', stderr: '' }
    if (actualFile === 'test') {
      if (actualArgs[0] === '!' && actualArgs[1] === '-e' && actualArgs[2]?.startsWith('/sys/fs/cgroup/')) {
        if (cgroupState === 'error') return { status: 2, stdout: '', stderr: 'permission denied' }
        return { status: cgroupState === 'absent' ? 0 : 1, stdout: '', stderr: '' }
      }
      return { status: 0, stdout: '', stderr: '' }
    }
    if (actualFile === 'find') {
      if (cgroupState === 'error' && actualArgs[0]?.startsWith('/sys/fs/cgroup/')) return { status: 2, stdout: '', stderr: 'permission denied' }
      if (cgroupState === 'member' && actualArgs.includes('cgroup.procs')) return { status: 0, stdout: '421\n', stderr: '' }
      if (cgroupState === 'child' && actualArgs[0]?.startsWith('/sys/fs/cgroup/') && actualArgs.includes('-print')) return { status: 0, stdout: '/sys/fs/cgroup/system.slice/child.scope\n', stderr: '' }
      return { status: 0, stdout: '', stderr: '' }
    }
    if (actualFile === 'stat') {
      if (actualArgs.at(-1) === hostContract.containerdSocket) return { status: 0, stdout: 'socket 0 123 660 10 200\n', stderr: '' }
      if (actualArgs.at(-1) === '/usr/bin/dockerd' || actualArgs.at(-1) === '/usr/bin/containerd') return { status: 0, stdout: 'regular file 0 755\n', stderr: '' }
      return { status: 0, stdout: 'socket 0 123 660 9 99\n', stderr: '' }
    }
    if (actualFile === 'ss') return { status: 0, stdout: `u_str LISTEN 0 4096 ${hostContract.socket} users:(("dockerd",pid=421,fd=3))\nu_str LISTEN 0 4096 ${hostContract.containerdSocket} users:(("containerd",pid=${wrongContainerdListener ? 999 : 422},fd=4))\n`, stderr: '' }
    if (actualFile === 'docker') {
      if (actualArgs.includes('info')) return { status: 0, stdout: JSON.stringify({ DockerRootDir: wrongRoot ? '/var/lib/docker' : hostContract.dockerDataRoot }), stderr: '' }
      return { status: 0, stdout: inventoryMutable ? 'item-1\n' : '', stderr: '' }
    }
    if (actualFile === 'rm') { inventoryMutable = false; return { status: 0, stdout: '', stderr: '' } }
    return { status: 0, stdout: '', stderr: '' }
  }
  return { run, record, get active() { return active }, set active(value) { active = value } }
}

function inspectorOptions(runner, fsApi, env = {}) {
  return { commandRunner: runner, fsApi, platform: 'linux', env }
}

function topologyRunner({ mode = 'none', record = [] } = {}) {
  const runner = baseRunner({ record })
  const originalRun = runner.run
  let stopped = false
  let mounted = mode !== 'none'
  const run = (file, args, options) => {
    const actualExecutable = file === 'sudo' && args[0] === '-n' ? args[1] : file
    const actualFile = actualExecutable.replace(/^.*\//, '')
    const actualArgs = file === 'sudo' && args[0] === '-n' ? args.slice(2) : args
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'stop') {
      stopped = true
      runner.active = false
    }
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'start') runner.active = true
    if (actualFile === 'findmnt' && actualArgs.includes('--json') && actualArgs.includes('--submounts') && actualArgs.at(-1) === '/') {
      let effectiveMode = stopped ? mode : (mode.startsWith('post-') ? 'allowed' : mode)
      if (effectiveMode === 'post-foreign-source') effectiveMode = 'foreign-source'
      if (effectiveMode === 'post-overlay') effectiveMode = 'overlay'
      if (effectiveMode === 'post-nested') effectiveMode = 'nested'
      const rootMount = { target: '/', source: '/dev/vda1', fstype: 'ext4', fsroot: '/' }
      if (effectiveMode === 'root-bracket') rootMount.source = '/dev/vda1[part]'
      if (effectiveMode === 'root-whitespace') rootMount.source = '/dev/vda1 bad'
      if (effectiveMode === 'root-non-device') rootMount.source = 'tmpfs'
      if (effectiveMode === 'root-fstype') rootMount.fstype = 'xfs'
      if (effectiveMode === 'root-overlay') rootMount.fstype = 'overlay'
      if (effectiveMode === 'root-fsroot') rootMount.fsroot = '/foreign'
      const mounts = [rootMount]
      if (mounted && effectiveMode !== 'none') {
        const direct = { target: hostContract.dockerDataRoot, source: `/dev/vda1[${hostContract.dockerDataRoot}]`, fstype: 'ext4', fsroot: hostContract.dockerDataRoot }
        if (effectiveMode === 'foreign-source') direct.source = `/dev/vdb1[${hostContract.dockerDataRoot}]`
        if (effectiveMode === 'source-equality') direct.source = '/dev/vda1'
        if (effectiveMode === 'source-extra') direct.source = `${direct.source}/suffix`
        if (effectiveMode === 'source-prefix') direct.source = `/prefix${direct.source}`
        if (effectiveMode === 'fsroot-mismatch') direct.fsroot = '/foreign'
        if (effectiveMode === 'direct-fstype') direct.fstype = 'xfs'
        if (effectiveMode === 'overlay') direct.fstype = 'overlay'
        mounts.push(direct)
        if (effectiveMode === 'duplicate') mounts.push({ ...direct })
        if (effectiveMode === 'nested') mounts.push({ target: `${hostContract.dockerDataRoot}/nested`, source: '/dev/vda1', fstype: 'ext4', fsroot: '/' })
        if (effectiveMode === 'other-root') mounts.push({ target: hostContract.dockerExecRoot, source: '/dev/sdf[/other]', fstype: 'ext4', fsroot: '/' })
      }
      return { status: 0, stdout: JSON.stringify({ filesystems: mounts }), stderr: '' }
    }
    if (actualFile === 'umount') {
      record.push({ file, args: [...args], options })
      if (actualArgs.at(-1) !== hostContract.dockerDataRoot) return { status: 1, stdout: '', stderr: 'unexpected target' }
      if (mode === 'post-selfbind-remains') return { status: 0, stdout: '', stderr: '' }
      mounted = false
      return { status: 0, stdout: '', stderr: '' }
    }
    return originalRun(file, args, options)
  }
  runner.run = run
  return runner
}

test('fixed-root validator rejects traversal, symlink, mountpoint, and nonfixed paths', () => {
  const fsApi = fakeFs()
  const valid = { fsApi, platform: 'linux', mountpointChecker: () => false, mountpointSubtreeChecker: () => false }
  assert.doesNotThrow(() => validateCanonicalDestructiveTarget(hostContract.dockerDataRoot, 'dockerDataRoot', valid))
  assert.throws(() => validateCanonicalDestructiveTarget(`${hostContract.dockerDataRoot}/../docker`, 'dockerDataRoot', valid), /fixed absolute path|normalized/)
  assert.throws(() => validateCanonicalDestructiveTarget('/var/lib/docker', 'dockerDataRoot', valid), /fixed absolute path/)
  assert.throws(() => validateCanonicalDestructiveTarget(hostContract.dockerDataRoot, 'dockerDataRoot', { ...valid, fsApi: fakeFs({ symlink: hostContract.dockerDataRoot }) }), /symlink/)
  assert.throws(() => validateCanonicalDestructiveTarget(hostContract.dockerDataRoot, 'dockerDataRoot', { ...valid, mountpointChecker: () => true }), /mountpoint/)
  assert.throws(() => validateCanonicalDestructiveTarget(hostContract.dockerDataRoot, 'dockerDataRoot', { ...valid, mountpointSubtreeChecker: () => true }), /nested mountpoint/)
  assert.throws(() => validateCanonicalDestructiveTarget(hostContract.dockerDataRoot, 'dockerDataRoot', { ...valid, fsApi: fakeFs({ ancestorMode: 0o722 }) }), /group\/world writable/)
  assert.doesNotThrow(() => validateCanonicalDestructiveTarget(hostContract.dockerDataRoot, 'dockerDataRoot', { fsApi, platform: 'linux', commandRunner: (_file, args) => args.includes('--mountpoint') ? ({ status: 1, stdout: '/', stderr: '' }) : ({ status: 0, stdout: JSON.stringify({ filesystems: [{ target: '/' }] }), stderr: '' }) }), 'a containing root mount is not the target mountpoint')
  assert.throws(() => validateCanonicalDestructiveTarget(hostContract.dockerDataRoot, 'dockerDataRoot', { fsApi, platform: 'linux', commandRunner: (_file, args) => args.includes('--mountpoint') ? ({ status: 1, stdout: '', stderr: '' }) : ({ status: 0, stdout: JSON.stringify({ filesystems: [{ target: '/' }, { target: `${hostContract.dockerDataRoot}/nested` }] }), stderr: '' }) }), /nested mountpoint/, 'a non-mount target with a descendant mount is still rejected')
})

test('inspector accepts only the exact private daemon identity and empty mutable inventory', () => {
  const runner = baseRunner()
  const identity = inspectDedicatedNativeDockerHost(inspectorOptions(runner.run, fakeFs()))
  assert.equal(identity.dockerRootDir, hostContract.dockerDataRoot)
  assert.deepEqual(identity.inventory, { containers: 0, networks: 0, volumes: 0, images: 0 })
  assert.deepEqual(identity.systemUnits, {
    dockerService: { unit: 'docker.service', active: 'inactive', enabled: 'disabled' },
    dockerSocket: { unit: 'docker.socket', active: 'inactive', enabled: 'disabled' },
  })
})

for (const [name, change, expected] of [
  ['active default Docker unit', { sharedContainerd: true }, /forbidden systemd unit is active/],
  ['enabled default Docker service', { enabledDockerService: true }, /forbidden systemd unit enablement cannot be proved/],
  ['enabled default Docker socket', { enabledDockerSocket: true }, /forbidden systemd unit enablement cannot be proved/],
  ['wrong dockerd socket', { wrongSocket: true }, /arguments are not exact/],
  ['wrong private containerd socket', { wrongContainerdSocket: true }, /arguments are not exact/],
  ['private containerd listener PID mismatch', { wrongContainerdListener: true }, /private containerd socket is not owned/],
  ['wrong Docker root', { wrongRoot: true }, /data-root identity|arguments are not exact/],
  ['wrong dockerd pidfile', { wrongPid: true }, /arguments are not exact/],
  ['untrusted process executable', { wrongExecutable: true }, /executable path is not exact/],
  ['process outside unit cgroup', { wrongCgroup: true }, /outside its systemd control group/],
  ['extra loaded ExecStart argument', { execExtra: true }, /unapproved arguments/],
  ['alternate -H socket alias', { alternateHostAlias: true }, /arguments are not exact|unapproved arguments/],
  ['firewall-disabled dockerd', { wrongFirewallFlags: true }, /arguments are not exact/],
  ['bare firewall alias', { bareFirewallAlias: true }, /arguments are not exact|unapproved arguments/],
  ['mutable inventory', { mutable: true }, /inventory is not empty/],
]) {
  test(`inspector rejects ${name}`, () => {
    const runner = baseRunner(change)
    assert.throws(() => inspectDedicatedNativeDockerHost(inspectorOptions(runner.run, fakeFs())), expected)
  })
}

test('inspector permits only the /var/run -> /run compatibility binding and matching socket identity', () => {
  assert.doesNotThrow(() => inspectDedicatedNativeDockerHost(inspectorOptions(baseRunner().run, fakeFs())))
  assert.throws(() => inspectDedicatedNativeDockerHost(inspectorOptions(baseRunner().run, fakeFs({ varRunTarget: '/opt' }))), /approved \/var\/run/)
  assert.throws(() => inspectDedicatedNativeDockerHost(inspectorOptions(baseRunner().run, fakeFs({ aliasSame: false }))), /aliases do not identify/)
})

test('exact Docker data self-bind predicate accepts observed literal source notation only', () => {
  const root = { target: '/', source: '/dev/sdf', fstype: 'ext4', fsroot: '/' }
  const direct = { target: hostContract.dockerDataRoot, source: `/dev/sdf[${hostContract.dockerDataRoot}]`, fstype: 'ext4', fsroot: hostContract.dockerDataRoot }
  assert.equal(isExactDockerDataSelfBind(root, direct), true)
  for (const candidate of [
    { ...direct, source: '/dev/sdf' },
    { ...direct, source: `${direct.source}/suffix` },
    { ...direct, source: `/prefix${direct.source}` },
    { ...direct, source: `/dev/sdf [${hostContract.dockerDataRoot}]` },
    { ...direct, source: `/dev/sdf[${hostContract.dockerDataRoot}]\n` },
    { ...direct, source: `/dev/sdf;[${hostContract.dockerDataRoot}]` },
    { ...direct, fstype: 'xfs' },
    { ...direct, fsroot: '/foreign' },
    { ...direct, target: `${hostContract.dockerDataRoot}/nested` },
  ]) assert.equal(isExactDockerDataSelfBind(root, candidate), false)
  for (const source of ['/dev/[sdf]', '/dev/sdf[part]', '/dev/sdf other', 'overlay', 'tmpfs', '/run/docker.sock', '/dev/sdf:part']) {
    assert.equal(isExactDockerDataSelfBind({ ...root, source }, direct), false)
  }
  assert.equal(isExactDockerDataSelfBind({ ...root, fstype: 'EXT4' }, direct), false)
  assert.equal(isExactDockerDataSelfBind({ ...root, fsroot: '/var' }, direct), false)
})

test('reset ordering is dockerd stop, containerd stop, fixed-root reset, then starts and inspect', () => {
  const record = []
  const runner = baseRunner({ record })
  const originalRun = runner.run
  runner.run = (file, args, options) => {
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'stop') runner.active = false
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'start') runner.active = true
    return originalRun(file, args, options)
  }
  const result = resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 7), pid: 777 })
  assert.equal(result.dockerDaemonReset, true)
  const privileged = record.filter((entry) => entry.file === 'sudo' && ['systemctl', 'rm', 'install'].some((name) => entry.args[1].endsWith(`/${name}`))).map((entry) => entry.args)
  assert.deepEqual(privileged.slice(0, 2), [
    ['-n', '/usr/bin/systemctl', 'stop', hostContract.dockerdUnit],
    ['-n', '/usr/bin/systemctl', 'stop', hostContract.containerdUnit],
  ])
  assert.deepEqual(privileged.at(-2), ['-n', '/usr/bin/systemctl', 'start', hostContract.containerdUnit])
  assert.deepEqual(privileged.at(-1), ['-n', '/usr/bin/systemctl', 'start', hostContract.dockerdUnit])
  const destructive = privileged.filter((args) => args[1] === '/usr/bin/rm')
  assert.equal(destructive.length, 4)
  assert.ok(destructive.every((args) => Object.values(hostContract).includes(args.at(-1))))
  assert.ok(record.filter((entry) => entry.file === 'sudo' && ['systemctl', 'rm', 'install'].some((name) => entry.args[1].endsWith(`/${name}`))).every((entry) => !entry.args.includes('docker.service') && !entry.args.includes('containerd.service')))
})

test('reset permits only the exact docker-data self-bind and unmounts it after private units stop', () => {
  const record = []
  const runner = topologyRunner({ mode: 'allowed', record })
  const result = resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 17), pid: 787 })
  assert.equal(result.dockerDaemonReset, true)
  const umounts = record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/umount')
  assert.deepEqual(umounts.map((entry) => entry.args), [['-n', '/usr/bin/umount', '--', hostContract.dockerDataRoot]])
  const stopIndex = record.findIndex((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/systemctl' && entry.args[2] === 'stop' && entry.args[3] === hostContract.containerdUnit)
  const unmountIndex = record.findIndex((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/umount')
  const deleteIndex = record.findIndex((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/rm')
  assert.ok(stopIndex >= 0 && unmountIndex > stopIndex && deleteIndex > unmountIndex)
})

for (const [mode, classification] of [
  ['foreign-source', 'bind-source-notation-mismatch'],
  ['source-equality', 'bind-source-notation-mismatch'],
  ['source-extra', 'bind-source-notation-mismatch'],
  ['source-prefix', 'bind-source-notation-mismatch'],
  ['root-bracket', 'bind-source-notation-mismatch'],
  ['root-whitespace', 'bind-source-notation-mismatch'],
  ['root-non-device', 'bind-source-notation-mismatch'],
  ['fsroot-mismatch', 'fsroot-mismatch'],
  ['root-fsroot', 'fsroot-mismatch'],
  ['direct-fstype', 'filesystem-type-mismatch'],
  ['root-fstype', 'filesystem-type-mismatch'],
  ['overlay', 'overlay-filesystem'],
  ['root-overlay', 'overlay-filesystem'],
  ['duplicate', 'duplicate-direct-mount'],
  ['nested', 'descendant-mount'],
]) {
  test(`reset rejects ${mode} topology before any stop, unmount, or delete`, () => {
    const record = []
    const runner = topologyRunner({ mode, record })
    assert.throws(() => resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 18), pid: 788 }), new RegExp(`reset mount topology rejected for dockerDataRoot ${hostContract.dockerDataRoot}: ${classification}`))
    assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/systemctl' && entry.args[2] === 'stop').length, 0)
    assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/umount').length, 0)
    assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/rm').length, 0)
  })
}

test('post-stop unapproved topology compensates custom units and never deletes', () => {
  const record = []
  const runner = topologyRunner({ mode: 'post-foreign-source', record })
  assert.throws(() => resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 19), pid: 789 }), new RegExp(`reset mount topology rejected for dockerDataRoot ${hostContract.dockerDataRoot}: bind-source-notation-mismatch`))
  const starts = record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/systemctl' && entry.args[2] === 'start').map((entry) => entry.args[3])
  assert.deepEqual(starts, [hostContract.containerdUnit, hostContract.dockerdUnit])
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/rm').length, 0)
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/umount').length, 0)
})

test('reset rejects a direct mount on any other fixed root before lifecycle mutation', () => {
  const record = []
  const runner = topologyRunner({ mode: 'other-root', record })
  assert.throws(() => resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 20), pid: 790 }), new RegExp(`reset mount topology rejected for dockerExecRoot ${hostContract.dockerExecRoot}: unexpected-direct-mount`))
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/systemctl' && entry.args[2] === 'stop').length, 0)
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/umount').length, 0)
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/rm').length, 0)
})

test('reset binds every injected command to the remaining absolute recovery deadline', () => {
  const record = []
  const runner = baseRunner({ record })
  const originalRun = runner.run
  runner.run = (file, args, options) => {
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'stop') runner.active = false
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'start') runner.active = true
    return originalRun(file, args, options)
  }
  const recoveryDeadlineAt = Date.now() + 10_000
  resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), recoveryDeadlineAt, callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 16), pid: 785 })
  assert.ok(record.length > 0)
  assert.ok(record.every((entry) => Number.isInteger(entry.options.timeout) && entry.options.timeout >= 1 && entry.options.timeout <= 10_000))
})

test('expired recovery deadline fails before lock or lifecycle mutation', () => {
  const record = []
  const fsApi = fakeFs()
  const runner = baseRunner({ record })
  assert.throws(() => resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fsApi), recoveryDeadlineAt: Date.now() - 1, callerGid: 0, uid: 0, pid: 786 }), /recovery deadline exceeded/)
  assert.equal(record.length, 0)
  assert.equal(fsApi.writes.length, 0)
})

test('reset preflight mount failure records no lifecycle stop', () => {
  const record = []
  const runner = topologyRunner({ mode: 'foreign-source', record })
  assert.throws(() => resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 14), pid: 783 }), /reset mount topology rejected for dockerDataRoot .*bind-source-notation-mismatch/)
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1]?.endsWith('/systemctl') && entry.args[2] === 'stop').length, 0)
  assert.equal(runner.active, true)
})

test('reset proves fixed directory identity before any lifecycle stop', () => {
  const record = []
  const runner = topologyRunner({ mode: 'allowed', record })
  assert.throws(() => resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs({ symlink: hostContract.dockerExecRoot })), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 15), pid: 784 }), /non-symlink directory/)
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1]?.endsWith('/systemctl') && entry.args[2] === 'stop').length, 0)
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/umount').length, 0)
  assert.equal(record.filter((entry) => entry.file === 'sudo' && entry.args[1] === '/usr/bin/rm').length, 0)
})

test('post-stop target revalidation failure compensates in containerd-then-dockerd order', () => {
  const record = []
  const runner = baseRunner({ record })
  const originalRun = runner.run
  let stopBegan = false
  runner.run = (file, args, options) => {
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'stop') {
      stopBegan = true
      runner.active = false
    }
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'start') runner.active = true
    if (file === 'findmnt' && args.includes('--mountpoint') && stopBegan) return { status: 0, stdout: `${hostContract.dockerDataRoot}\n`, stderr: '' }
    return originalRun(file, args, options)
  }
  assert.throws(() => resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 15), pid: 784 }), /must not be a mountpoint/)
  const starts = record.filter((entry) => entry.file === 'sudo' && entry.args[1]?.endsWith('/systemctl') && entry.args[2] === 'start').map((entry) => entry.args[3])
  assert.deepEqual(starts, [hostContract.containerdUnit, hostContract.dockerdUnit])
  const lifecycle = record.filter((entry) => entry.file === 'sudo' && entry.args[1]?.endsWith('/systemctl') && ['stop', 'start'].includes(entry.args[2]))
  assert.ok(lifecycle.every((entry) => !entry.args.includes('docker.service') && !entry.args.includes('docker.socket') && !entry.args.includes('containerd.service')))
  assert.equal(runner.active, true)
})

test('reset honors an already-held caller lock and leaves ownership with the caller', () => {
  const fsApi = fakeFs()
  const lock = acquireHostLock({ fsApi, platform: 'linux', callerGid: 0, uid: 0, pid: 779, randomBytes: () => Buffer.alloc(24, 8) })
  const runner = baseRunner()
  const originalRun = runner.run
  runner.run = (file, args, options) => {
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'stop') runner.active = false
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'start') runner.active = true
    return originalRun(file, args, options)
  }
  const result = resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fsApi), lock, callerGid: 0, uid: 0 })
  assert.equal(result.dockerDaemonReset, true)
  assert.equal(releaseHostLock(lock, { fsApi }), true)
})

test('reset accepts verified nonempty pre-inventory and requires empty post-inventory', () => {
  const record = []
  const runner = baseRunner({ mutable: true, record })
  const originalRun = runner.run
  runner.run = (file, args, options) => {
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'stop') runner.active = false
    if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'start') runner.active = true
    return originalRun(file, args, options)
  }
  const result = resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 9), pid: 780 })
  assert.equal(result.before.inventory.containers, 1)
  assert.equal(result.after.inventory.containers, 0)
})

test('reset accepts removed empty cgroups but rejects ambiguous, populated, or child cgroups', () => {
  const runReset = (cgroupState) => {
    const runner = baseRunner({ cgroupState })
    const originalRun = runner.run
    runner.run = (file, args, options) => {
      if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'stop') runner.active = false
      if (file === 'sudo' && args[0] === '-n' && args[1].endsWith('/systemctl') && args[2] === 'start') runner.active = true
      return originalRun(file, args, options)
    }
    return resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 13), pid: 782 })
  }

  assert.doesNotThrow(() => runReset('absent'), 'systemd may remove an empty cgroup after stop')
  assert.doesNotThrow(() => runReset('present'), 'an existing cgroup with no members or children is empty')
  assert.throws(() => runReset('error'), /control group state cannot be proved/)
  assert.throws(() => runReset('member'), /control group still has process members/)
  assert.throws(() => runReset('child'), /child cgroups remain/)
})

test('reset still rejects nonempty inventory when daemon identity is wrong', () => {
  const runner = baseRunner({ mutable: true, wrongRoot: true })
  assert.throws(() => resetDedicatedNativeDockerHost({ ...inspectorOptions(runner.run, fakeFs()), callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 10), pid: 781 }), /data-root identity|arguments are not exact/)
})

test('lock acquisition is atomic and stale or mismatched ownership fails closed', () => {
  const freshFs = fakeFs()
  const lockOptions = { fsApi: freshFs, platform: 'linux', callerGid: 0, uid: 0, randomBytes: () => Buffer.alloc(24, 5), pid: 99 }
  const lock = acquireHostLock(lockOptions)
  assert.equal(lock.nonce, '05'.repeat(24))
  assert.throws(() => acquireHostLock({ ...lockOptions, randomBytes: () => Buffer.alloc(24, 6), pid: 100 }), /already exists/)
  assert.throws(() => releaseHostLock({ ...lock, nonce: '06'.repeat(24) }, { fsApi: freshFs }), /mismatch/)
  assert.equal(releaseHostLock(lock, { fsApi: freshFs }), true)
  assert.throws(() => releaseHostLock(lock, { fsApi: freshFs }), /ownership cannot be proved/)
})

test('lock directory sticky semantics refuse nonsticky peer-replaceable state', () => {
  assert.throws(() => acquireHostLock({ fsApi: fakeFs({ lockDirectoryMode: 0o770 }), platform: 'linux', callerGid: 0, uid: 0, pid: 101, randomBytes: () => Buffer.alloc(24, 11) }), /sticky/)
  const fsApi = fakeFs()
  const lock = acquireHostLock({ fsApi, platform: 'linux', callerGid: 0, uid: 0, pid: 102, randomBytes: () => Buffer.alloc(24, 12) })
  assert.throws(() => releaseHostLock({ ...lock, uid: 1 }, { fsApi }), /ownership cannot be proved/)
  assert.equal(releaseHostLock(lock, { fsApi }), true)
})
