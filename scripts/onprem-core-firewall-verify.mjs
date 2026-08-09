import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REQUIRED_TABLES = ['raw', 'mangle', 'nat', 'filter']

export function collectFirewallEvidence({ counters = false, execute = execFileSync } = {}) {
  return REQUIRED_TABLES.map((table) => {
    let evidence
    try {
      evidence = String(execute('iptables-save', [...(counters ? ['-c'] : []), '-t', table], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }))
    } catch {
      throw new Error(`${table} table evidence command failed`)
    }

    if (!evidence.trim()) throw new Error(`${table} table evidence is missing`)
    const tableHeaders = [...evidence.matchAll(/^\*([^\s]+)$/gm)].map((match) => match[1])
    if (tableHeaders.length !== 1 || tableHeaders[0] !== table) {
      throw new Error(`${table} table evidence mismatch`)
    }
    if (!/^COMMIT$/m.test(evidence)) throw new Error(`${table} table evidence is incomplete`)
    return evidence.trim()
  }).join('\n') + '\n'
}

function chainRules(text, chain) {
  return text.split(/\r?\n/).filter((line) => line.startsWith(`-A ${chain} `))
}

function hasEstablished(rule) {
  return /--ctstate (?:ESTABLISHED,RELATED|RELATED,ESTABLISHED)/.test(rule) && /-j ACCEPT\b/.test(rule)
}

function destinationPort(rule) {
  const value = rule.match(/--dport (\d+)/)?.[1]
  return value ? Number(value) : null
}

function isProjectInternalAllow(rule, privateSubnets) {
  return /--ctstate NEW/.test(rule)
    && /-j ACCEPT\b/.test(rule)
    && !/(?:^|\s)!\s*-d\s/.test(rule)
    && privateSubnets.some((source) => rule.includes(`-s ${source}`))
    && privateSubnets.some((destination) => rule.includes(`-d ${destination}`))
}

function ipv4Range(cidr) {
  const match = String(cidr).match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d|[12]\d|3[0-2]))?$/)
  if (!match) return null
  const octets = match[1].split('.').map(Number)
  if (octets.some((octet) => octet > 255)) return null
  const bits = Number(match[2] ?? 32)
  const value = octets.reduce((result, octet) => ((result << 8) | octet) >>> 0, 0)
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  const start = (value & mask) >>> 0
  const size = 2 ** (32 - bits)
  return { end: start + size - 1, start }
}

function rangesOverlap(left, right) {
  return left.start <= right.end && right.start <= left.end
}

function bypassRuleTouchesProject(rule, privateSubnets) {
  if (/(?:^|\s)!\s*(?:-s|--source|-d|--destination)\s/.test(rule)) return true
  const addressTokens = [...rule.matchAll(/(?:^|\s)(?:-s|--source|-d|--destination|--to-destination)\s+([^\s]+)/g)]
    .map((match) => match[1].replace(/:\d+$/, ''))
    .map(ipv4Range)
    .filter(Boolean)
  if (addressTokens.length === 0) return true
  const projectRanges = privateSubnets.map(ipv4Range).filter(Boolean)
  return addressTokens.some((candidate) =>
    projectRanges.some((project) => rangesOverlap(candidate, project)),
  )
}

