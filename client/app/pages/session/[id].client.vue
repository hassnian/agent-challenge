<template>
  <div v-if="resolvedSession" class="h-full flex flex-col relative bg-[var(--ui-bg)] font-sans selection:bg-black/10 dark:selection:bg-white/10">
    <div class="flex-1 flex overflow-hidden">
      <!-- Main Play Area -->
      <div class="relative flex-1 overflow-y-auto">
        <div v-if="showRightRail && !isRightSidebarOpen" class="pointer-events-none sticky top-4 z-20 h-0 flex justify-end px-4">
          <div class="pointer-events-auto inline-flex">
            <UButton
              icon="i-lucide-panel-right"
              color="neutral"
              variant="ghost"
              size="sm"
              class="bg-[var(--ui-bg)]/80 backdrop-blur-md"
              aria-label="Expand artifacts sidebar"
              @click="isRightSidebarOpen = true"
            />
          </div>
        </div>

        <div :class="contentWrapperClass">
          <!-- Phase: Planning -->
          <template v-if="!resolvedSession.plan && resolvedSession.phase === 'planning'">
            <div class="mb-10">
              <p class="text-xs tracking-wide uppercase text-[var(--ui-text-dimmed)] mb-3">Initializing Objective...</p>
              <h2 class="text-[28px] leading-tight font-serif text-[var(--ui-text-highlighted)]">{{ resolvedSession.question }}</h2>
            </div>

            <div class="space-y-4">
              <div class="h-3 rounded-sm w-full shimmer" />
              <div class="h-3 rounded-sm w-11/12 shimmer" />
              <div class="h-3 rounded-sm w-4/5 shimmer" />
              <div class="h-3 rounded-sm w-full shimmer" />
              <div class="h-3 rounded-sm w-3/4 shimmer" />
            </div>
          </template>

          <!-- Phase: Plan Review -->
          <template v-else-if="resolvedSession.phase === 'plan-review'">
            <div class="mb-10">
              <p class="text-xs tracking-wide uppercase text-[var(--ui-text-dimmed)] mb-3">Proposed Research</p>
              <h1 class="text-[28px] leading-tight font-serif text-[var(--ui-text-highlighted)] max-w-3xl">{{ resolvedSession.question }}</h1>
            </div>

            <div class="space-y-0 mb-12">
              <div
                v-for="(topic, index) in resolvedSession.plan?.topics"
                :key="topic.id"
                class="py-5 first:pt-0 group"
              >
                <div class="flex items-start gap-4 pl-5 border-l-2 border-transparent group-hover:border-[var(--ui-primary)]/30 transition-colors">
                  <span class="text-lg font-serif text-[var(--ui-text-dimmed)]/40 mt-0.5 w-6 shrink-0">{{ index + 1 }}</span>
                  <div class="flex-1">
                    <h3 class="text-[15px] font-medium text-[var(--ui-text-highlighted)]">{{ topic.title }}</h3>
                    <div class="flex flex-col gap-1.5 mt-3">
                      <span
                        v-for="query in topic.queries"
                        :key="query"
                        class="text-sm text-[var(--ui-text-muted)] flex items-center gap-2"
                      ><span class="text-[var(--ui-text-dimmed)]/30">—</span> {{ query }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex gap-3">
              <UButton
                :label="isApprovingPlan ? 'Executing Plan...' : 'Approve Plan'"
                color="primary"
                size="md"
                :loading="isApprovingPlan"
                :disabled="isApprovingPlan"
                @click="handleApprove"
              />
              <UButton
                :label="isEditingPlan ? 'Cancel Edit' : 'Edit Directions'"
                variant="outline"
                color="neutral"
                size="md"
                :disabled="isApprovingPlan || isSubmittingPlanEdit"
                @click="togglePlanEdit"
              />
            </div>

            <div v-if="isEditingPlan" class="mt-5 rounded-xl border border-[var(--ui-border)]/50 bg-[var(--ui-bg-elevated)]/50 p-4 space-y-3">
              <UTextarea
                v-model="planEditInstructions"
                autoresize
                :rows="4"
                :maxrows="8"
                placeholder="Example: narrow this to B2B AI tools, remove hiring-market research, and add pricing benchmarks."
                class="w-full"
              />
              <UButton
                :label="isSubmittingPlanEdit ? 'Updating Plan...' : 'Update Plan'"
                color="primary"
                :loading="isSubmittingPlanEdit"
                :disabled="!planEditInstructions.trim() || isSubmittingPlanEdit || isApprovingPlan"
                @click="handlePlanEdit"
              />
            </div>
          </template>

          <!-- Phase: Focus (Researching, Critiquing, Synthesizing) -->
          <template v-else-if="isFocusPhase">
            <div class="space-y-10">
              <!-- Hero: phase + question + active topic merged -->
              <section class="mt-6 space-y-5">
                <div class="flex items-center gap-2.5">
                  <span class="text-xs tracking-wide uppercase shimmer-text">{{ phaseLabel }}</span>
                  <span class="text-[11px] text-[var(--ui-text-dimmed)]/40">·</span>
                  <span class="text-xs tracking-wide uppercase text-[var(--ui-text-dimmed)]">{{ activeBadgeCopy }}</span>
                </div>
                <h2 class="text-[28px] leading-tight font-serif text-[var(--ui-text-highlighted)] max-w-3xl">{{ resolvedSession.question }}</h2>

                <div class="rounded-xl border border-[var(--ui-border)]/40 bg-[var(--ui-bg-elevated)]/50 p-5 space-y-3">
                  <p class="text-[11px] tracking-wide uppercase text-[var(--ui-text-dimmed)]">{{ activeStateEyebrow }}</p>
                  <h3 class="text-lg font-serif text-[var(--ui-text-highlighted)]">{{ activeStateTitle }}</h3>
                  <p class="max-w-3xl text-sm leading-relaxed text-[var(--ui-text-muted)]">{{ activeStateSummary }}</p>

                  <div v-if="activeTopic && resolvedSession.phase === 'researching'" class="flex flex-wrap gap-2 pt-1">
                    <span
                      v-for="query in activeTopic.queries"
                      :key="query"
                      class="text-xs text-[var(--ui-text-muted)] bg-[var(--ui-bg)]/60 px-3 py-1.5 rounded-full"
                    >{{ query }}</span>
                  </div>
                </div>
              </section>

              <!-- Metrics — compact, no helpers -->
              <section class="grid gap-6 sm:grid-cols-3 py-6 border-t border-[var(--ui-border)]/30">
                <div
                  v-for="metric in activeMetrics"
                  :key="metric.label"
                  class="flex flex-col gap-1"
                >
                  <p class="text-[11px] uppercase tracking-widest text-[var(--ui-text-dimmed)]">{{ metric.label }}</p>
                  <div v-if="metric.value === 0 || metric.value === '0'" class="mt-1 h-9 w-16 rounded shimmer" />
                  <p v-else class="mt-1 text-3xl font-serif font-light text-[var(--ui-text-highlighted)]">{{ metric.value }}</p>
                </div>
              </section>

              <!-- Plan accordion -->
              <details v-if="resolvedSession.plan" class="group border-t border-[var(--ui-border)]/30">
                <summary class="cursor-pointer list-none py-5 flex items-center justify-between gap-3 focus:outline-none">
                  <p class="text-[15px] font-medium text-[var(--ui-text-highlighted)]">View Original Plan</p>
                  <UIcon
                    name="i-lucide-chevron-down"
                    class="text-[var(--ui-text-dimmed)] transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div class="pb-6 grid gap-2 pt-2">
                  <div
                    v-for="(topic, index) in resolvedSession.plan.topics"
                    :key="topic.id"
                    class="py-2"
                  >
                    <div class="flex items-start gap-4">
                      <span class="text-sm text-[var(--ui-text-dimmed)] w-6">{{ index + 1 }}.</span>
                      <div class="flex-1">
                        <div class="flex flex-col gap-1">
                          <h4 class="text-sm font-medium text-[var(--ui-text-highlighted)]">{{ topic.title }}</h4>
                          <span class="text-xs text-[var(--ui-text-dimmed)]">
                            <span>{{ topic.status === 'done' ? 'Completed' : topic.status === 'active' ? 'Active' : 'Pending' }}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <!-- Activity timeline — tightened -->
              <section class="pt-2 border-t border-[var(--ui-border)]/30">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <h3 class="text-[15px] font-medium text-[var(--ui-text-highlighted)]">{{ activityTimelineTitle }}</h3>
                  <UButton
                    v-if="canToggleActivityScope"
                    :label="showFullActivity ? 'Focus view' : 'Full timeline'"
                    variant="link"
                    color="neutral"
                    size="xs"
                    @click="showFullActivity = !showFullActivity"
                    class="px-0 font-medium h-auto py-0"
                  />
                </div>

                <div class="space-y-4">
                  <div
                    v-for="entry in displayedActivityEntries"
                    :key="entry.id"
                    class="flex gap-4"
                  >
                    <RoleBadge :role="entry.role" size="xs" class="shrink-0 mt-0.5" />
                    <div class="flex-1">
                      <div class="flex items-start justify-between gap-4">
                        <span class="text-[14px] text-[var(--ui-text)] leading-relaxed">{{ entry.message }}</span>
                        <span class="text-[11px] text-[var(--ui-text-dimmed)] shrink-0 mt-0.5">{{ formatLogTime(entry.timestamp) }}</span>
                      </div>
                    </div>
                  </div>

                  <div v-if="displayedActivityEntries.length === 0" class="space-y-3 py-4">
                    <div class="h-3 rounded-sm w-3/4 shimmer" />
                    <div class="h-3 rounded-sm w-1/2 shimmer" />
                    <div class="h-3 rounded-sm w-2/3 shimmer" />
                  </div>
                </div>
              </section>
            </div>
          </template>

          <template v-else-if="resolvedSession.phase === 'complete'">
            <CompleteMemo :session="resolvedSession" class="mt-6" />
          </template>
        </div>
      </div>

      <!-- Right Sidebar -->
      <USidebar
        v-if="showRightRail"
        v-model:open="isRightSidebarOpen"
        side="right"
        collapsible="offcanvas"
        :ui="rightSidebarUi"
        :style="{ '--sidebar-width': '22rem' }"
      >
        <template #header>
          <div class="px-5 py-5 border-b border-[var(--ui-border)]/50">
            <p class="text-xs font-medium text-[var(--ui-text-dimmed)]">Research Artifacts</p>
          </div>
        </template>

        <template #default>
          <UTabs
            :items="rightPanelTabs"
            :default-value="rightPanelTabs[0]?.value ?? 'evidence'"
            class="flex flex-col h-full min-h-0 px-2 pt-2"
            :ui="{ trigger: 'text-[13px] font-medium', content: 'flex-1 overflow-y-auto min-h-0' }"
          >
            <template #evidence>
              <div class="p-3 space-y-0">
                <p v-if="!resolvedSession?.evidence?.length" class="text-sm text-[var(--ui-text-dimmed)] text-center py-8">No evidence collected</p>
                <EvidenceCardComponent v-for="ev in resolvedSession?.evidence" :key="ev.id" :evidence="ev" />
              </div>
            </template>
            <template #critique>
              <div class="p-3 space-y-0">
                <p v-if="!resolvedSession?.critiques?.length" class="text-sm text-[var(--ui-text-dimmed)] text-center py-8">No critiques</p>
                <CritiqueCard v-for="critique in resolvedSession?.critiques" :key="critique.id" :critique="critique" />
              </div>
            </template>
            <template #contested>
              <div class="p-3 space-y-0">
                <p v-if="!resolvedSession?.contested?.length" class="text-sm text-[var(--ui-text-dimmed)] text-center py-8">No contested points</p>
                <ContestedCard v-for="cp in resolvedSession?.contested" :key="cp.id" :contested="cp" />
              </div>
            </template>
          </UTabs>
        </template>
      </USidebar>
    </div>
  </div>

  <div v-else class="h-full flex flex-col items-center justify-center bg-[var(--ui-bg)]">
    <h2 class="text-xl font-serif text-[var(--ui-text-highlighted)] mb-2">Session Not Found</h2>
    <p class="text-sm text-[var(--ui-text-dimmed)] mb-6">This research session doesn't exist or was deleted.</p>
    <UButton label="Back to Home" to="/" variant="ghost" color="neutral" />
  </div>
</template>

<script setup lang="ts">
import type { ResearchSession, ResearchTopic } from '~/composables/useResearch'

type ProgressRole = ResearchSession['progressLog'][number]['role']
type MetricCard = {
  label: string
  value: string | number
  helper: string
}

const route = useRoute()
const {
  sessions,
  activeSessionId,
  approvePlan,
  updatePlan,
  loadSession,
  refreshSessions,
  startSessionPolling,
  isPlaceholderSession,
  isOptimisticSession,
} = useResearch()

const sessionId = computed(() => route.params.id as string)
const session = computed(() => sessions.value.find(s => s.id === sessionId.value) || null)
const loadingSession = ref(false)
const sessionLookupComplete = ref(false)
const lastKnownQuestion = ref('')
const isApprovingPlan = ref(false)
const isEditingPlan = ref(false)
const isSubmittingPlanEdit = ref(false)
const planEditInstructions = ref('')
const showFullActivity = ref(false)
const isRightSidebarOpen = ref(true)

const getErrorStatusCode = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }

  return null
}

