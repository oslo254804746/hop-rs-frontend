export const hopQueryKeys = {
  all: (scope: string) => ['hop', scope] as const,
  instance: (scope: string) => [...hopQueryKeys.all(scope), 'instance'] as const,
  status: (scope: string) => [...hopQueryKeys.instance(scope), 'status'] as const,
  catalog: (scope: string) => [...hopQueryKeys.all(scope), 'catalog'] as const,
  revision: (scope: string) => [...hopQueryKeys.catalog(scope), 'revision'] as const,
  assets: (scope: string) => [...hopQueryKeys.catalog(scope), 'assets'] as const,
  probeHistory: (scope: string) => [...hopQueryKeys.all(scope), 'probe-history'] as const,
  assetProbeHistory: (scope: string, assetId: string) =>
    [...hopQueryKeys.probeHistory(scope), assetId] as const,
  probeSettings: (scope: string) => [...hopQueryKeys.all(scope), 'probe-settings'] as const,
  notificationChannels: (scope: string) =>
    [...hopQueryKeys.all(scope), 'notification-channels'] as const,
  credentials: (scope: string) => [...hopQueryKeys.catalog(scope), 'credentials'] as const,
  accessKeys: (scope: string) => [...hopQueryKeys.catalog(scope), 'access-keys'] as const,
  sessions: (scope: string) => [...hopQueryKeys.all(scope), 'sessions'] as const,
  knownHosts: (scope: string) => [...hopQueryKeys.all(scope), 'known-hosts'] as const,
  auditEvents: (scope: string) => [...hopQueryKeys.all(scope), 'audit-events'] as const,
}