export function validateFirewallRules({ iptables, privateSubnets, proxyPorts, sshAdminCidrs }) {
  const errors = []
  const input = chainRules(iptables, 'INPUT')
  const dockerUser = chainRules(iptables, 'DOCKER-USER')
  const output = chainRules(iptables, 'OUTPUT')
  const inputEstablished = input.findIndex(hasEstablished)
  const firstInputAccept = input.findIndex((rule) => /-j ACCEPT\b/.test(rule))

  for (const table of REQUIRED_TABLES) {
    if (!new RegExp(`^\\*${table}$`, 'm').test(iptables)) {
      errors.push(`complete iptables-save evidence must include the ${table} table`)
    }
  }

  if (!/^:INPUT DROP\b/m.test(iptables) || !/^:FORWARD DROP\b/m.test(iptables)) {
    errors.push('INPUT and FORWARD default policies must be DROP')
  }
  if (inputEstablished < 0 || (firstInputAccept >= 0 && inputEstablished > firstInputAccept)) {
    errors.push('ESTABLISHED,RELATED must be accepted before broad rules')
  }
  if (input.some((rule) => /^\-A INPUT -j ACCEPT$/.test(rule))) {
    errors.push('unconditional INPUT accept is a bypass')
  }

  for (const subnet of privateSubnets) {
    const rejectIndex = dockerUser.findIndex((rule) =>
      rule.includes(`-s ${subnet}`)
        && /--ctstate NEW/.test(rule)
        && /-j (?:REJECT|DROP)\b/.test(rule)
        && !/(?:^|\s)!?\s*-d\s/.test(rule),
    )
    const broadIndex = dockerUser.findIndex((rule) =>
      /-j (?:ACCEPT|RETURN)\b/.test(rule)
        && !hasEstablished(rule)
        && !isProjectInternalAllow(rule, privateSubnets),
    )
    if (rejectIndex < 0 || (broadIndex >= 0 && rejectIndex > broadIndex)) {
      errors.push(`DOCKER-USER new egress reject must precede broad accept for ${subnet}`)
    }
    for (const destination of privateSubnets) {
      const allowIndex = dockerUser.findIndex((rule) =>
        rule.includes(`-s ${subnet}`)
          && rule.includes(`-d ${destination}`)
          && /--ctstate NEW/.test(rule)
          && !/(?:^|\s)!\s*-d\s/.test(rule)
          && /-j ACCEPT\b/.test(rule),
      )
      if (allowIndex < 0 || rejectIndex < 0 || allowIndex > rejectIndex) {
        errors.push(`DOCKER-USER must explicitly allow ${subnet} to project subnet ${destination} before its egress reject`)
      }
    }

    const outputRejectIndex = output.findIndex((rule) =>
      rule.includes(`-d ${subnet}`)
        && !/(?:^|\s)!\s*-d\s/.test(rule)
        && !/(?:^|\s)!?\s*-s\s/.test(rule)
        && /-j (?:REJECT|DROP)\b/.test(rule),
    )
    const outputBypassIndex = output.findIndex((rule) =>
      /-j (?:ACCEPT|RETURN)\b/.test(rule)
        && bypassRuleTouchesProject(rule, [subnet]),
    )
    if (outputRejectIndex < 0 || (outputBypassIndex >= 0 && outputRejectIndex > outputBypassIndex)) {
      errors.push(`host OUTPUT must reject every project-private subnet (${subnet}) before any bypass`)
    }
  }

  if (dockerUser.some((rule) => privateSubnets.some((subnet) => rule.includes(`-s ${subnet}`)) && /!\s+-d\s/.test(rule) && /-j (?:REJECT|DROP)\b/.test(rule))) {
    errors.push('negated destination exceptions cannot replace the strict project-subnet allowlist')
  }

  for (const rule of input.filter((candidate) => /-j ACCEPT\b/.test(candidate) && !hasEstablished(candidate) && !/\s-i lo\b/.test(candidate))) {
    const port = destinationPort(rule)
    if (port === 22) {
      if (!sshAdminCidrs.some((cidr) => rule.includes(`-s ${cidr}`))) {
        errors.push('SSH accept must be scoped to an approved admin CIDR')
      }
      continue
    }
    if (port === null || !proxyPorts.includes(port)) {
      errors.push(`inbound accept exposes a non-proxy port (${port ?? 'any'})`)
    }
  }
  for (const port of proxyPorts) {
    if (!input.some((rule) => destinationPort(rule) === port && /-j ACCEPT\b/.test(rule))) {
      errors.push(`approved proxy port ${port} is not accepted`)
    }
  }

  for (const rule of iptables.split(/\r?\n/).filter((line) => line.startsWith('-A '))) {
    const touchesPrivateSubnet = bypassRuleTouchesProject(rule, privateSubnets)
    if (!touchesPrivateSubnet) continue
    if (/\s-j NOTRACK\b/.test(rule)) errors.push('raw NOTRACK bypass is forbidden for project-private subnets')
    if (/\s-j (?:MARK|CONNMARK|TOS)\b/.test(rule)) errors.push('mangle routing-mark bypass is forbidden for project-private subnets')
    if (/\s-j (?:DNAT|REDIRECT)\b/.test(rule)) {
      const port = destinationPort(rule) ?? Number(rule.match(/--to-destination [^:]+:(\d+)/)?.[1] ?? 0)
      if (!proxyPorts.includes(port)) errors.push('nat exposes a project-private destination outside proxy ports')
    }
  }

  return {
    errors: [...new Set(errors)],
    mutatedHost: false,
    ok: errors.length === 0,
    summary: {
      dockerUserRuleCount: dockerUser.length,
      inputRuleCount: input.length,
      outputRuleCount: output.length,
      privateSubnetCount: privateSubnets.length,
    },
  }
}

function parseArgs(argv) {
  const result = { privateSubnets: [], proxyPorts: [], sshAdminCidrs: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') result.input = argv[++index]
    else if (arg === '--subnet') result.privateSubnets.push(argv[++index])
    else if (arg === '--proxy-port') result.proxyPorts.push(Number(argv[++index]))
    else if (arg === '--ssh-admin-cidr') result.sshAdminCidrs.push(argv[++index])
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (result.privateSubnets.length === 0) throw new Error('at least one --subnet is required')
  if (result.proxyPorts.length === 0) throw new Error('at least one --proxy-port is required')
  if (result.sshAdminCidrs.length === 0) throw new Error('at least one --ssh-admin-cidr is required')
  return result
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const iptables = options.input
      ? readFileSync(options.input, 'utf8')
      : collectFirewallEvidence()
    const result = validateFirewallRules({ ...options, iptables })
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exitCode = 1
  } catch (error) {
    console.error(`on-prem core firewall verifier: ${error.message}`)
    process.exitCode = 2
  }
}
