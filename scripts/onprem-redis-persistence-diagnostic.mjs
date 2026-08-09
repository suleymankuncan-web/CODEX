function boundedText(value, limit = 2048) {
  const text = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  return text.length <= limit ? text : `${text.slice(0, limit)}…[truncated]`
}

export function assertProbeOutput(output, expected) {
  const text = `${output.stdout}\n${output.stderr}`
  if (!/"event"\s*:\s*"onprem\.synthetic_queue_probe\.completed"/.test(text)) {
    throw new Error(`synthetic queue ${expected.mode} omitted the completion event`)
  }
  for (const [key, value] of Object.entries(expected)) {
    const rendered = typeof value === 'string' ? `"${value}"` : String(value)
    if (!new RegExp(`"${key}"\\s*:\\s*${rendered}`).test(text)) {
      throw new Error(`synthetic queue ${expected.mode} result mismatch for ${key}`)
    }
  }
}

export function parseProbeCompletion(output, expectedMode) {
  const records = `${output?.stdout ?? ''}\n${output?.stderr ?? ''}`
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
  const record = records.find((candidate) =>
    candidate?.event === 'onprem.synthetic_queue_probe.completed'
      && candidate?.mode === expectedMode,
  )
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`synthetic queue ${expectedMode} omitted the completion event`)
  }
  return record
}

