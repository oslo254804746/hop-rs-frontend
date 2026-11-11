import type { Asset, Credential } from '@/domain'

export type SshConfigMode = 'relay' | 'proxyjump'

export interface SshConfigOptions {
  hopHost: string
  hopPort: number
  mode: SshConfigMode
  identityFile?: string
  gatewayAlias?: string
}

export function parseSshListenPort(sshListen?: string | null): number {
  if (!sshListen) return 2222
  const match = /:(\d+)$/.exec(sshListen.trim())
  if (!match) return 2222
  const parsed = Number.parseInt(match[1] ?? '', 10)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65_535 ? parsed : 2222
}

export function inferDefaultHopHost(endpoint: string, browserHostname?: string): string {
  if (endpoint.trim() !== '') {
    try {
      const parsed = new URL(endpoint)
      if (parsed.hostname) return parsed.hostname
    } catch {
      // ignore invalid URL
    }
  }
  const host = (browserHostname ?? '').trim()
  if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
    return host
  }
  return 'hop.example.com'
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value
}

export function buildAssetConnectCommand(
  asset: Asset,
  hopHost: string,
  hopPort: number,
): string {
  const host = hopHost.trim() || 'hop.example.com'
  const portFlag = hopPort === 22 ? '' : ` -p ${hopPort}`
  if (asset.protocol === 'ssh') {
    return `ssh${portFlag} ${quoteIfNeeded(asset.name)}@${host}`
  }
  const localPort = asset.port < 1024 ? asset.port + 10_000 : asset.port
  return `ssh -N -L ${localPort}:${asset.name}.hop:${asset.port}${portFlag} proxy@${host}`
}

export function buildSshConfigSnippet(
  assets: Asset[],
  credentials: Credential[],
  options: SshConfigOptions,
): string {
  const host = options.hopHost.trim() || 'hop.example.com'
  const port = Number.isInteger(options.hopPort) && options.hopPort >= 1 ? options.hopPort : 2222
  const identityFile = options.identityFile?.trim() ?? ''
  const gatewayAlias = options.gatewayAlias?.trim() || 'hop-gateway'
  const credentialsById = new Map(credentials.map((item) => [item.id, item]))

  const sshAssets = [...assets]
    .filter((asset) => asset.protocol === 'ssh')
    .sort((left, right) => left.name.localeCompare(right.name))
  const tcpAssets = [...assets]
    .filter((asset) => asset.protocol === 'tcp')
    .sort((left, right) => left.name.localeCompare(right.name))

  const lines: string[] = []
  if (options.mode === 'relay') {
    lines.push('# Hop SSH Config — Vault Relay mode (terminal / scp / sftp)')
    lines.push('# Hop authenticates to targets using encrypted vault credentials.')
  } else {
    lines.push('# Hop SSH Config — End-to-End ProxyJump mode (Cursor / VS Code Remote-SSH)')
    lines.push('# Tunnels raw SSH to target sshd so LocalForward and AgentForwarding work.')
    lines.push('')
    lines.push(`Host ${quoteIfNeeded(gatewayAlias)}`)
    lines.push(`  HostName ${quoteIfNeeded(host)}`)
    lines.push(`  Port ${port}`)
    lines.push('  User proxy')
    if (identityFile) {
      lines.push(`  IdentityFile ${quoteIfNeeded(identityFile)}`)
    }
  }

  for (const asset of sshAssets) {
    lines.push('')
    lines.push(`Host ${quoteIfNeeded(asset.name)}`)
    if (asset.displayName) {
      lines.push(`  # ${asset.displayName} (${asset.hostname}:${asset.port})`)
    }
    if (options.mode === 'relay') {
      lines.push(`  HostName ${quoteIfNeeded(host)}`)
      lines.push(`  Port ${port}`)
      lines.push(`  User ${quoteIfNeeded(asset.name)}`)
      if (identityFile) {
        lines.push(`  IdentityFile ${quoteIfNeeded(identityFile)}`)
      }
    } else {
      const targetUser = asset.credentialId
        ? credentialsById.get(asset.credentialId)?.username
        : undefined
      lines.push(`  HostName ${quoteIfNeeded(`${asset.name}.hop`)}`)
      lines.push(`  Port ${asset.port}`)
      if (targetUser) {
        lines.push(`  User ${quoteIfNeeded(targetUser)}`)
      }
      lines.push(`  ProxyJump ${quoteIfNeeded(gatewayAlias)}`)
    }
  }

  if (tcpAssets.length > 0) {
    lines.push('')
    lines.push('# TCP tunnel targets (run from terminal):')
    for (const asset of tcpAssets) {
      lines.push(`# ${buildAssetConnectCommand(asset, host, port)}`)
    }
  }

  return `${lines.join('\n')}\n`
}
