export function createRecoveryFixedCommands(binaries) {
  return new Map([
    ['git', '/usr/bin/git'],
    ['sudo', binaries.sudo],
    ['systemctl', '/usr/bin/systemctl'],
    ['findmnt', '/usr/bin/findmnt'],
    ['docker', '/usr/bin/docker'],
    ['id', '/usr/bin/id'],
    ['iptables-save', binaries.ipv4Save],
    ['iptables-restore', binaries.ipv4Restore],
    ['ip6tables-save', binaries.ipv6Save],
    ['ip6tables-restore', binaries.ipv6Restore],
  ])
}