const sleep = (ms: number) => new Promise(resolve => globalThis.setTimeout(resolve, ms))

const hydrateSession = async (id: string) => {
  const optimistic = isOptimisticSession(id)
  let latest = session.value

  for (let attempt = 0; attempt < 3; attempt += 1) {
    latest = await loadSession(id)

    if (!latest || optimistic || !isPlaceholderSession(latest)) {
      return latest
    }

    await sleep(350)
  }

  return latest
}

const syncSessionState = async (id: string) => {
  if (!id) {
    sessionLookupComplete.value = true
    return null
  }

  sessionLookupComplete.value = false
  activeSessionId.value = id
  lastKnownQuestion.value = session.value?.question ?? ''

  if (!sessions.value.length) {
    await refreshSessions({ silent: true })
  }

  const existing = sessions.value.find(item => item.id === id) || null
  const shouldHydrate = !existing || (!isOptimisticSession(id) && isPlaceholderSession(existing))

  loadingSession.value = shouldHydrate

  if (!shouldHydrate) {
    if (existing) {
      lastKnownQuestion.value = existing.question
      startSessionPolling(id)
    }
    return existing
  }

  try {
    const loaded = await hydrateSession(id)

    if (loaded) {
      lastKnownQuestion.value = loaded.question
      startSessionPolling(id)
    }

    return loaded
  } catch (error) {
    if (getErrorStatusCode(error) !== 404) {
      throw error
    }

    return null
  } finally {
    loadingSession.value = false
    sessionLookupComplete.value = true
  }
}

