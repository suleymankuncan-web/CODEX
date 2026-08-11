import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { collectFirewallEvidence, validateFirewallRules } from './onprem-core-firewall-verify.mjs'

const read = (path) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
const counterPrefix = (evidence, packets = 7, bytes = 42) => evidence.replace(/^-A /gm, `[${packets}:${bytes}] -A `)

function tableEvidence(table) {
  const evidence = read('tests/fixtures/onprem-core-firewall-valid.v4')
  const block = evidence.match(new RegExp(`^\\*${table}$[\\s\\S]*?^COMMIT$`, 'm'))?.[0]
  assert.ok(block, `fixture table ${table} is missing`)
  return `${block}\n`
}

test('firewall collector obtains deterministic authoritative evidence for every table', () => {
  const calls = []
  const evidence = collectFirewallEvidence({
    counters: true,
    execute(command, args) {
      calls.push([command, args])
      return counterPrefix(tableEvidence(args.at(-1)))
    },
  })

  assert.deepEqual(calls, [
    ['iptables-save', ['-c', '-t', 'raw']],
    ['iptables-save', ['-c', '-t', 'mangle']],
    ['iptables-save', ['-c', '-t', 'nat']],
    ['iptables-save', ['-c', '-t', 'filter']],
  ])
  for (const table of ['raw', 'mangle', 'nat', 'filter']) assert.match(evidence, new RegExp(`^\\*${table}$`, 'm'))
  assert.match(evidence, /^\[\d+:\d+\] -A /m)
})

test('firewall collector fails closed when a per-table command omits or substitutes evidence', () => {
  assert.throws(
    () => collectFirewallEvidence({ execute: () => { throw new Error('table unavailable') } }),
    /raw.*command failed/i,
  )
  assert.throws(
    () => collectFirewallEvidence({ execute: (_command, args) => args.at(-1) === 'mangle' ? '' : tableEvidence(args.at(-1)) }),
    /mangle.*missing/i,
  )
  assert.throws(
    () => collectFirewallEvidence({ execute: (_command, args) => args.at(-1) === 'mangle' ? tableEvidence('filter') : tableEvidence(args.at(-1)) }),
    /mangle.*mismatch/i,
  )
})