function exactFlag(value, label) {
  if (value !== 0 && value !== 1) throw new Error(`${label} must be a closed existence flag`)
  return value
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`)
  return value
}

export function classifyStoppedAofCommandSequence(input) {
  const JOB_KEY = 'bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1'
  const DELAYED_KEY = 'bull:hr-axis-onprem-synthetic-recovery-v1:delayed'
  const SENTINEL_KEY = 'hr-axis:onprem:synthetic-recovery-v1:enqueued'
  const MEMBER = 'synthetic-recovery-v1'
  const MAX_BYTES = 1024 * 1024
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input ?? '')
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error('AOF command stream exceeded its bounded size')

  let offset = 0
  const line = () => {
    const end = bytes.indexOf('\r\n', offset)
    if (end < 0) throw new Error('AOF command stream contained malformed RESP')
    const value = bytes.subarray(offset, end).toString('ascii')
    offset = end + 2
    return value
  }
  const integer = (value) => {
    if (!/^(?:0|[1-9]\d*)$/.test(value)) throw new Error('AOF command stream contained malformed RESP')
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed)) throw new Error('AOF command stream contained malformed RESP')
    return parsed
  }
  const command = () => {
    if (bytes[offset] !== 42) throw new Error('AOF command stream contained malformed RESP')
    offset += 1
    const count = integer(line())
    if (count < 1 || count > 128) throw new Error('AOF command stream contained malformed RESP')
    const args = []
    for (let index = 0; index < count; index += 1) {
      if (bytes[offset] !== 36) throw new Error('AOF command stream contained malformed RESP')
      offset += 1
      const length = integer(line())
      if (length > MAX_BYTES || offset + length + 2 > bytes.length) throw new Error('AOF command stream contained malformed RESP')
      const value = bytes.subarray(offset, offset + length).toString('utf8')
      offset += length
      if (bytes[offset] !== 13 || bytes[offset + 1] !== 10) throw new Error('AOF command stream contained malformed RESP')
      offset += 2
      args.push(value)
    }
    return args
  }

  const summary = {
    commandCount: 0,
    completeTransactionCount: 0,
    lastJobHashEffect: 'missing',
    lastJobHashEffectIndex: 0,
    lastDelayedEffect: 'missing',
    lastDelayedEffectIndex: 0,
    lastSentinelEffect: 'missing',
    lastSentinelEffectIndex: 0,
  }
  let delayedScore = null
  let transaction = null
  const setEffect = (target, effect, index) => {
    summary[target] = effect
    summary[`${target}Index`] = index
  }
  const scoreBound = (value, lower) => {
    if (value === '-inf') return { value: Number.NEGATIVE_INFINITY, exclusive: false }
    if (value === '+inf') return { value: Number.POSITIVE_INFINITY, exclusive: false }
    const exclusive = value.startsWith('(')
    const parsed = Number(exclusive ? value.slice(1) : value)
    if (!Number.isFinite(parsed)) throw new Error('AOF delayed range contained an unsafe score')
    return { value: parsed, exclusive, lower }
  }
  const rangeContains = (score, minimum, maximum) => {
    const min = scoreBound(minimum, true)
    const max = scoreBound(maximum, false)
    return (min.exclusive ? score > min.value : score >= min.value)
      && (max.exclusive ? score < max.value : score <= max.value)
  }
  const apply = (args, index) => {
    const name = String(args[0] ?? '').toUpperCase()
    const keys = args.slice(1)
    if (name === 'HMSET' || name === 'HSET') {
      if (args[1] === JOB_KEY) setEffect('lastJobHashEffect', 'present', index)
      return
    }
    if (name === 'SET') {
      if (args[1] === SENTINEL_KEY) setEffect('lastSentinelEffect', 'present', index)
      return
    }
    if (name === 'DEL' || name === 'UNLINK') {
      if (keys.includes(JOB_KEY)) setEffect('lastJobHashEffect', 'absent', index)
      if (keys.includes(DELAYED_KEY)) {
        delayedScore = null
        setEffect('lastDelayedEffect', 'absent', index)
      }
      if (keys.includes(SENTINEL_KEY)) setEffect('lastSentinelEffect', 'absent', index)
      return
    }
    if (name === 'ZADD' && args[1] === DELAYED_KEY) {
      const options = new Set(['NX', 'XX', 'GT', 'LT', 'CH', 'INCR'])
      let position = 2
      while (position < args.length && options.has(String(args[position]).toUpperCase())) position += 1
      for (; position + 1 < args.length; position += 2) {
        if (args[position + 1] === MEMBER) {
          const parsed = Number(args[position])
          if (!Number.isFinite(parsed)) throw new Error('AOF delayed member contained an unsafe score')
          delayedScore = parsed
          setEffect('lastDelayedEffect', 'present', index)
        }
      }
      return
    }
    if (name === 'ZREM' && args[1] === DELAYED_KEY) {
      if (args.slice(2).includes(MEMBER)) {
        delayedScore = null
        setEffect('lastDelayedEffect', 'absent', index)
      }
      return
    }
    if (name === 'ZREMRANGEBYSCORE' && args[1] === DELAYED_KEY) {
      if (delayedScore === null) throw new Error('AOF delayed range effect was not safely attributable')
      if (rangeContains(delayedScore, args[2] ?? '', args[3] ?? '')) {
        delayedScore = null
        setEffect('lastDelayedEffect', 'absent', index)
      }
      return
    }
    if (['FLUSHALL', 'FLUSHDB', 'SWAPDB'].includes(name)) {
      throw new Error('AOF contained an unknown destructive operation touching the probe state')
    }
    const trackedKeyTouched = keys.includes(JOB_KEY) || keys.includes(DELAYED_KEY) || keys.includes(SENTINEL_KEY)
    const destructive = /^(?:HDEL|GETDEL|GETEX|EXPIRE|PEXPIRE|EXPIREAT|PEXPIREAT|RENAME|RENAMENX|RESTORE|ZPOPMIN|ZPOPMAX|ZREMRANGEBYLEX|ZREMRANGEBYRANK)$/
    if (trackedKeyTouched && destructive.test(name)) {
      throw new Error('AOF contained an unknown destructive operation touching the probe state')
    }
  }

  while (offset < bytes.length) {
    const args = command()
    summary.commandCount += 1
    const name = String(args[0] ?? '').toUpperCase()
    if (name === 'MULTI') {
      if (transaction) throw new Error('AOF command stream contained an incomplete transaction')
      transaction = []
      continue
    }
    if (name === 'EXEC') {
      if (!transaction) throw new Error('AOF command stream contained an incomplete transaction')
      for (const entry of transaction) apply(entry.args, entry.index)
      transaction = null
      summary.completeTransactionCount += 1
      continue
    }
    if (transaction) transaction.push({ args, index: summary.commandCount })
    else apply(args, summary.commandCount)
  }
  if (transaction) throw new Error('AOF command stream contained an incomplete transaction')
  if (
    summary.lastJobHashEffect === 'missing'
    || summary.lastDelayedEffect === 'missing'
    || summary.lastSentinelEffect === 'missing'
  ) throw new Error('AOF expected creation missing')
  return summary
}

export function resolveStoppedAofManifest(manifestText, actualNames) {
  const allowed = /^appendonly\.aof\.\d+\.(?:base\.(?:rdb|aof)|incr\.aof)$/
  if (!Array.isArray(actualNames) || actualNames.some((name) => typeof name !== 'string' || !allowed.test(name))) {
    throw new Error('AOF manifest inventory was unsafe')
  }
  const entries = String(manifestText ?? '').split(/\r?\n/).filter(Boolean).map((line) => {
    const match = line.match(/^file ([A-Za-z0-9._-]+) seq ([1-9]\d*) type ([bi])$/)
    if (!match || !allowed.test(match[1])) throw new Error('AOF manifest was unsafe')
    return { name: match[1], seq: Number(match[2]), type: match[3] }
  })
  if (entries.length === 0) throw new Error('AOF manifest was unsafe')
  const names = new Set(entries.map((entry) => entry.name))
  const identities = new Set(entries.map((entry) => `${entry.type}:${entry.seq}`))
  if (
    names.size !== entries.length
    || identities.size !== entries.length
    || actualNames.some((name) => !names.has(name))
    || entries.some((entry) => !actualNames.includes(entry.name))
  ) throw new Error('AOF manifest contained an orphan entry')
  const incremental = entries.filter((entry) => entry.type === 'i').sort((left, right) => left.seq - right.seq)
  if (incremental.length === 0) throw new Error('AOF manifest omitted incremental AOF state')
  return incremental.map((entry) => entry.name)
}

export function readBoundedAofFiles(names, { stat, read, maxBytes = 1024 * 1024, maxFiles = 16 }) {
  if (
    !Array.isArray(names)
    || names.length === 0
    || names.length > maxFiles
    || typeof stat !== 'function'
    || typeof read !== 'function'
  ) throw new Error('AOF file inventory exceeded its bounded shape')
  let totalBytes = 0
  for (const name of names) {
    const size = stat(name)?.size
    if (!Number.isSafeInteger(size) || size < 0 || size > maxBytes) {
      throw new Error('AOF file inventory exceeded its bounded size')
    }
    totalBytes += size
    if (totalBytes > maxBytes) throw new Error('AOF file inventory exceeded its bounded size')
  }
  return names.map((name) => read(name))
}

export function buildStoppedAofSemanticInspectorScript() {
  const classifySource = classifyStoppedAofCommandSequence.toString()
  const resolveManifestSource = resolveStoppedAofManifest.toString()
  const readBoundedSource = readBoundedAofFiles.toString()
  return [
    "const fs=require('node:fs')",
    "const path=require('node:path')",
    `const classify=${classifySource}`,
    `const resolveManifest=${resolveManifestSource}`,
    `const readBounded=${readBoundedSource}`,
    "const dir='/data/appendonlydir'",
    "const manifestPath=path.join(dir,'appendonly.aof.manifest')",
    "const manifest=fs.readFileSync(manifestPath,'utf8')",
    "const actual=fs.readdirSync(dir).filter((name)=>/^appendonly\\.aof\\.\\d+\\.(?:base\\.(?:rdb|aof)|incr\\.aof)$/.test(name))",
    "const incremental=resolveManifest(manifest,actual)",
    "const buffers=readBounded(incremental,{stat:(name)=>fs.statSync(path.join(dir,name)),read:(name)=>fs.readFileSync(path.join(dir,name))})",
    "try{process.stdout.write(`semantic|${JSON.stringify({analysisStatus:'ok',reason:'none',...classify(Buffer.concat(buffers))})}\\n`)}catch(error){const message=String(error?.message??'');const reason=/incomplete transaction/.test(message)?'aof_add_transaction_incomplete':/expected creation missing/.test(message)?'aof_expected_creation_missing':/unknown destructive|range effect/.test(message)?'aof_unsafe_destructive_effect':'aof_malformed_or_unsafe';process.stdout.write(`semantic|${JSON.stringify({analysisStatus:'error',reason})}\\n`)}",
  ].join(';')
}

export function collectStoppedAofInventoryEvidence({
  command, assertNoSecretLeak, secretValues, volumeName, redisImage, workerImage,
}) {
  const common = [
    'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--user', '999:1000',
    '--memory', '128m', '--pids-limit', '32',
    '--volume', `${volumeName}:/data:ro`,
  ]
  const validation = command('docker', [
    ...common,
    '--tmpfs', '/aof-check:rw,noexec,nosuid,nodev,size=2m,mode=0700,uid=999,gid=1000',
    '--entrypoint', '/bin/sh', redisImage, '-ec', buildStoppedAofInventoryScript(),
  ], { allowFailure: true, label: 'read-only stopped Redis AOF validation' })
  assertNoSecretLeak(secretValues, {
    'stopped Redis AOF validation stderr': validation.stderr,
    'stopped Redis AOF validation stdout': validation.stdout,
  })
  if (validation.status !== 0) {
    throw new Error('stopped Redis AOF validation failed {"reason":"aof_readonly_validation_failed"}')
  }
  const semantic = command('docker', [
    ...common, '--entrypoint', '/nodejs/bin/node', workerImage, '-e', buildStoppedAofSemanticInspectorScript(),
  ], { allowFailure: true, label: 'read-only stopped Redis AOF semantic inspection' })
  assertNoSecretLeak(secretValues, {
    'stopped Redis AOF semantic inspection stderr': semantic.stderr,
    'stopped Redis AOF semantic inspection stdout': semantic.stdout,
  })
  if (semantic.status !== 0) {
    throw new Error('stopped Redis AOF semantic inspection failed {"reason":"aof_semantic_inspection_failed"}')
  }
  return parseStoppedAofInventory(`${validation.stdout}\n${semantic.stdout}`)
}

export function assertStoppedAofCommandSequence(inventory) {
  const sequence = inventory?.commandSequence
  if (sequence?.analysisStatus !== 'ok') {
    throw new Error(`stopped Redis AOF semantic proof failed ${JSON.stringify({ reason: sequence?.reason ?? 'aof_malformed_or_unsafe' })}`)
  }
  if (
    sequence.lastJobHashEffect !== 'present'
    || sequence.lastDelayedEffect !== 'present'
    || sequence.lastSentinelEffect !== 'present'
  ) throw new Error('stopped Redis AOF semantic proof failed {"reason":"aof_contains_later_cleanup"}')
}

export function assertPostRedisLoadCheckpoint(checkpoint) {
  if (
    checkpoint?.jobHashExists !== 1
    || checkpoint?.delayedMembershipExists !== 1
    || checkpoint?.enqueueSentinelExists !== 1
  ) throw new Error('Redis committed AOF replay mismatch {"reason":"aof_committed_state_replay_mismatch"}')
}

export function sanitizeQueuePersistenceCheckpoint(output, checkpoint) {
  if (!['pre_stop', 'post_redis_load', 'post_runtime_reconnect'].includes(checkpoint)) {
    throw new Error('unsupported Redis persistence checkpoint')
  }
  const record = parseProbeCompletion(output, 'snapshot')
  const persistence = record.persistence
  if (!persistence || typeof persistence !== 'object' || Array.isArray(persistence)) {
    throw new Error('synthetic queue snapshot omitted persistence state')
  }
  const status = (value) => ['ok', 'err', 'unknown'].includes(value) ? value : 'unknown'
  return {
    checkpoint,
    jobHashExists: exactFlag(record.jobHashExists, 'job hash'),
    delayedMembershipExists: exactFlag(record.delayedMembershipExists, 'delayed membership'),
    enqueueSentinelExists: exactFlag(record.enqueueSentinelExists, 'enqueue sentinel'),
    processedMarkerExists: exactFlag(record.processedMarkerExists, 'processed marker'),
    dbSize: nonNegativeInteger(record.dbSize, 'Redis DBSIZE'),
    persistence: {
      aofEnabled: exactFlag(persistence.aofEnabled, 'AOF enabled'),
      aofRewriteInProgress: exactFlag(persistence.aofRewriteInProgress, 'AOF rewrite in progress'),
      aofRewriteScheduled: exactFlag(persistence.aofRewriteScheduled, 'AOF rewrite scheduled'),
      aofCurrentSize: nonNegativeInteger(persistence.aofCurrentSize, 'AOF current size'),
      aofBaseSize: nonNegativeInteger(persistence.aofBaseSize, 'AOF base size'),
      aofPendingBioFsync: nonNegativeInteger(persistence.aofPendingBioFsync, 'AOF pending fsync'),
      aofDelayedFsync: nonNegativeInteger(persistence.aofDelayedFsync, 'AOF delayed fsync'),
      aofLastWriteStatus: status(persistence.aofLastWriteStatus),
      aofLastBgrewriteStatus: status(persistence.aofLastBgrewriteStatus),
    },
  }
}

export function parseStoppedAofInventory(text) {
  const lines = String(text ?? '').split(/\r?\n/).filter(Boolean)
  const manifest = lines.shift()?.match(/^manifest\|([01])$/)
  if (!manifest) throw new Error('stopped Redis AOF inventory omitted manifest state')
  const allowedName = /^(?:appendonly\.aof\.manifest|appendonly\.aof\.\d+\.(?:base\.(?:rdb|aof)|incr\.aof))$/
  const semanticLines = lines.filter((line) => line.startsWith('semantic|'))
  if (semanticLines.length > 1) throw new Error('stopped Redis AOF inventory duplicated semantic evidence')
  const fileLines = lines.filter((line) => !line.startsWith('semantic|'))
  const files = fileLines.map((line) => {
    const [prefix, fileName, sizeText, sha256Digest, jobToken, sentinelToken, ...extra] = line.split('|')
    const sizeBytes = Number(sizeText)
    if (
      prefix !== 'file'
      || extra.length > 0
      || !allowedName.test(fileName ?? '')
      || !Number.isSafeInteger(sizeBytes)
      || sizeBytes < 0
      || !/^[0-9a-f]{64}$/.test(sha256Digest ?? '')
      || !/^[01]$/.test(jobToken ?? '')
      || !/^[01]$/.test(sentinelToken ?? '')
    ) throw new Error('stopped Redis AOF inventory contained an unsafe or malformed entry')
    return {
      fileName,
      sizeBytes,
      sha256: sha256Digest,
      containsExpectedJobToken: jobToken === '1',
      containsExpectedSentinelToken: sentinelToken === '1',
    }
  })
  let commandSequence
  if (semanticLines.length === 1) {
    let candidate
    try {
      candidate = JSON.parse(semanticLines[0].slice('semantic|'.length))
    } catch {
      throw new Error('stopped Redis AOF semantic evidence was malformed')
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('stopped Redis AOF semantic evidence was malformed')
    }
    const status = candidate.analysisStatus
    const reason = candidate.reason
    const allowedReasons = new Set([
      'none', 'aof_add_transaction_incomplete', 'aof_expected_creation_missing',
      'aof_unsafe_destructive_effect', 'aof_malformed_or_unsafe',
    ])
    if (!['ok', 'error'].includes(status) || !allowedReasons.has(reason)) {
      throw new Error('stopped Redis AOF semantic evidence was malformed')
    }
    if (status === 'error') {
      if (reason === 'none' || Object.keys(candidate).some((key) => !['analysisStatus', 'reason'].includes(key))) {
        throw new Error('stopped Redis AOF semantic evidence was malformed')
      }
      commandSequence = { analysisStatus: 'error', reason }
    } else {
      const effects = ['present', 'absent']
      const exactKeys = [
        'analysisStatus', 'reason', 'commandCount', 'completeTransactionCount',
        'lastJobHashEffect', 'lastJobHashEffectIndex', 'lastDelayedEffect',
        'lastDelayedEffectIndex', 'lastSentinelEffect', 'lastSentinelEffectIndex',
      ]
      if (
        reason !== 'none'
        || Object.keys(candidate).length !== exactKeys.length
        || Object.keys(candidate).some((key) => !exactKeys.includes(key))
        || !effects.includes(candidate.lastJobHashEffect)
        || !effects.includes(candidate.lastDelayedEffect)
        || !effects.includes(candidate.lastSentinelEffect)
      ) throw new Error('stopped Redis AOF semantic evidence was malformed')
      commandSequence = {
        analysisStatus: 'ok',
        reason: 'none',
        commandCount: nonNegativeInteger(candidate.commandCount, 'AOF command count'),
        completeTransactionCount: nonNegativeInteger(candidate.completeTransactionCount, 'AOF transaction count'),
        lastJobHashEffect: candidate.lastJobHashEffect,
        lastJobHashEffectIndex: nonNegativeInteger(candidate.lastJobHashEffectIndex, 'AOF job effect index'),
        lastDelayedEffect: candidate.lastDelayedEffect,
        lastDelayedEffectIndex: nonNegativeInteger(candidate.lastDelayedEffectIndex, 'AOF delayed effect index'),
        lastSentinelEffect: candidate.lastSentinelEffect,
        lastSentinelEffectIndex: nonNegativeInteger(candidate.lastSentinelEffectIndex, 'AOF sentinel effect index'),
      }
    }
  }
  return { manifestPresent: manifest[1] === '1', files, ...(commandSequence ? { commandSequence } : {}) }
}

function parseDockerLogTimestamp(value) {
  const match = String(value ?? '').match(/^(?:\S+\s+\|\s+)?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s+/)
  if (!match) return null
  const normalized = match[1].replace(/\.(\d{3})\d+Z$/, '.$1Z')
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function classifyRedisPersistenceLogs(value, since = null) {
  const boundary = since === null || since === undefined ? null : Date.parse(String(since))
  if (since !== null && since !== undefined && !Number.isFinite(boundary)) {
    throw new Error('Redis restart log boundary must be a valid timestamp')
  }
  const text = String(value ?? '')
    .split(/\r?\n/)
    .filter((line) => boundary === null || (() => {
      const timestamp = parseDockerLogTimestamp(line)
      return timestamp !== null && timestamp >= boundary
    })())
    .join('\n')
  return {
    aofLoadObserved: /(?:Reading RDB base file on AOF loading|DB loaded from .*appendonly|DB loaded from append only file)/i.test(text),
    aofTruncationWarning: /(?:AOF[^\r\n]*truncat|short read|aof-load-truncated[^\r\n]*enabled)/i.test(text),
    aofCorruptionWarning: /(?:Bad file format|AOF[^\r\n]*corrupt|invalid[^\r\n]*AOF)/i.test(text),
    newAofBaseCreated: /(?:Creating|created)[^\r\n]*AOF base file/i.test(text),
    incrementalAofOpened: /(?:Creating|Opening|opened)[^\r\n]*AOF incr(?:emental)? file|appendonly\.aof\.\d+\.incr\.aof/i.test(text),
    shutdownFsyncError: /(?:fsync[^\r\n]*(?:error|failed)|(?:error|failed)[^\r\n]*fsync)/i.test(text),
  }
}

export function buildStoppedAofInventoryScript() {
  return [
    'set -eu',
    'dir=/data/appendonlydir',
    'work=/aof-check',
    'if [ ! -d "$dir" ]; then printf "manifest|0\\n"; exit 0; fi',
    'if [ ! -r "$dir" ] || [ ! -x "$dir" ]; then exit 42; fi',
    'if [ ! -d "$work" ] || [ ! -w "$work" ] || [ ! -x "$work" ]; then exit 44; fi',
    'if [ -f "$dir/appendonly.aof.manifest" ]; then printf "manifest|1\\n"; else printf "manifest|0\\n"; fi',
    'count=0',
    'total=0',
    'for hidden in "$dir"/.[!.]* "$dir"/..?*; do',
    '  [ -e "$hidden" ] || [ -L "$hidden" ] || continue',
    '  exit 41',
    'done',
    'for path in "$dir"/*; do',
    '  [ ! -L "$path" ] || exit 41',
    '  [ -e "$path" ] || continue',
    '  [ -f "$path" ] || exit 41',
    '  name=${path##*/}',
    '  case "$name" in appendonly.aof.manifest|appendonly.aof.*.base.rdb|appendonly.aof.*.base.aof|appendonly.aof.*.incr.aof) ;; *) exit 41 ;; esac',
    '  size=$(wc -c < "$path" | tr -d " ")',
    '  case "$size" in ""|*[!0-9]*) exit 45 ;; esac',
    '  count=$((count + 1))',
    '  total=$((total + size))',
    '  if [ "$count" -gt 17 ] || [ "$total" -gt 1048576 ]; then exit 45; fi',
    '  cp "$path" "$work/$name"',
    '  digest=$(sha256sum "$path" | cut -d " " -f 1)',
    '  if grep -aFq "bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1" "$path"; then job=1; else job=0; fi',
    '  if grep -aFq "hr-axis:onprem:synthetic-recovery-v1:enqueued" "$path"; then sentinel=1; else sentinel=0; fi',
    '  printf "file|%s|%s|%s|%s|%s\\n" "$name" "$size" "$digest" "$job" "$sentinel"',
    'done',
    'redis-check-aof "$work/appendonly.aof.manifest" >/dev/null 2>&1 || exit 43',
  ].join('\n')
}

export function buildQueueSnapshotComposeArgs(checkpoint) {
  return {
    args: ['run', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', 'snapshot'],
    profiles: ['runtime'],
    label: `synthetic queue ${checkpoint} snapshot`,
  }
}

export function classifyQueueFailureReason(error) {
  const message = String(error?.message ?? '')
  const phase = message.match(/"phase"\s*:\s*"(pause|unpause)"/)?.[1]
  if (phase === 'pause') return 'runtime_pause_failed'
  if (phase === 'unpause') return 'runtime_unpause_failed'
  const candidate = message.match(/"reason"\s*:\s*"([a-z_]+)"/)?.[1]
  return [
    'worker_error', 'job_failed', 'worker_run_failed', 'aof_fsync_not_acknowledged',
    'aof_add_transaction_incomplete', 'aof_expected_creation_missing',
    'aof_unsafe_destructive_effect', 'aof_malformed_or_unsafe',
    'aof_contains_later_cleanup', 'aof_committed_state_replay_mismatch',
    'aof_readonly_validation_failed', 'aof_semantic_inspection_failed',
    'redis_connect_timeout', 'state_read_timeout', 'worker_timeout',
    'runtime_pause_failed', 'runtime_unpause_failed', 'unexpected',
  ].includes(candidate) ? candidate : 'unexpected'
}

export function runtimeIsolationFailure(phase, service, state, reason) {
  const safeStatus = ['created', 'running', 'paused', 'exited', 'dead', 'removing'].includes(state?.Status)
    ? state.Status
    : 'unknown'
  const diagnostic = boundedText(JSON.stringify({
    event: 'onprem.redis_runtime_isolation.failed',
    phase,
    reason,
    service,
    state: {
      status: safeStatus,
      running: state?.Running === true,
      paused: state?.Paused === true,
      restarting: state?.Restarting === true,
      oomKilled: state?.OOMKilled === true,
    },
  }))
  return new Error(`Redis runtime ${phase} failed ${diagnostic}`)
}

export function collectRedisRestartLogDelta({ command, assertNoSecretLeak, secretValues, containerId, since }) {
  const output = command('docker', ['logs', '--since', since, '--timestamps', containerId], {
    allowFailure: true,
    label: 'bounded Redis restart log delta',
  })
  assertNoSecretLeak(secretValues, {
    'Redis restart log delta stderr': output.stderr,
    'Redis restart log delta stdout': output.stdout,
  })
  if (output.status !== 0) throw new Error('Redis restart log delta collection failed')
  return `${output.stdout}\n${output.stderr}`
}

export function createRuntimeIsolationControls({ compose, command, assertNoSecretLeak, secretValues }) {
  const inspectRuntimeTarget = (target) => {
    const output = command('docker', ['inspect', target.id], { label: `inspect ${target.service} runtime isolation state` })
    assertNoSecretLeak(secretValues, { [`docker inspect ${target.service} runtime isolation`]: output.stdout })
    const inspect = JSON.parse(output.stdout)[0]
    return inspect?.State ?? {}
  }

  const resolveRuntimeTarget = (service) => {
    const id = compose(['ps', '--quiet', service], ['runtime']).stdout.trim()
    if (!id) throw runtimeIsolationFailure('target', service, {}, 'container_missing')
    return { service, id }
  }

  const pauseRuntimeService = (target) => {
    let before
    try {
      before = inspectRuntimeTarget(target)
      if (before.Paused === true || before.Status !== 'running' || before.Running !== true) {
        throw runtimeIsolationFailure('pause', target.service, before, 'state_not_running')
      }
      command('docker', ['pause', target.id], { label: `pause ${target.service} before Redis restart` })
      const after = inspectRuntimeTarget(target)
      if (after.Paused !== true) throw runtimeIsolationFailure('pause', target.service, after, 'state_not_paused')
    } catch (error) {
      if (error?.message?.startsWith('Redis runtime pause failed ')) throw error
      throw runtimeIsolationFailure('pause', target.service, before ?? {}, 'runtime_pause_failed')
    }
  }

  const unpauseRuntimeService = (target) => {
    let before
    try {
      before = inspectRuntimeTarget(target)
      if (before.Paused !== true) {
        if (before.Status !== 'running' || before.Running !== true) {
          throw runtimeIsolationFailure('unpause', target.service, before, 'state_not_running')
        }
        return
      }
      command('docker', ['unpause', target.id], { label: `unpause ${target.service} after Redis restart` })
      const after = inspectRuntimeTarget(target)
      if (after.Paused === true || after.Status !== 'running' || after.Running !== true) {
        throw runtimeIsolationFailure('unpause', target.service, after, 'state_still_paused')
      }
    } catch (error) {
      if (error?.message?.startsWith('Redis runtime unpause failed ')) throw error
      throw runtimeIsolationFailure('unpause', target.service, before ?? {}, 'runtime_unpause_failed')
    }
  }

  return { inspectRuntimeTarget, resolveRuntimeTarget, pauseRuntimeService, unpauseRuntimeService }
}
