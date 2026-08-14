<script setup lang="ts">
import {
  Archive,
  Braces,
  Check,
  CircleCheck,
  FileCheck2,
  FileCode2,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
  Workflow,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { BaseButton, ConfirmDialog, EmptyState, InlineNotice, StatusBadge } from '@/components/ui'
import type {
  ApplyAction,
  ApplyManifestInput,
  ApplySummary,
  ManifestFormat,
} from '@/domain'
import {
  useApplyManifestMutation,
  useConfigStatusQuery,
  useDiffManifestMutation,
  useReloadConfigMutation,
  useRevisionQuery,
  useValidateManifestMutation,
} from '@/queries'
import { formatRelativeTime, formatTimestamp } from '@/utils/format'

const starterYaml = `api_version: hop/v1alpha1

assets: {}
credentials: {}
access: {}
`

const configQuery = useConfigStatusQuery()
const revisionQuery = useRevisionQuery()
const validateMutation = useValidateManifestMutation()
const diffMutation = useDiffManifestMutation()
const applyMutation = useApplyManifestMutation()
const reloadMutation = useReloadConfigMutation()

const format = ref<ManifestFormat>('yaml')
const sourceId = ref('panel')
const content = ref(starterYaml)
const prune = ref(false)
const offline = ref(false)
const validatedKey = ref<string | null>(null)
const diffKey = ref<string | null>(null)
const diffSummary = ref<ApplySummary | null>(null)
const operationSummaries = ref<ApplySummary[]>([])
const operationLabel = ref('')
const workflowError = ref('')
const revisionConflict = ref('')
const reloadMessage = ref('')
const applyOpen = ref(false)
const reloadOpen = ref(false)

const workflowKey = computed(() =>
  JSON.stringify({
    content: content.value,
    format: format.value,
    sourceId: sourceId.value.trim(),
    prune: prune.value,
    offline: offline.value,
  }),
)
const configStatus = computed(() => configQuery.data.value)
const sources = computed(() => configStatus.value?.sources ?? [])
const orphans = computed(() => configStatus.value?.orphans ?? [])
const sourceErrors = computed(() => sources.value.filter((source) => source.lastErrorCode !== null))
const currentRevision = computed(
  () => revisionQuery.data.value ?? configStatus.value?.revision ?? null,
)
const isRefreshing = computed(
  () => configQuery.isFetching.value || revisionQuery.isFetching.value,
)
const validatedCurrent = computed(() => validatedKey.value === workflowKey.value)
const diffCurrent = computed(
  () => diffKey.value === workflowKey.value && diffSummary.value !== null,
)
const diffStale = computed(
  () =>
    diffSummary.value !== null &&
    currentRevision.value !== null &&
    diffSummary.value.baseRevision !== currentRevision.value,
)
const canValidate = computed(
  () =>
    content.value.trim() !== '' &&
    validSourceId(sourceId.value.trim()) &&
    !validateMutation.isPending.value,
)
const canDiff = computed(
  () =>
    validatedCurrent.value &&
    !diffMutation.isPending.value &&
    !validateMutation.isPending.value,
)
const canApply = computed(
  () =>
    diffCurrent.value &&
    !diffStale.value &&
    !applyMutation.isPending.value &&
    !diffMutation.isPending.value,
)
const queryError = computed(() => errorMessage(configQuery.error.value ?? revisionQuery.error.value))

watch(workflowKey, () => {
  validatedKey.value = null
  diffKey.value = null
  diffSummary.value = null
  operationSummaries.value = []
  operationLabel.value = ''
  workflowError.value = ''
  revisionConflict.value = ''
  validateMutation.reset()
  diffMutation.reset()
  applyMutation.reset()
})

function validSourceId(value: string) {
  return value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._-]+$/.test(value)
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return error ? String(error) : ''
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  return typeof error.code === 'string' ? error.code : null
}

function refreshConfiguration() {
  void Promise.all([configQuery.refetch(), revisionQuery.refetch()])
}

