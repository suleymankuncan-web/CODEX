export const CADDY_IMAGE = 'caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648'
export const CADDY_CMDLINE = Object.freeze(['/run/caddy-bin/caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
export const TLS_PROBE_MARKER = 'hr-axis-onprem-tls-proof-v1'
export const TLS_WRONG_CA_CODES = Object.freeze([
  // Node/OpenSSL codes that specifically mean the presented chain is not
  // anchored by the explicitly mounted unrelated synthetic CA.
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])
export const TLS_SAFE_ERROR_CODES = Object.freeze(['ERR_TLS_CERT_ALTNAME_INVALID', ...TLS_WRONG_CA_CODES])

export function sanitizeTlsErrorCode(value) {
  const candidate = String(value ?? '')
  return /^[A-Z0-9_]{1,64}$/.test(candidate) ? candidate : 'UNKNOWN_TLS_ERROR'
}

const CADDY_MEMORY_LIMIT = 128 * 1024 * 1024

function procStatusValue(text, name) {
  return String(text).match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? ''
}

export function verifyCaddyRuntimeInvariants({
  caddyPid,
  cmdline,
  copyCapabilities,
  copyDigest,
  copyInode,
  exeInode,
  exeTarget,
  liveExeDigest,
  memoryPeakBytes,
  mountInfo,
  oomKilled,
  pathState = 'installed',
  processCount,
  procStatus,
  sourceDigest,
  tmpfsConfig,
}) {
  const fail = (condition, message) => {
    if (!condition) throw new Error(`Caddy runtime invariant failed: ${message}`)
  }
  fail(processCount === 1, 'exactly one intended Caddy process must exist')
  fail(Number.isSafeInteger(caddyPid) && caddyPid > 1, 'Caddy must be the child of Docker init, not PID 1')
  fail(JSON.stringify(cmdline) === JSON.stringify(CADDY_CMDLINE), 'Caddy cmdline must match the exact intended runtime arguments')
  const uid = procStatusValue(procStatus, 'Uid').split(/\s+/)
  const gid = procStatusValue(procStatus, 'Gid').split(/\s+/)
  fail(uid.length === 4 && uid.every((value) => value === '10001'), 'Caddy process UID must be 10001')
  fail(gid.length === 4 && gid.every((value) => value === '10001'), 'Caddy process GID must be 10001')
  for (const field of ['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb']) {
    fail(procStatusValue(procStatus, field) === '0000000000000000', `${field} must be empty`)
  }
  fail(procStatusValue(procStatus, 'NoNewPrivs') === '1', 'NoNewPrivs must equal 1')
  fail(/^[0-9a-f]{64}$/i.test(sourceDigest) && liveExeDigest === sourceDigest, 'live /proc executable SHA-256 must match the exact upstream digest')
  fail(/^\d+:\d+$/.test(exeInode) && /^\d+:\d+$/.test(copyInode), 'live and pathname executable inodes must be captured')
  if (pathState === 'installed') {
    fail(copyDigest === sourceDigest, 'source and copied SHA-256 digests must match')
    fail(exeTarget === '/run/caddy-bin/caddy', 'live executable target must be the installed tmpfs path')
    fail(exeInode === copyInode, 'live executable inode must match the installed tmpfs path')
  } else if (pathState === 'tampered') {
    fail(copyDigest !== sourceDigest, 'tamper fixture must replace the mutable pathname content')
    fail(exeTarget === '/run/caddy-bin/caddy (deleted)', 'live executable must remain on the deleted pre-tamper inode')
    fail(exeInode !== copyInode, 'tampered pathname inode must differ from the live executable inode')
  } else {
    fail(false, 'path state must be installed or tampered')
  }
  fail(String(copyCapabilities).trim() === '', 'copied executable must have no file capabilities')
  fail(oomKilled === false, 'container must not be OOM-killed')
  fail(Number.isSafeInteger(memoryPeakBytes) && memoryPeakBytes >= 0 && memoryPeakBytes <= CADDY_MEMORY_LIMIT, 'memory.peak must remain within 128 MiB')
  fail(tmpfsConfig === 'rw,nosuid,nodev,exec,size=64m,uid=10001,gid=10001,mode=0700', 'HostConfig tmpfs options must match the private bootstrap mount')
  const mount = String(mountInfo)
  fail(/\s\/run\/caddy-bin\srw,(?=[^\n]*\bnosuid\b)(?=[^\n]*\bnodev\b)(?![^\n]*\bnoexec\b)/.test(mount), 'runtime tmpfs mount must be rw,nosuid,nodev and executable (no noexec)')
  fail(/- tmpfs tmpfs rw,(?=[^\n]*\bsize=65536k\b)(?=[^\n]*\buid=10001\b)(?=[^\n]*\bgid=10001\b)(?=[^\n]*\bmode=700\b)/.test(mount), 'runtime tmpfs size, ownership, and mode must match')
  return {
    caddyPid,
    capabilitiesEmpty: true,
    copyCapabilityFree: true,
    executableDigest: liveExeDigest,
    executableInode: exeInode,
    intendedProcessCount: 1,
    liveExecutableUnchanged: true,
    memoryPeakBytes,
    noNewPrivileges: true,
    sourceCopyDigestEqual: pathState === 'installed',
    tamperedPathRejected: pathState === 'tampered',
    tmpfsVerified: true,
    uidGid: '10001:10001',
  }
}

export function buildTlsProbeDockerArgs({ caPath, caddyProxyIp, host, image, network, probeScript = '', verifyHost }) {
  for (const [name, value] of Object.entries({ caPath, caddyProxyIp, host, image, network, verifyHost })) {
    if (!String(value ?? '').trim()) throw new Error(`TLS proof requires ${name}`)
  }
  return [
    'run', '--rm',
    '--network', network,
    '--read-only',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true',
    '--volume', `${caPath}:/run/proof/ca.crt:ro`,
    '--env', 'PROOF_CA=/run/proof/ca.crt',
    '--env', `PROOF_HOST=${host}`,
    '--env', `PROOF_VERIFY_HOST=${verifyHost}`,
    '--env', `PROOF_IP=${caddyProxyIp}`,
    '--entrypoint', '/nodejs/bin/node',
    image,
    '-e', probeScript,
  ]
}

export function classifyTlsProbeResult(output, expectation) {
  const fail = (observedCode = '') => {
    const observed = /^[A-Z0-9_]{1,64}$/.test(String(observedCode)) ? String(observedCode) : 'UNAVAILABLE'
    throw new Error(`TLS proof did not produce the exact ${expectation} classification (observed=${observed})`)
  }
  if (!['success', 'wrong-host', 'wrong-ca'].includes(expectation)) fail()
  if (!Number.isInteger(output?.status) || String(output?.stderr ?? '').trim() !== '') fail()
  const lines = String(output?.stdout ?? '').trim().split(/\r?\n/).filter(Boolean)
  if (lines.length !== 1) fail()
  let payload
  try {
    payload = JSON.parse(lines[0])
  } catch {
    fail()
  }
  if (!payload || Array.isArray(payload) || payload.marker !== TLS_PROBE_MARKER) fail()
  const keys = Object.keys(payload).sort().join(',')

  if (expectation === 'success') {
    if (output.status !== 0 || keys !== 'marker,result,statusCode' || payload.result !== 'success' || payload.statusCode !== 200) fail()
    return { code: null, result: 'success', statusCode: 200 }
  }

  if (output.status !== 20 || keys !== 'code,marker,result' || payload.result !== 'tls_error' || typeof payload.code !== 'string') fail()
  if (expectation === 'wrong-host' && payload.code !== 'ERR_TLS_CERT_ALTNAME_INVALID') fail(payload.code)
  if (expectation === 'wrong-ca' && !TLS_WRONG_CA_CODES.includes(payload.code)) fail(payload.code)
  return { code: payload.code, result: 'tls_error', statusCode: null }
}