if (import.meta.client) {
  watch(sessionId, (id) => {
    showFullActivity.value = false
    void syncSessionState(id)
  }, { immediate: true })
}

watch(session, (value) => {
  if (value?.question) {
    lastKnownQuestion.value = value.question
  }
})

const showSessionLoading = computed(() =>
  (!sessionLookupComplete.value || loadingSession.value) &&
  (!session.value || !isOptimisticSession(sessionId.value))
)

const displayQuestion = computed(() => session.value?.question || lastKnownQuestion.value || 'Research session')

const loadingMessage = computed(() => {
  if (isOptimisticSession(sessionId.value)) {
    return 'Sending your first message to the research room.'
  }

  return 'Loading the latest research state.'
})

const resolvedSession = computed<ResearchSession | null>(() => {
  if (session.value) return session.value
  if (showSessionLoading.value) {
    return {
      id: sessionId.value,
      phase: 'planning',
      question: displayQuestion.value,
      evidence: [],
      critiques: [],
      contested: [],
      progressLog: [{ id: 'loading-1', role: 'planner', timestamp: '', message: loadingMessage.value }],
      plan: null,
      bootstrap: { status: 'ready', errorMessage: null, canRetry: false },
      openQuestions: [],
      summary: '',
      finalAnswer: '',
      confidenceLevel: 0,
      createdAt: '',
      completedAt: null,
    } as ResearchSession
  }
  return null
})