async function runValidate() {
  if (!canValidate.value) return
  const requestKey = workflowKey.value
  workflowError.value = ''
  revisionConflict.value = ''
  operationSummaries.value = []
  operationLabel.value = ''

  try {
    await validateMutation.mutateAsync({
      content: content.value,
      format: format.value,
      offline: offline.value,
    })
    if (workflowKey.value !== requestKey) return
    validatedKey.value = requestKey
    diffKey.value = null
    diffSummary.value = null
  } catch (error) {
    validatedKey.value = null
    workflowError.value = errorMessage(error) || 'The manifest could not be validated.'
  }
}

async function runDiff() {
  if (!canDiff.value) return
  const requestKey = workflowKey.value
  workflowError.value = ''
  revisionConflict.value = ''
  operationSummaries.value = []
  operationLabel.value = ''

  try {
    const summary = await diffMutation.mutateAsync({
      content: content.value,
      format: format.value,
      sourceId: sourceId.value.trim(),
      prune: prune.value,
    })
    if (workflowKey.value !== requestKey) return
    diffSummary.value = summary
    diffKey.value = requestKey
    await revisionQuery.refetch()
  } catch (error) {
    diffKey.value = null
    workflowError.value = errorMessage(error) || 'Hop could not calculate a manifest diff.'
  }
}

async function runApply() {
  const preview = diffSummary.value
  if (!canApply.value || preview === null) return
  const requestKey = workflowKey.value
  const requestContent = content.value
  const requestFormat = format.value
  const requestSourceId = sourceId.value.trim()
  const requestPrune = prune.value
  workflowError.value = ''
  revisionConflict.value = ''

  try {
    const revisionResult = await revisionQuery.refetch()
    if (revisionResult.isError) throw revisionResult.error
    const latestRevision = revisionResult.data
    if (latestRevision === undefined) {
      throw new Error('The current Catalog revision could not be read.')
    }
    if (latestRevision !== preview.baseRevision) {
      diffKey.value = null
      revisionConflict.value = `Catalog moved from r${preview.baseRevision} to r${latestRevision}. Run Diff again before applying.`
      applyOpen.value = false
      return
    }
    if (workflowKey.value !== requestKey || diffKey.value !== requestKey) {
      applyOpen.value = false
      workflowError.value = 'The manifest changed after the diff. Validate and preview it again before applying.'
      return
    }

    const input: ApplyManifestInput = {
      content: requestContent,
      format: requestFormat,
      sourceId: requestSourceId,
      baseRevision: latestRevision,
      prune: requestPrune,
      dryRun: false,
    }
    const summary = await applyMutation.mutateAsync(input)
    applyOpen.value = false
    operationLabel.value = 'Manifest applied'
    operationSummaries.value = [summary]
    validatedKey.value = null
    diffKey.value = null
    diffSummary.value = null
    await revisionQuery.refetch()
  } catch (error) {
    applyOpen.value = false
    if (errorCode(error) === 'revision_conflict') {
      diffKey.value = null
      revisionConflict.value = `${errorMessage(error)} Run Diff again against the latest Catalog revision.`
      void revisionQuery.refetch()
      return
    }
    workflowError.value = errorMessage(error) || 'The manifest could not be applied.'
  }
}

async function runReload() {
  reloadMessage.value = ''
  workflowError.value = ''
  revisionConflict.value = ''

  try {
    const result = await reloadMutation.mutateAsync()
    reloadOpen.value = false
    operationLabel.value = 'Configured sources reloaded'
    operationSummaries.value = result.applied
    reloadMessage.value = result.applied.length
      ? `${result.applied.length} configured source${result.applied.length === 1 ? '' : 's'} completed the Apply pipeline.`
      : 'This Hop instance has no configured inventory sources to reload.'
    if (diffSummary.value !== null) {
      diffKey.value = null
      revisionConflict.value = 'Configured sources were reloaded. Run Diff again before applying the editor manifest.'
    }
    await Promise.all([configQuery.refetch(), revisionQuery.refetch()])
  } catch (error) {
    reloadOpen.value = false
    reloadMessage.value = ''
    workflowError.value = errorMessage(error) || 'Configured sources could not be reloaded.'
  }
}

