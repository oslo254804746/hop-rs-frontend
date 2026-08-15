// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { getHopApi, hopQueryKeys } from '@/queries'
import { useConnection } from '@/stores/connection'

describe('Hop query runtime', () => {
  it('reuses one stateful demo adapter for the browser session', async () => {
    useConnection().useDemo()
    const first = getHopApi()
    const second = getHopApi()
    const name = `runtime-demo-${Date.now()}`

    expect(first).toBe(second)
    await first.createAsset({
      name,
      protocol: 'tcp',
      hostname: '127.0.0.1',
      port: 8080,
    })

    await expect(second.listAssets()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name })]),
    )
  })

  it('keeps query keys scoped and hierarchically invalidatable', () => {
    expect(hopQueryKeys.status('demo')).toEqual(['hop', 'demo', 'instance', 'status'])
    expect(hopQueryKeys.assets('live-1')).toEqual(['hop', 'live-1', 'catalog', 'assets'])
  })
})