test('firewall verifier rejects aggregate evidence that omits an empty security table', () => {
  const result = validateFirewallRules({
    iptables: read('tests/fixtures/onprem-core-firewall-missing-mangle.v4'),
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
  assert.deepEqual(result.errors, ['complete iptables-save evidence must include the mangle table'])
})

test('read-only firewall verifier accepts ordered default-deny synthetic fixture', () => {
  const result = validateFirewallRules({
    iptables: read('tests/fixtures/onprem-core-firewall-valid.v4'),
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, true, result.errors.join('\n'))
  assert.equal(result.mutatedHost, false)
})

test('counter-prefixed ordered fixture has the same topology result as plain evidence', () => {
  const plain = read('tests/fixtures/onprem-core-firewall-valid.v4')
  const options = {
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  }
  const plainResult = validateFirewallRules({ ...options, iptables: plain })
  const countedResult = validateFirewallRules({ ...options, iptables: counterPrefix(plain) })

  assert.deepEqual({ ok: countedResult.ok, summary: countedResult.summary }, { ok: plainResult.ok, summary: plainResult.summary })
  assert.deepEqual(countedResult.errors, plainResult.errors)
})

test('firewall verifier rejects a malformed counter prefix on a required rule', () => {
  const fixture = counterPrefix(read('tests/fixtures/onprem-core-firewall-valid.v4')).replace(
    '[7:42] -A OUTPUT -d 172.30.20.0/24 -j REJECT',
    '[x:42] -A OUTPUT -d 172.30.20.0/24 -j REJECT',
  )
  const result = validateFirewallRules({
    iptables: fixture,
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('counter-prefixed rule evidence is malformed'))
})

for (const [label, malformedRule] of [
  ['tab after -A', '[x:42] -A\tOUTPUT -d 172.30.20.2/32 -j ACCEPT'],
  ['tab before -A', '[x:42]\t-A OUTPUT -d 172.30.20.2/32 -j ACCEPT'],
  ['leading whitespace', ' [x:42] -A OUTPUT -d 172.30.20.2/32 -j ACCEPT'],
]) {
  test(`firewall verifier rejects malformed prefixed unsafe bypass with ${label}`, () => {
    const fixture = counterPrefix(read('tests/fixtures/onprem-core-firewall-valid.v4')).replace(
      'COMMIT\n*filter',
      `${malformedRule}\nCOMMIT\n*filter`,
    )
    const result = validateFirewallRules({
      iptables: fixture,
      privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
      proxyPorts: [443],
      sshAdminCidrs: ['192.0.2.0/24'],
    })

    assert.equal(result.ok, false)
    assert.deepEqual(result.errors, ['counter-prefixed rule evidence is malformed'])
    assert.doesNotMatch(JSON.stringify(result), /\[x:42\]|172\.30\.20\.2\/32/)
  })
}

test('firewall verifier rejects broad accept before established traffic and egress deny', () => {
  const options = {
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  }
  const plain = validateFirewallRules({ ...options, iptables: read('tests/fixtures/onprem-core-firewall-invalid-order.v4') })
  const result = validateFirewallRules({ ...options, iptables: counterPrefix(read('tests/fixtures/onprem-core-firewall-invalid-order.v4')) })

  assert.equal(result.ok, false)
  assert.deepEqual(result.errors, plain.errors)
  assert.ok(result.errors.some((error) => /ESTABLISHED,RELATED must be accepted before broad rules/i.test(error)))
  assert.ok(result.errors.some((error) => /DOCKER-USER new egress reject must precede broad accept/i.test(error)))
})

test('firewall verifier rejects host OUTPUT reachability to project-private subnets', () => {
  const fixture = read('tests/fixtures/onprem-core-firewall-valid.v4').replace(
    '-A OUTPUT -d 172.30.20.0/24 -j REJECT',
    '-A OUTPUT -d 172.30.20.0/24 -j ACCEPT',
  )
  const result = validateFirewallRules({
    iptables: fixture,
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /host OUTPUT must reject every project-private subnet/i.test(error)))
})

test('firewall verifier rejects a container-IP OUTPUT accept before the subnet reject', () => {
  const fixture = read('tests/fixtures/onprem-core-firewall-valid.v4').replace(
    '-A OUTPUT -d 172.30.20.0/24 -j REJECT',
    '-A OUTPUT -d 172.30.20.2/32 -j ACCEPT\n-A OUTPUT -d 172.30.20.0/24 -j REJECT',
  )
  const result = validateFirewallRules({
    iptables: fixture,
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /host OUTPUT must reject every project-private subnet/i.test(error)))
})

test('firewall verifier rejects a broad RFC1918 exception instead of the exact project allowlist', () => {
  const fixture = read('tests/fixtures/onprem-core-firewall-valid.v4')
    .split(/\r?\n/)
    .filter((line) => !/^-A DOCKER-USER -s 172\.30\.[^ ]+ -d 172\.30\./.test(line))
    .join('\n')
    .replace(
      '-A DOCKER-USER -s 172.30.0.0/24 -m conntrack --ctstate NEW -j REJECT',
      '-A DOCKER-USER -s 172.30.0.0/24 ! -d 172.16.0.0/12 -m conntrack --ctstate NEW -j REJECT',
    )
  const result = validateFirewallRules({
    iptables: fixture,
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /strict project-subnet allowlist/i.test(error)))
})

test('firewall verifier rejects unscoped SSH and non-proxy inbound ports', () => {
  const fixture = read('tests/fixtures/onprem-core-firewall-valid.v4')
    .replace('-s 192.0.2.0/24 -p tcp -m tcp --dport 22 -j ACCEPT', '-p tcp -m tcp --dport 22 -j ACCEPT')
    .replace('-A INPUT -j DROP', '-A INPUT -p tcp -m tcp --dport 8080 -j ACCEPT\n-A INPUT -j DROP')
  const result = validateFirewallRules({
    iptables: fixture,
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /SSH accept must be scoped to an approved admin CIDR/i.test(error)))
  assert.ok(result.errors.some((error) => /inbound accept exposes a non-proxy port/i.test(error)))
})

test('firewall verifier rejects raw, mangle, and nat bypasses for project subnets', () => {
  const fixture = read('tests/fixtures/onprem-core-firewall-valid.v4')
    .replace('COMMIT\n*mangle', '-A PREROUTING -s 172.30.0.0/24 -j NOTRACK\nCOMMIT\n*mangle')
    .replace('COMMIT\n*nat', '-A OUTPUT -d 172.30.10.0/24 -j MARK --set-mark 1\nCOMMIT\n*nat')
    .replace('COMMIT\n*filter', '-A OUTPUT -d 172.30.10.0/24 -p tcp --dport 8080 -j DNAT --to-destination 172.30.10.5:8080\nCOMMIT\n*filter')
  const result = validateFirewallRules({
    iptables: fixture,
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /raw NOTRACK bypass/i.test(error)))
  assert.ok(result.errors.some((error) => /mangle routing-mark bypass/i.test(error)))
  assert.ok(result.errors.some((error) => /nat exposes a project-private destination outside proxy ports/i.test(error)))
})

test('counter-prefixed bypass fixture preserves every bypass rejection', () => {
  const fixture = read('tests/fixtures/onprem-core-firewall-valid.v4')
    .replace('COMMIT\n*mangle', '-A PREROUTING -s 172.30.0.0/24 -j NOTRACK\nCOMMIT\n*mangle')
    .replace('COMMIT\n*nat', '-A OUTPUT -d 172.30.10.0/24 -j MARK --set-mark 1\nCOMMIT\n*nat')
    .replace('COMMIT\n*filter', '-A OUTPUT -d 172.30.10.0/24 -p tcp --dport 8080 -j DNAT --to-destination 172.30.10.5:8080\nCOMMIT\n*filter')
  const options = {
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  }
  const plain = validateFirewallRules({ ...options, iptables: fixture })
  const counted = validateFirewallRules({ ...options, iptables: counterPrefix(fixture) })

  assert.equal(counted.ok, false)
  assert.deepEqual(counted.errors, plain.errors)
  assert.ok(counted.errors.some((error) => /raw NOTRACK bypass/i.test(error)))
  assert.ok(counted.errors.some((error) => /mangle routing-mark bypass/i.test(error)))
  assert.ok(counted.errors.some((error) => /nat exposes a project-private destination outside proxy ports/i.test(error)))
})

test('firewall verifier rejects global and container-IP bypasses inside project subnets', () => {
  const fixture = read('tests/fixtures/onprem-core-firewall-valid.v4')
    .replace('COMMIT\n*mangle', '-A PREROUTING -s 172.30.20.2/32 -j NOTRACK\n-A OUTPUT -j NOTRACK\nCOMMIT\n*mangle')
    .replace('COMMIT\n*nat', '-A OUTPUT -d 172.30.10.5/32 -j MARK --set-mark 1\nCOMMIT\n*nat')
    .replace('COMMIT\n*filter', '-A OUTPUT -p tcp --dport 8080 -j DNAT --to-destination 172.30.10.5:8080\nCOMMIT\n*filter')
  const result = validateFirewallRules({
    iptables: fixture,
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /raw NOTRACK bypass/i.test(error)))
  assert.ok(result.errors.some((error) => /mangle routing-mark bypass/i.test(error)))
  assert.ok(result.errors.some((error) => /nat exposes a project-private destination outside proxy ports/i.test(error)))
})
