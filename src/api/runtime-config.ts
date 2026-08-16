export interface PanelRuntimeConfig {
  controlApiBaseUrl: string
  serviceUrl: string | null
  deployment: 'standalone' | 'openwrt'
}

function metaContent(name: string): string | null {
  const value = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content.trim()
  return value ? value : null
}

export function getPanelRuntimeConfig(): PanelRuntimeConfig {
  return {
    controlApiBaseUrl: metaContent('hop-control-api-base') ?? '/api/v1',
    serviceUrl: metaContent('hop-service-url'),
    deployment: metaContent('hop-deployment') === 'openwrt' ? 'openwrt' : 'standalone',
  }
}