watch(() => resolvedSession.value?.phase, () => {
  showFullActivity.value = false

  if (resolvedSession.value?.phase !== 'plan-review') {
    resetPlanEdit()
  }
})

const showRightRail = computed(() => resolvedSession.value?.phase === 'complete')

watch(showRightRail, (visible) => {
  if (visible) {
    isRightSidebarOpen.value = true
  }
}, { immediate: true })

const isFocusPhase = computed(() => {
  const phase = resolvedSession.value?.phase
  return phase === 'researching' || phase === 'critiquing' || phase === 'synthesizing'
})

const contentWrapperClass = computed(() => {
  if (resolvedSession.value?.phase === 'complete') {
    return 'max-w-4xl mx-auto w-full px-6 sm:px-8 py-8'
  }

  if (isFocusPhase.value) {
    return 'max-w-5xl mx-auto w-full px-6 sm:px-8 py-8'
  }

  return 'max-w-2xl mx-auto w-full px-8 py-8'
})

const rightPanelTabs = computed(() => [
  { label: `Evidence (${resolvedSession.value?.evidence.length || 0})`, value: 'evidence', slot: 'evidence' as const },
  { label: `Critique (${resolvedSession.value?.critiques.length || 0})`, value: 'critique', slot: 'critique' as const },
  { label: `Contested (${resolvedSession.value?.contested.length || 0})`, value: 'contested', slot: 'contested' as const },
])