function actionTone(action: ApplyAction): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (action === 'created') return 'success'
  if (action === 'updated') return 'info'
  if (action === 'deleted') return 'danger'
  if (action === 'orphaned') return 'warning'
  return 'neutral'
}

function summaryChangeCount(summary: ApplySummary) {
  return summary.created + summary.updated + summary.deleted + summary.orphaned
}
</script>

<template>
  <section class="configuration-page page-stack" aria-labelledby="configuration-title">
    <header class="page-intro configuration-intro">
      <div>
        <h1 id="configuration-title">Configuration</h1>
        <p>Inspect source state, preview declarative changes, and apply against an explicit Catalog revision.</p>
      </div>
      <div class="intro-actions">
        <button
          class="icon-button"
          type="button"
          :disabled="isRefreshing"
          aria-label="Refresh configuration"
          title="Refresh configuration"
          @click="refreshConfiguration"
        >
          <RefreshCw :size="18" :class="{ 'is-spinning': isRefreshing }" aria-hidden="true" />
        </button>
        <BaseButton
          variant="secondary"
          :disabled="reloadMutation.isPending.value"
          @click="reloadOpen = true"
        >
          <template #leading><RotateCw /></template>
          Reload sources
        </BaseButton>
      </div>
    </header>

    <InlineNotice
      v-if="queryError"
      tone="danger"
      title="Configuration state could not be loaded"
    >
      {{ queryError }}
      <template #actions>
        <BaseButton variant="secondary" @click="refreshConfiguration">Retry</BaseButton>
      </template>
    </InlineNotice>

    <InlineNotice v-if="workflowError" tone="danger" title="Configuration action failed">
      {{ workflowError }}
    </InlineNotice>

    <InlineNotice v-if="reloadMessage" tone="success" title="Reload completed">
      {{ reloadMessage }}
    </InlineNotice>

    <section class="catalog-ledger panel" aria-label="Catalog configuration status">
      <div class="catalog-lead">
        <span class="catalog-mark" aria-hidden="true"><Workflow :size="22" /></span>
        <div>
          <strong>Catalog revision <span class="tabular">r{{ currentRevision ?? '—' }}</span></strong>
          <small>Manifest schema <span class="mono">{{ configStatus?.manifestApiVersion ?? '—' }}</span></small>
        </div>
      </div>
      <dl>
        <div>
          <dt>Sources</dt>
          <dd class="tabular">{{ sources.length }}</dd>
        </div>
        <div>
          <dt>Source errors</dt>
          <dd class="tabular" :class="{ warning: sourceErrors.length > 0 }">{{ sourceErrors.length }}</dd>
        </div>
        <div>
          <dt>Orphans</dt>
          <dd class="tabular" :class="{ warning: orphans.length > 0 }">{{ orphans.length }}</dd>
        </div>
      </dl>
    </section>

    <div class="configuration-grid">
      <div class="source-column">
        <section class="source-panel panel" aria-labelledby="sources-heading">
          <header class="section-heading">
            <div>
              <h2 id="sources-heading">Configuration sources</h2>
              <p>Last successful generation and the current recorded error.</p>
            </div>
            <StatusBadge
              :label="sourceErrors.length ? `${sourceErrors.length} need attention` : 'No source errors'"
              :tone="sourceErrors.length ? 'warning' : 'success'"
            />
          </header>

          <div v-if="configQuery.isPending.value" class="source-loading" aria-busy="true">
            <span v-for="index in 3" :key="index" />
          </div>

          <EmptyState
            v-else-if="sources.length === 0"
            title="No configured sources"
            description="The local Catalog remains available. Reload has no work until inventory sources are configured on the Hop instance."
            :icon="FileCode2"
            compact
          />

          <ul v-else class="source-list">
            <li v-for="source in sources" :key="source.sourceId" class="source-row">
              <div class="source-identity">
                <span class="source-icon" :class="{ error: source.lastErrorCode }" aria-hidden="true">
                  <TriangleAlert v-if="source.lastErrorCode" :size="17" />
                  <FileCheck2 v-else :size="17" />
                </span>
                <span>
                  <strong>{{ source.sourceId }}</strong>
                  <small>Generation <span class="tabular">{{ source.generation }}</span></small>
                </span>
              </div>
              <div class="source-state">
                <StatusBadge
                  :label="source.lastErrorCode ? 'Error' : 'Current'"
                  :tone="source.lastErrorCode ? 'danger' : 'success'"
                />
                <small>
                  {{ source.lastErrorAt
                    ? `Failed ${formatRelativeTime(source.lastErrorAt)}`
                    : source.lastSuccessAt
                      ? `Applied ${formatRelativeTime(source.lastSuccessAt)}`
                      : 'Never applied' }}
                </small>
              </div>
              <div v-if="source.lastErrorCode" class="source-error">
                <code>{{ source.lastErrorCode }}</code>
                <p>{{ source.lastErrorMessage ?? 'Hop did not return an error message.' }}</p>
              </div>
              <dl v-else class="source-facts">
                <div>
                  <dt>Last success</dt>
                  <dd>{{ formatTimestamp(source.lastSuccessAt) }}</dd>
                </div>
                <div>
                  <dt>Revision</dt>
                  <dd class="tabular">{{ source.lastSuccessRevision === null ? '—' : `r${source.lastSuccessRevision}` }}</dd>
                </div>
              </dl>
            </li>
          </ul>
        </section>

        <section class="orphan-panel panel" aria-labelledby="orphans-heading">
          <header class="section-heading">
            <div>
              <h2 id="orphans-heading">Orphaned resources</h2>
              <p>Source-owned records no longer present in the latest manifest.</p>
            </div>
            <StatusBadge
              :label="orphans.length ? `${orphans.length} retained` : 'None'"
              :tone="orphans.length ? 'warning' : 'success'"
            />
          </header>

          <EmptyState
            v-if="!configQuery.isPending.value && orphans.length === 0"
            title="No orphaned resources"
            description="Every reported source-owned resource is still declared."
            :icon="ShieldCheck"
            compact
          />

          <ul v-else class="orphan-list">
            <li v-for="orphan in orphans" :key="`${orphan.sourceId}-${orphan.sourceKey}`">
              <span class="orphan-mark" aria-hidden="true"><Archive :size="17" /></span>
              <span>
                <strong>{{ orphan.sourceKey }}</strong>
                <small>{{ orphan.resourceType }} · source {{ orphan.sourceId }}</small>
              </span>
              <time>{{ formatRelativeTime(orphan.orphanedAt) }}</time>
            </li>
          </ul>
        </section>
      </div>

      <section class="manifest-panel panel" aria-labelledby="manifest-heading">
        <header class="manifest-heading">
          <span class="manifest-mark" aria-hidden="true"><Braces :size="21" /></span>
          <div>
            <h2 id="manifest-heading">Manifest workflow</h2>
            <p>Validate, inspect the diff, then apply the exact revision you reviewed.</p>
          </div>
        </header>

        <form class="manifest-form" @submit.prevent>
          <div class="field-row">
            <label class="field">
              <span>Source ID</span>
              <input
                v-model="sourceId"
                autocomplete="off"
                spellcheck="false"
                :aria-invalid="!validSourceId(sourceId.trim())"
              />
              <small v-if="!validSourceId(sourceId.trim())" class="field-error">
                Use 1–128 letters, digits, periods, hyphens, or underscores.
              </small>
              <small v-else>Ownership namespace for this manifest.</small>
            </label>
            <label class="field format-field">
              <span>Format</span>
              <select v-model="format">
                <option value="yaml">YAML</option>
                <option value="toml">TOML</option>
              </select>
              <small>Parsed by Hop, not by the browser.</small>
            </label>
          </div>

          <label class="field manifest-editor">
            <span>Manifest content</span>
            <textarea
              v-model="content"
              class="mono"
              rows="16"
              spellcheck="false"
              autocomplete="off"
              placeholder="api_version: hop/v1alpha1"
            />
          </label>

          <div class="manifest-options">
            <label class="check-field">
              <input v-model="offline" type="checkbox" />
              <span>
                <strong>Offline validation</strong>
                <small>Do not resolve references against the current Catalog.</small>
              </span>
            </label>
            <label class="check-field">
              <input v-model="prune" type="checkbox" />
              <span>
                <strong>Prune missing resources</strong>
                <small>Delete source-owned records absent from this manifest instead of orphaning them.</small>
              </span>
            </label>
          </div>
        </form>

        <ol class="workflow-steps" aria-label="Manifest apply workflow">
          <li :class="{ complete: validatedCurrent }">
            <span class="step-mark" aria-hidden="true">
              <Check v-if="validatedCurrent" :size="16" />
              <span v-else>1</span>
            </span>
            <span>
              <strong>Validate</strong>
              <small>{{ validatedCurrent ? 'Current editor content is valid.' : 'Check syntax, material, and references.' }}</small>
            </span>
            <BaseButton
              variant="secondary"
              :loading="validateMutation.isPending.value"
              :disabled="!canValidate"
              @click="runValidate"
            >
              Validate manifest
            </BaseButton>
          </li>
          <li :class="{ complete: diffCurrent && !diffStale }">
            <span class="step-mark" aria-hidden="true">
              <Check v-if="diffCurrent && !diffStale" :size="16" />
              <span v-else>2</span>
            </span>
            <span>
              <strong>Diff</strong>
              <small>{{ diffCurrent && diffSummary
                ? `${summaryChangeCount(diffSummary)} changes against r${diffSummary.baseRevision}.`
                : 'Build a read-only change plan.' }}</small>
            </span>
            <BaseButton
              variant="secondary"
              :loading="diffMutation.isPending.value"
              :disabled="!canDiff"
              @click="runDiff"
            >
              Preview diff
            </BaseButton>
          </li>
          <li :class="{ complete: operationLabel === 'Manifest applied' }">
            <span class="step-mark" aria-hidden="true">
              <Check v-if="operationLabel === 'Manifest applied'" :size="16" />
              <span v-else>3</span>
            </span>
            <span>
              <strong>Apply</strong>
              <small>{{ diffSummary
                ? `Requires Catalog r${diffSummary.baseRevision}.`
                : 'Available after a current diff.' }}</small>
            </span>
            <BaseButton
              variant="primary"
              :disabled="!canApply"
              @click="applyOpen = true"
            >
              Apply manifest
            </BaseButton>
          </li>
        </ol>

        <InlineNotice
          v-if="validatedCurrent && !diffSummary"
          tone="success"
          title="Manifest is valid"
        >
          Validation passed for the current editor content. Preview a diff before applying it.
        </InlineNotice>

        <InlineNotice
          v-if="revisionConflict || diffStale"
          tone="warning"
          title="Diff is no longer current"
        >
          {{ revisionConflict || `Catalog is now r${currentRevision}; this diff was built against r${diffSummary?.baseRevision}. Run Diff again.` }}
        </InlineNotice>

        <section v-if="diffSummary" class="diff-preview" aria-labelledby="diff-heading">
          <header class="summary-heading">
            <div>
              <h3 id="diff-heading">Diff preview</h3>
              <p>
                <span class="mono">{{ diffSummary.sourceId }}</span>
                · <span class="tabular">r{{ diffSummary.baseRevision }} → r{{ diffSummary.newRevision }}</span>
              </p>
            </div>
            <StatusBadge
              :label="diffStale ? 'Stale' : diffSummary.dryRun ? 'Dry run' : 'Applied'"
              :tone="diffStale ? 'warning' : 'info'"
            />
          </header>
          <div class="summary-counts">
            <span><strong>{{ diffSummary.created }}</strong> created</span>
            <span><strong>{{ diffSummary.updated }}</strong> updated</span>
            <span><strong>{{ diffSummary.deleted }}</strong> deleted</span>
            <span><strong>{{ diffSummary.orphaned }}</strong> orphaned</span>
            <span><strong>{{ diffSummary.unchanged }}</strong> unchanged</span>
          </div>
          <div class="change-list" role="table" aria-label="Manifest diff changes">
            <div class="change-head" role="row">
              <span role="columnheader">Resource</span>
              <span role="columnheader">Name</span>
              <span role="columnheader">Action</span>
            </div>
            <div v-for="change in diffSummary.changes" :key="`${change.resourceType}-${change.name}`" class="change-row" role="row">
              <span role="cell">{{ change.resourceType }}</span>
              <code role="cell">{{ change.name }}</code>
              <span role="cell"><StatusBadge :label="change.action" :tone="actionTone(change.action)" /></span>
            </div>
            <p v-if="diffSummary.changes.length === 0" class="no-changes">No resource changes are required.</p>
          </div>
        </section>

        <section v-if="operationLabel" class="operation-results" aria-labelledby="operation-heading">
          <header class="summary-heading">
            <div>
              <h3 id="operation-heading">{{ operationLabel }}</h3>
              <p>{{ operationSummaries.length ? `${operationSummaries.length} Apply summary${operationSummaries.length === 1 ? '' : ' results'}` : 'No source Apply was required.' }}</p>
            </div>
            <StatusBadge label="Complete" tone="success" :icon="CircleCheck" />
          </header>
          <article v-for="summary in operationSummaries" :key="`${summary.sourceId}-${summary.newRevision}`" class="operation-summary">
            <header>
              <strong>{{ summary.sourceId }}</strong>
              <span class="tabular">r{{ summary.baseRevision }} → r{{ summary.newRevision }}</span>
            </header>
            <div class="change-list compact" role="table" :aria-label="`${summary.sourceId} applied changes`">
              <div v-for="change in summary.changes" :key="`${change.resourceType}-${change.name}`" class="change-row" role="row">
                <span role="cell">{{ change.resourceType }}</span>
                <code role="cell">{{ change.name }}</code>
                <span role="cell"><StatusBadge :label="change.action" :tone="actionTone(change.action)" /></span>
              </div>
              <p v-if="summary.changes.length === 0" class="no-changes">No resource changes were required.</p>
            </div>
          </article>
        </section>
      </section>
    </div>

    <ConfirmDialog
      v-model:open="applyOpen"
      title="Apply this manifest?"
      :description="diffSummary
        ? `Apply source ${diffSummary.sourceId} against Catalog r${diffSummary.baseRevision}${prune ? ' with prune enabled' : ''}. Only the reviewed diff can be submitted.`
        : 'Apply the reviewed manifest diff.'"
      confirm-label="Apply manifest"
      tone="primary"
      :busy="applyMutation.isPending.value"
      @confirm="runApply"
    />

    <ConfirmDialog
      v-model:open="reloadOpen"
      title="Reload configured sources?"
      description="Hop will read each server-configured inventory source and run it through the Apply engine. The editor content on this page is not used."
      confirm-label="Reload sources"
      tone="primary"
      :busy="reloadMutation.isPending.value"
      @confirm="runReload"
    />
  </section>
