import { describe, expect, it } from 'vitest'

import type { Asset, Credential } from '@/domain'

import {
  buildAssetConnectCommand,
  buildSshConfigSnippet,
  inferDefaultHopHost,
  parseSshListenPort,
} from './ssh-config'

const sampleAssets: Asset[] = [
  {
    id: 'a1',
    name: 'prod-gateway',
    protocol: 'ssh',
    hostname: '10.24.0.12',
    port: 2222,
    displayName: 'HK Edge',
    description: null,
    tags: ['edge'],
    credentialId: 'c1',
    createdAt: null,
    updatedAt: null,
  },
  {
    id: 'a2',
    name: 'router-ui',
    protocol: 'tcp',
    hostname: '192.168.50.1',
    port: 443,
    displayName: null,
    description: null,
    tags: [],
    credentialId: null,
    createdAt: null,
    updatedAt: null,
  },
]

const sampleCredentials: Credential[] = [
  {
    id: 'c1',
    name: 'deploy-key',
    username: 'deploy',
    authType: 'key',
    password: 'missing',
    privateKey: 'configured',
    passphrase: 'missing',
  },
]

describe('ssh-config utilities', () => {
  it('parses ssh_listen ports and infers default hosts', () => {
    expect(parseSshListenPort('0.0.0.0:2222')).toBe(2222)
    expect(parseSshListenPort('[::]:2200')).toBe(2200)
    expect(parseSshListenPort(undefined)).toBe(2222)

    expect(inferDefaultHopHost('https://bastion.internal:8443', 'localhost')).toBe(
      'bastion.internal',
    )
    expect(inferDefaultHopHost('', '192.168.1.1')).toBe('192.168.1.1')
    expect(inferDefaultHopHost('', 'localhost')).toBe('hop.example.com')
  })

  it('builds one-click SSH and TCP tunnel commands', () => {
    expect(buildAssetConnectCommand(sampleAssets[0]!, 'hop.example.com', 2222)).toBe(
      'ssh -p 2222 prod-gateway@hop.example.com',
    )
    expect(buildAssetConnectCommand(sampleAssets[1]!, 'hop.example.com', 2222)).toBe(
      'ssh -N -L 10443:router-ui.hop:443 -p 2222 proxy@hop.example.com',
    )
  })

  it('generates Vault Relay and ProxyJump ssh_config blocks', () => {
    const relay = buildSshConfigSnippet(sampleAssets, sampleCredentials, {
      hopHost: 'hop.example.com',
      hopPort: 2222,
      mode: 'relay',
      identityFile: '~/.ssh/id_ed25519',
    })
    expect(relay).toContain('Host prod-gateway')
    expect(relay).toContain('User prod-gateway')
    expect(relay).toContain('IdentityFile ~/.ssh/id_ed25519')

    const proxyjump = buildSshConfigSnippet(sampleAssets, sampleCredentials, {
      hopHost: 'hop.example.com',
      hopPort: 2222,
      mode: 'proxyjump',
    })
    expect(proxyjump).toContain('Host hop-gateway')
    expect(proxyjump).toContain('User proxy')
    expect(proxyjump).toContain('HostName prod-gateway.hop')
    expect(proxyjump).toContain('Port 2222')
    expect(proxyjump).toContain('User deploy')
    expect(proxyjump).toContain('ProxyJump hop-gateway')
  })
})
