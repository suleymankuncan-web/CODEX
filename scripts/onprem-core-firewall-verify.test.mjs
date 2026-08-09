import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { validateFirewallRules } from './onprem-core-firewall-verify.mjs'

const read = (path) => readFileSync(path, 'utf8')

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

test('firewall verifier rejects broad accept before established traffic and egress deny', () => {
  const result = validateFirewallRules({
    iptables: read('tests/fixtures/onprem-core-firewall-invalid-order.v4'),
    privateSubnets: ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24'],
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })

  assert.equal(result.ok, false)
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
