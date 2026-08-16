import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/vue-query'

import type {
  AccessKeyCreateInput,
  ApplyManifestInput,
  AssetWriteInput,
  CredentialWriteInput,
  DiffManifestInput,
  KnownHostIdentity,
  ValidateManifestInput,
} from '@/domain'

import { hopQueryKeys } from './keys'
import { useHopApiRuntime } from './runtime'

export interface UpdateAssetVariables {
  id: string
  input: AssetWriteInput
}

export interface UpdateCredentialVariables {
  id: string
  input: CredentialWriteInput
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
      ])
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: hopQueryKeys.sessions(runtime.scope.value) }),
  })
}

export function useResetKnownHostMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (identity: KnownHostIdentity) => runtime.requireApi().resetKnownHost(identity),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: hopQueryKeys.knownHosts(runtime.scope.value) }),
  })
}

export function useValidateManifestMutation() {
  const runtime = useHopApiRuntime()
  return useMutation({
    mutationFn: (input: ValidateManifestInput) => runtime.requireApi().validateManifest(input),
  })
}

export function useDiffManifestMutation() {
  const runtime = useHopApiRuntime()
  return useMutation({
    mutationFn: (input: DiffManifestInput) => runtime.requireApi().diffManifest(input),
  })
}

export function useApplyManifestMutation() {
  const runtime = useHopApiRuntime()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApplyManifestInput) => runtime.requireApi().applyManifest(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: hopQueryKeys.all(runtime.scope.value) }),
  })
}