</template>

<style scoped>
.configuration-page {
  gap: 12px;
}

.configuration-intro {
  align-items: center;
}

.intro-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  color: var(--text-muted);
  background: var(--surface-raised);
  cursor: pointer;
}

.icon-button:hover:not(:disabled) {
  color: var(--text-strong);
  border-color: var(--line-strong);
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.is-spinning {
  animation: configuration-spin 800ms linear infinite;
}

.catalog-ledger {
  display: grid;
  min-height: 82px;
  grid-template-columns: minmax(280px, 1fr) minmax(420px, 0.9fr);
  overflow: hidden;
}

.catalog-lead {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px 18px;
}

.catalog-mark,
.manifest-mark,
.source-icon,
.orphan-mark {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  background: var(--accent-soft);
}

.catalog-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.catalog-lead > div {
  display: grid;
}

.catalog-lead strong {
  color: var(--text-strong);
  font-size: 0.9375rem;
}

.catalog-lead small,
.source-row small,
.orphan-list small {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.catalog-ledger dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.catalog-ledger dl > div {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 14px 16px;
  border-left: 1px solid var(--line);
}

.catalog-ledger dt {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.catalog-ledger dd {
  margin: 2px 0 0;
  color: var(--text-strong);
  font-size: 1.125rem;
  font-weight: 650;
}

.catalog-ledger dd.warning {
  color: var(--warning);
}

.configuration-grid {
  display: grid;
  grid-template-columns: minmax(330px, 0.72fr) minmax(560px, 1.28fr);
  align-items: start;
  gap: 12px;
}

.source-column {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.source-panel,
.orphan-panel,
.manifest-panel {
  min-width: 0;
  overflow: hidden;
}

.section-heading,
.manifest-heading,
.summary-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.section-heading {
  min-height: 68px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.section-heading h2,
.section-heading p,
.manifest-heading h2,
.manifest-heading p,
.summary-heading h3,
.summary-heading p {
  margin: 0;
}

.section-heading h2,
.manifest-heading h2 {
  color: var(--text-strong);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.section-heading p,
.manifest-heading p,
.summary-heading p {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.source-list,
.orphan-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.source-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px 12px;
  padding: 13px 14px;
}

.source-row + .source-row,
.orphan-list li + li {
  border-top: 1px solid var(--line);
}

.source-identity,
.source-state,
.orphan-list li {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.source-icon,
.orphan-mark {
  width: 34px;
  height: 34px;
  border-radius: 8px;
}

.source-icon.error {
  color: var(--danger);
  background: var(--danger-soft);
}

.source-identity > span:last-child,
.source-state {
  display: grid;
  min-width: 0;
}

.source-identity strong,
.orphan-list strong {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-state {
  justify-items: end;
}

.source-error,
.source-facts {
  grid-column: 1 / -1;
  margin-left: 44px;
}

.source-error {
  padding: 10px 11px;
  border: 1px solid color-mix(in srgb, var(--danger) 28%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 7%, var(--surface-raised));
}

.source-error code {
  color: var(--danger);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
}

.source-error p {
  margin: 3px 0 0;
  color: var(--text);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.source-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-top: 9px;
  border-top: 1px solid var(--line);
}

.source-facts div + div {
  padding-left: 12px;
  border-left: 1px solid var(--line);
}

.source-facts dt {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.source-facts dd {
  margin: 2px 0 0;
  color: var(--text);
  font-size: 0.75rem;
}

.source-loading {
  display: grid;
}

.source-loading span {
  min-height: 88px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-raised);
  animation: source-pulse 1.2s ease-in-out infinite alternate;
}

.orphan-list li {
  min-height: 62px;
  padding: 10px 14px;
}

.orphan-list li > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.orphan-list time {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.manifest-panel {
  background: color-mix(in srgb, var(--surface-panel) 88%, var(--surface-canvas));
}

.manifest-heading {
  justify-content: flex-start;
  min-height: 74px;
  padding: 15px 16px;
  border-bottom: 1px solid var(--line);
}

.manifest-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.manifest-form {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-bottom: 1px solid var(--line);
}

.field-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field > span {
  color: var(--text-strong);
  font-size: 0.75rem;
  font-weight: 650;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  outline: none;
  color: var(--text-strong);
  background: var(--surface-input);
}

.field input,
.field select {
  padding: 0 11px;
}

.field textarea {
  min-height: 280px;
  padding: 12px;
  caret-color: var(--accent);
  line-height: 1.55;
  resize: vertical;
  tab-size: 2;
}

.field input:hover,
.field select:hover,
.field textarea:hover {
  border-color: var(--line-strong);
}

.field input:focus-visible,
.field select:focus-visible,
.field textarea:focus-visible {
  border-color: var(--focus);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 24%, transparent);
}

.field input[aria-invalid='true'] {
  border-color: var(--danger);
}

.field small {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.field .field-error {
  color: var(--danger);
}

.manifest-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.check-field {
  display: flex;
  min-height: 58px;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-raised);
  cursor: pointer;
}

.check-field:hover {
  border-color: var(--line-strong);
}

.check-field input {
  width: 17px;
  height: 17px;
  margin: 2px 0 0;
  accent-color: var(--accent);
}

.check-field span {
  display: grid;
  min-width: 0;
}

.check-field strong {
  color: var(--text-strong);
  font-size: 0.75rem;
}

.check-field small {
  color: var(--text-muted);
  font-size: 0.6875rem;
  line-height: 1.4;
}

.workflow-steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.workflow-steps li {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 66px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}

.step-mark {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--surface-raised);
  font-size: 0.75rem;
  font-weight: 700;
}

.workflow-steps li.complete .step-mark {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.workflow-steps li > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.workflow-steps strong {
  color: var(--text-strong);
  font-size: 0.8125rem;
}

.workflow-steps small {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.manifest-panel > :deep(.inline-notice) {
  margin: 14px 14px 0;
}

.diff-preview,
.operation-results {
  margin: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-panel);
}

.summary-heading {
  min-height: 62px;
  align-items: center;
  padding: 11px 13px;
  border-bottom: 1px solid var(--line);
}

.summary-heading h3 {
  color: var(--text-strong);
  font-size: 0.8125rem;
  font-weight: 650;
}

.summary-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 9px 13px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.summary-counts strong {
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}

.change-head,
.change-row {
  display: grid;
  grid-template-columns: minmax(100px, 0.7fr) minmax(140px, 1fr) 92px;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 6px 12px;
}

.change-head {
  min-height: 34px;
  color: var(--text-muted);
  background: var(--surface-raised);
  font-size: 0.625rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.change-row + .change-row {
  border-top: 1px solid var(--line);
}

.change-row {
  color: var(--text);
  font-size: 0.75rem;
}

.change-row code {
  overflow: hidden;
  color: var(--text-strong);
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-changes {
  margin: 0;
  padding: 18px 12px;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-align: center;
}

.operation-summary + .operation-summary {
  border-top: 1px solid var(--line);
}

.operation-summary > header {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 12px;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.operation-summary > header strong {
  color: var(--text-strong);
}

.change-list.compact .change-row:first-child {
  border-top: 1px solid var(--line);
}

@keyframes configuration-spin {
  to { transform: rotate(360deg); }
}

@keyframes source-pulse {
  from { opacity: 0.52; }
  to { opacity: 1; }
}

@media (max-width: 1180px) {
  .configuration-grid {
    grid-template-columns: 1fr;
  }

  .source-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 899px) {
  .catalog-ledger {
    grid-template-columns: 1fr;
  }

  .catalog-ledger dl {
    border-top: 1px solid var(--line);
  }

  .catalog-ledger dl > div:first-child {
    border-left: 0;
  }

  .source-column {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .configuration-intro {
    align-items: flex-start;
  }

  .configuration-intro p,
  .icon-button {
    display: none;
  }

  .intro-actions :deep(.base-button) {
    min-height: 42px;
  }

  .catalog-ledger {
    display: none;
  }

  .field-row,
  .manifest-options {
    grid-template-columns: 1fr;
  }

  .workflow-steps li {
    grid-template-columns: 30px minmax(0, 1fr);
  }

  .workflow-steps li :deep(.base-button) {
    grid-column: 1 / -1;
    width: 100%;
  }

  .change-head,
  .change-row {
    grid-template-columns: minmax(90px, 0.7fr) minmax(120px, 1fr) 82px;
  }
}

@media (max-width: 440px) {
  .section-heading {
    display: grid;
  }

  .source-error,
  .source-facts {
    margin-left: 0;
  }

  .manifest-form {
    padding: 13px;
  }

  .manifest-editor textarea {
    min-height: 240px;
  }

  .diff-preview,
  .operation-results {
    margin: 12px;
  }

  .change-head,
  .change-row {
    grid-template-columns: minmax(0, 1fr) 78px;
  }

  .change-head > :first-child,
  .change-row > :first-child {
    display: none;
  }
}
</style>