const rightSidebarUi = {
  container: 'h-full',
  inner: 'h-full bg-[var(--ui-bg-elevated)] divide-transparent',
  header: 'block min-h-0 px-0 py-0',
  body: 'min-h-0 flex-1 gap-0 overflow-hidden p-0',
}

const phaseLabel = computed(() => {
  const labels: Record<string, string> = {
    researching: 'Researching',
    critiquing: 'Critiquing',
    synthesizing: 'Synthesizing',
  }
  return labels[resolvedSession.value?.phase || ''] || 'In Progress'
})

const latestInvestigatingTopicTitle = computed(() => {
  const entries = resolvedSession.value?.progressLog ?? []

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]

    if (!entry?.message.startsWith('Searcher is investigating: ')) {
      continue
    }

    return entry.message.replace('Searcher is investigating: ', '').trim()
  }

  return null
})

const activeTopic = computed<ResearchTopic | null>(() => {
  const topics = resolvedSession.value?.plan?.topics ?? []
  const active = topics.find(topic => topic.status === 'active')

  if (active) {
    return active
  }

  const latestInvestigating = latestInvestigatingTopicTitle.value
  if (latestInvestigating) {
    const matchingTopic = topics.find(topic => topic.title === latestInvestigating)
    if (matchingTopic) {
      return matchingTopic
    }
  }

  return topics.find(topic => topic.status === 'pending') || null
})

const totalTopics = computed(() => resolvedSession.value?.plan?.topics.length ?? 0)

const completedTopicCount = computed(() => {
  return resolvedSession.value?.plan?.topics.filter(topic => topic.status === 'done').length ?? 0
})

const researchProgressPercent = computed(() => {
  if (totalTopics.value === 0) return 0
  return Math.round((completedTopicCount.value / totalTopics.value) * 100)
})

const displayEvidenceCount = computed(() => {
  const directCount = resolvedSession.value?.evidence.length ?? 0

  if (directCount > 0) {
    return directCount
  }

  const entries = resolvedSession.value?.progressLog ?? []
  let derivedCount = 0

  for (const entry of entries) {
    const match = entry.message.match(/collected (\d+) evidence cards/i)
    if (!match) {
      continue
    }

    derivedCount += Number.parseInt(match[1] || '0', 10)
  }

  return derivedCount
})

const currentPhaseRole = computed<ProgressRole | null>(() => {
  const map: Record<string, ProgressRole> = {
    researching: 'searcher',
    critiquing: 'skeptic',
    synthesizing: 'synthesizer',
  }
  return map[resolvedSession.value?.phase || ''] ?? null
})

const allActivityEntries = computed(() => [...(resolvedSession.value?.progressLog ?? [])].reverse())

const currentPhaseEntries = computed(() => {
  const role = currentPhaseRole.value

  if (!role) {
    return allActivityEntries.value
  }

  const filtered = allActivityEntries.value.filter(entry => entry.role === role)
  return filtered.length > 0 ? filtered : allActivityEntries.value
})

const latestPhaseEntry = computed(() => currentPhaseEntries.value[0] ?? allActivityEntries.value[0] ?? null)

const activeStateEyebrow = computed(() => {
  const labels: Record<string, string> = {
    researching: 'Current State',
    critiquing: 'Skeptic Review',
    synthesizing: 'Final Synthesis',
  }
  return labels[resolvedSession.value?.phase || ''] || 'Current State'
})

const activeStateTitle = computed(() => {
  if (resolvedSession.value?.phase === 'researching') {
    return activeTopic.value?.title ?? 'Researching approved topics'
  }

  if (resolvedSession.value?.phase === 'critiquing') {
    return 'Pressure-testing the strongest claims'
  }

  return 'Composing the final decision memo'
})

