import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/vue-query'

import type {
  AccessKeyCreateInput,
  AssetWriteInput,
  BootstrapKeyInput,
  CredentialWriteInput,
  KnownHostIdentity,
  NotificationChannelWriteInput,
  ProbeSettingsWriteInput,
} from '@/domain'

import { hopQueryKeys } from './keys'
import { useHopApiRuntime } from './runtime'

export interface UpdateAssetVariables {
  id: string
  input: AssetWriteInput
}

export interface BootstrapAssetKeyVariables {
  id: string
  input: BootstrapKeyInput
}

export interface UpdateCredentialVariables {
  id: string
  input: CredentialWriteInput
}

export interface UpdateNotificationChannelVariables {
  id: string
  input: NotificationChannelWriteInput
}

export interface SetAccessKeyEnabledVariables {
  id: string
  enabled: boolean
}

export interface SetAccessKeyAccessVariables {
  id: string
  assetIds: string[] | null
}

async function invalidateKeys(queryClient: QueryClient, keys: QueryKey[]): Promise<void> {
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

function catalogMutationKeys(scope: string, resourceKey: QueryKey): QueryKey[] {
  return [
    hopQueryKeys.status(scope),
    hopQueryKeys.revision(scope),
    hopQueryKeys.auditEvents(scope),
    resourceKey,
  ]
}

export function useCreateAssetMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssetWriteInput) => runtime.requireApi().createAsset(input),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.assets(runtime.scope.value)),
      ),
  })
}

export function useUpdateAssetMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: UpdateAssetVariables) => runtime.requireApi().updateAsset(id, input),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.assets(runtime.scope.value)),
      ),
  })
}

export function useDeleteAssetMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runtime.requireApi().deleteAsset(id),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        ...catalogMutationKeys(scope, hopQueryKeys.assets(scope)),
        hopQueryKeys.accessKeys(scope),
        hopQueryKeys.probeHistory(scope),
      ])
    },
  })
}

export function useProbeAssetsMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => runtime.requireApi().probeAssets(),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        hopQueryKeys.assets(scope),
        hopQueryKeys.probeHistory(scope),
        hopQueryKeys.auditEvents(scope),
      ])
    },
  })
}

export function useProbeAssetMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runtime.requireApi().probeAsset(id),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        hopQueryKeys.assets(scope),
        hopQueryKeys.probeHistory(scope),
        hopQueryKeys.auditEvents(scope),
      ])
    },
  })
}

export function useBootstrapAssetKeyMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: BootstrapAssetKeyVariables) =>
      runtime.requireApi().bootstrapAssetKey(id, input),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        ...catalogMutationKeys(scope, hopQueryKeys.assets(scope)),
        hopQueryKeys.credentials(scope),
        hopQueryKeys.probeHistory(scope),
        hopQueryKeys.knownHosts(scope),
      ])
    },
  })
}

export function useUpdateProbeSettingsMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProbeSettingsWriteInput) => runtime.requireApi().updateProbeSettings(input),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        hopQueryKeys.probeSettings(scope),
        hopQueryKeys.auditEvents(scope),
      ])
    },
  })
}

export function useCreateNotificationChannelMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NotificationChannelWriteInput) =>
      runtime.requireApi().createNotificationChannel(input),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        hopQueryKeys.notificationChannels(scope),
        hopQueryKeys.auditEvents(scope),
      ])
    },
  })
}

export function useUpdateNotificationChannelMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: UpdateNotificationChannelVariables) =>
      runtime.requireApi().updateNotificationChannel(id, input),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        hopQueryKeys.notificationChannels(scope),
        hopQueryKeys.auditEvents(scope),
      ])
    },
  })
}

export function useDeleteNotificationChannelMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runtime.requireApi().deleteNotificationChannel(id),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        hopQueryKeys.notificationChannels(scope),
        hopQueryKeys.auditEvents(scope),
      ])
    },
  })
}

export function useTestNotificationChannelMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runtime.requireApi().testNotificationChannel(id),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [hopQueryKeys.auditEvents(scope)])
    },
  })
}

export function useCreateCredentialMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CredentialWriteInput) => runtime.requireApi().createCredential(input),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.credentials(runtime.scope.value)),
      ),
  })
}

export function useUpdateCredentialMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: UpdateCredentialVariables) =>
      runtime.requireApi().updateCredential(id, input),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.credentials(runtime.scope.value)),
      ),
  })
}

export function useDeleteCredentialMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runtime.requireApi().deleteCredential(id),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.credentials(runtime.scope.value)),
      ),
  })
}

export function useCreateAccessKeyMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AccessKeyCreateInput) => runtime.requireApi().createAccessKey(input),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.accessKeys(runtime.scope.value)),
      ),
  })
}

export function useSetAccessKeyEnabledMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: SetAccessKeyEnabledVariables) =>
      runtime.requireApi().setAccessKeyEnabled(id, enabled),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.accessKeys(runtime.scope.value)),
      ),
  })
}

export function useSetAccessKeyAccessMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assetIds }: SetAccessKeyAccessVariables) =>
      runtime.requireApi().setAccessKeyAccess(id, assetIds),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.accessKeys(runtime.scope.value)),
      ),
  })
}

export function useDeleteAccessKeyMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runtime.requireApi().deleteAccessKey(id),
    onSuccess: () =>
      invalidateKeys(
        queryClient,
        catalogMutationKeys(runtime.scope.value, hopQueryKeys.accessKeys(runtime.scope.value)),
      ),
  })
}

export function useTerminateSessionMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runtime.requireApi().terminateSession(id),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        hopQueryKeys.sessions(scope),
        hopQueryKeys.auditEvents(scope),
      ])
    },
  })
}

export function useResetKnownHostMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (identity: KnownHostIdentity) => runtime.requireApi().resetKnownHost(identity),
    onSuccess: () => {
      const scope = runtime.scope.value
      return invalidateKeys(queryClient, [
        hopQueryKeys.knownHosts(scope),
        hopQueryKeys.auditEvents(scope),
      ])
    },
  })
}
