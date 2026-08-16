import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'

import { hopQueryKeys } from './keys'
import { useHopApiRuntime } from './runtime'

export function useStatusQuery() {
  const runtime = useHopApiRuntime()
  return useQuery({
    queryKey: computed(() => hopQueryKeys.status(runtime.scope.value)),
    queryFn: ({ signal }) => runtime.requireApi().getStatus({ signal }),
    enabled: runtime.ready,
  })
}

export function useRevisionQuery() {
  const runtime = useHopApiRuntime()
  return useQuery({
    queryKey: computed(() => hopQueryKeys.revision(runtime.scope.value)),
    queryFn: ({ signal }) => runtime.requireApi().getRevision({ signal }),
    enabled: runtime.ready,
  })
}

export function useAssetsQuery() {
  const runtime = useHopApiRuntime()
  return useQuery({
    queryKey: computed(() => hopQueryKeys.assets(runtime.scope.value)),
    queryFn: ({ signal }) => runtime.requireApi().listAssets({ signal }),
    enabled: runtime.ready,
  })
}

export function useCredentialsQuery() {
  const runtime = useHopApiRuntime()
  return useQuery({
    queryKey: computed(() => hopQueryKeys.credentials(runtime.scope.value)),
    queryFn: ({ signal }) => runtime.requireApi().listCredentials({ signal }),
    enabled: runtime.ready,
  })
}

export function useAccessKeysQuery() {
  const runtime = useHopApiRuntime()
  return useQuery({
    queryKey: computed(() => hopQueryKeys.accessKeys(runtime.scope.value)),
    queryFn: ({ signal }) => runtime.requireApi().listAccessKeys({ signal }),
    enabled: runtime.ready,
  })
}

export function useSessionsQuery() {
  const runtime = useHopApiRuntime()
  return useQuery({
    queryKey: computed(() => hopQueryKeys.sessions(runtime.scope.value)),
    queryFn: ({ signal }) => runtime.requireApi().listSessions({ signal }),
    enabled: runtime.ready,
  })
}

export function useKnownHostsQuery() {
  const runtime = useHopApiRuntime()
  return useQuery({
    queryKey: computed(() => hopQueryKeys.knownHosts(runtime.scope.value)),
    queryFn: ({ signal }) => runtime.requireApi().listKnownHosts({ signal }),
    enabled: runtime.ready,
  })
}
