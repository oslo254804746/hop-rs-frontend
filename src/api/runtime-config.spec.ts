// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import { getPanelRuntimeConfig } from './runtime-config'

afterEach(() => {
  document.head.innerHTML = ''
})

describe('getPanelRuntimeConfig', () => {
  it('uses the standalone defaults when the host does not inject metadata', () => {
    expect(getPanelRuntimeConfig()).toEqual({
      controlApiBaseUrl: '/api/v1',
      deployment: 'standalone',
      serviceUrl: null,
    })
  })

  it('reads the LuCI proxy and service routes injected into the panel document', () => {
    document.head.innerHTML = `
      <meta name="hop-control-api-base" content=" /cgi-bin/luci/admin/services/hop/api/v1 ">
      <meta name="hop-service-url" content="/cgi-bin/luci/admin/services/hop/settings">
      <meta name="hop-deployment" content="openwrt">
    `

    expect(getPanelRuntimeConfig()).toEqual({
      controlApiBaseUrl: '/cgi-bin/luci/admin/services/hop/api/v1',
      deployment: 'openwrt',
      serviceUrl: '/cgi-bin/luci/admin/services/hop/settings',
    })
  })
})