const activeStateSummary = computed(() => {
  if (latestPhaseEntry.value?.message) {
    return latestPhaseEntry.value.message
  }

  const fallbacks: Record<string, string> = {
    researching: 'The searcher is collecting live evidence for the approved topics.',
    critiquing: 'The skeptic is checking for weak claims, missing evidence, and unresolved gaps.',
    synthesizing: 'The synthesizer is turning the strongest supported findings into a final recommendation.',
  }
  return fallbacks[resolvedSession.value?.phase || ''] || 'The research system is processing the current phase.'
})

const activeBadgeCopy = computed(() => {
  if (resolvedSession.value?.phase === 'researching') {
    return `${researchProgressPercent.value}% complete`
  }

  if (resolvedSession.value?.phase === 'critiquing') {
    return `${resolvedSession.value?.critiques.length ?? 0} issues found`
  }

  return `${resolvedSession.value?.openQuestions.length ?? 0} open questions`
})

const activeMetrics = computed<MetricCard[]>(() => {
  if (resolvedSession.value?.phase === 'researching') {
    return [
      {
        label: 'Topics Done',
        value: `${completedTopicCount.value}/${totalTopics.value}`,
        helper: 'Approved topics completed so far.',
      },
      {
        label: 'Evidence Count',
        value: displayEvidenceCount.value,
        helper: 'Live source count from synced cards and recent logs.',
      },
      {
        label: 'Current Queries',
        value: activeTopic.value?.queries.length ?? 0,
        helper: 'Search prompts guiding the current topic.',
      },
    ]
  }

  if (resolvedSession.value?.phase === 'critiquing') {
    return [
      {
        label: 'Evidence Reviewed',
        value: displayEvidenceCount.value,
        helper: 'Sources the skeptic can challenge or validate.',
      },
      {
        label: 'Issues Found',
        value: resolvedSession.value?.critiques.length ?? 0,
        helper: 'Captured objections and weak-support notes.',
      },
      {
        label: 'Topics Covered',
        value: `${completedTopicCount.value}/${totalTopics.value}`,
        helper: 'Research topics already completed before critique.',
      },
    ]
  }

  return [
    {
      label: 'Evidence Reviewed',
      value: displayEvidenceCount.value,
      helper: 'Evidence available to support the final answer.',
    },
    {
      label: 'Objections Considered',
      value: resolvedSession.value?.critiques.length ?? 0,
      helper: 'Skeptic notes folded into the final recommendation.',
    },
    {
      label: 'Open Questions',
      value: resolvedSession.value?.openQuestions.length ?? 0,
      helper: 'Known follow-ups left after this pass.',
    },
  ]
})

const activityTimelineTitle = computed(() => {
  const titles: Record<string, string> = {
    researching: 'Research Activity',
    critiquing: 'Skeptic Timeline',
    synthesizing: 'Synthesis Timeline',
  }
  return titles[resolvedSession.value?.phase || ''] || 'Activity Timeline'
})

const displayedActivityEntries = computed(() => {
  const source = showFullActivity.value ? allActivityEntries.value : currentPhaseEntries.value
  return source.slice(0, 10)
})

const canToggleActivityScope = computed(() => {
  return allActivityEntries.value.length > currentPhaseEntries.value.length
})

const handleApprove = async () => {
  if (!sessionId.value || isApprovingPlan.value) {
    return
  }

  isApprovingPlan.value = true

  try {
    await approvePlan(sessionId.value)
  } finally {
    isApprovingPlan.value = false
  }
}

const resetPlanEdit = () => {
  isEditingPlan.value = false
  isSubmittingPlanEdit.value = false
  planEditInstructions.value = ''
}

const togglePlanEdit = () => {
  if (isEditingPlan.value) {
    resetPlanEdit()
    return
  }

  isEditingPlan.value = true
}

const handlePlanEdit = async () => {
  const instructions = planEditInstructions.value.trim()

  if (!sessionId.value || !instructions || isSubmittingPlanEdit.value) {
    return
  }

  isSubmittingPlanEdit.value = true

  try {
    await updatePlan(sessionId.value, instructions)
    resetPlanEdit()
  } finally {
    isSubmittingPlanEdit.value = false
  }
}

const logTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const formatLogTime = (date: string) => logTimeFormatter.format(new Date(date))
</script>
