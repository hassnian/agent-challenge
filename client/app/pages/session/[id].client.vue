<template>
  <div v-if="resolvedSession" class="h-full flex flex-col relative bg-[var(--ui-bg)] font-sans selection:bg-black/10 dark:selection:bg-white/10">
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Sidebar -->
      <USidebar
        v-if="showSessionRail"
        v-model:open="isLeftSidebarOpen"
        collapsible="offcanvas"
        close
        side="left"
        :ui="leftSidebarUi"
        :style="{ '--sidebar-width': '18rem' }"
      >
        <template #header>
          <div class="px-5 py-5 border-b border-[var(--ui-border)]">
            <p class="text-xs font-medium text-[var(--ui-text-muted)] mb-4">Research Progress</p>
            <PhaseStepper :phase="resolvedSession.phase" />
          </div>
        </template>

        <template #default>
          <div class="flex min-h-0 flex-1 flex-col">
            <div v-if="resolvedSession.plan && resolvedSession.phase !== 'plan-review'" class="p-5 border-b border-[var(--ui-border)] flex-shrink-0">
              <p class="text-xs font-medium text-[var(--ui-text-muted)] mb-3">Topic Outline</p>
              <div class="space-y-1">
                <div
                  v-for="topic in resolvedSession.plan.topics"
                  :key="topic.id"
                  class="flex items-start gap-3 py-1.5"
                >
                  <span class="mt-0.5 shrink-0 text-xs">
                    <span v-if="topic.status === 'done'" class="text-[var(--ui-text-muted)]">✓</span>
                    <span v-else-if="topic.status === 'active'" class="text-[var(--ui-text)]">→</span>
                    <span v-else class="text-[var(--ui-text-dimmed)]">○</span>
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm" :class="topic.status === 'active' ? 'text-[var(--ui-text-highlighted)]' : 'text-[var(--ui-text)]'">{{ topic.title }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex-1 p-5 min-h-0 overflow-y-auto">
              <p class="text-xs font-medium text-[var(--ui-text-muted)] mb-4">Activity Stream</p>
              <div class="space-y-5 pb-4">
                <div v-for="entry in allActivityEntries.slice(0, 30)" :key="entry.id" class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-1.5">
                    <RoleBadge :role="entry.role" size="xs" />
                    <ClientOnly v-if="entry.timestamp">
                      <span class="text-xs text-[var(--ui-text-muted)]">{{ formatLogTime(entry.timestamp) }}</span>
                    </ClientOnly>
                  </div>
                  <p class="text-[13px] text-[var(--ui-text)] leading-relaxed">{{ entry.message }}</p>
                </div>
                <div v-if="!resolvedSession.progressLog.length" class="text-center py-6">
                  <p class="text-sm text-[var(--ui-text-muted)]">Waiting for system logs...</p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </USidebar>

      <!-- Main Play Area -->
      <div class="relative flex-1 overflow-y-auto">
        <div v-if="showSessionRail" class="pointer-events-none sticky top-4 left-0 z-20 h-0 px-4">
          <div class="pointer-events-auto inline-flex">
            <UButton
              :icon="isLeftSidebarOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left'"
              color="neutral"
              variant="ghost"
              size="sm"
              class="bg-[var(--ui-bg)]/80 backdrop-blur-md"
              :aria-label="isLeftSidebarOpen ? 'Collapse progress sidebar' : 'Expand progress sidebar'"
              @click="isLeftSidebarOpen = !isLeftSidebarOpen"
            />
          </div>
        </div>

        <div v-if="showRightRail" class="pointer-events-none sticky top-4 z-20 h-0 flex justify-end px-4">
          <div class="pointer-events-auto inline-flex">
            <UButton
              :icon="isRightSidebarOpen ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right'"
              color="neutral"
              variant="ghost"
              size="sm"
              class="bg-[var(--ui-bg)]/80 backdrop-blur-md"
              :aria-label="isRightSidebarOpen ? 'Collapse artifacts sidebar' : 'Expand artifacts sidebar'"
              @click="isRightSidebarOpen = !isRightSidebarOpen"
            />
          </div>
        </div>

        <div :class="contentWrapperClass">
          <!-- Phase: Planning -->
          <template v-if="!resolvedSession.plan && resolvedSession.phase === 'planning'">
            <div class="mb-10 mt-6">
              <p class="text-sm font-medium text-[var(--ui-text-muted)] mb-3">Initializing Objective...</p>
              <h2 class="text-[28px] leading-tight font-serif text-[var(--ui-text-highlighted)]">{{ resolvedSession.question }}</h2>
            </div>
            
            <div class="space-y-4">
              <div class="h-3 bg-[var(--ui-border)] rounded-sm w-full opacity-30" />
              <div class="h-3 bg-[var(--ui-border)] rounded-sm w-11/12 opacity-30" />
              <div class="h-3 bg-[var(--ui-border)] rounded-sm w-4/5 opacity-30" />
              <div class="h-3 bg-[var(--ui-border)] rounded-sm w-full opacity-30" />
              <div class="h-3 bg-[var(--ui-border)] rounded-sm w-3/4 opacity-30" />
            </div>
          </template>

          <!-- Phase: Plan Review -->
          <template v-else-if="resolvedSession.phase === 'plan-review'">
            <div class="mb-10 mt-6">
              <p class="text-sm font-medium text-[var(--ui-text-muted)] mb-3">Proposed Research Layout</p>
              <h1 class="text-[28px] leading-tight font-serif text-[var(--ui-text-highlighted)] max-w-3xl">{{ resolvedSession.question }}</h1>
            </div>
            
            <div class="space-y-6 mb-10">
              <div
                v-for="(topic, index) in resolvedSession.plan?.topics"
                :key="topic.id"
                class="py-4 border-b border-[var(--ui-border)] last:border-0"
              >
                <div class="flex items-start gap-4">
                  <span class="text-sm text-[var(--ui-text-muted)] mt-0.5 w-6">{{ index + 1 }}.</span>
                  <div class="flex-1">
                    <h3 class="text-[15px] font-medium text-[var(--ui-text-highlighted)]">{{ topic.title }}</h3>
                    <div class="flex flex-col gap-1.5 mt-3">
                      <span
                        v-for="query in topic.queries"
                        :key="query"
                        class="text-sm text-[var(--ui-text-muted)] flex items-center before:content-[''] before:w-1 before:h-1 before:rounded-full before:bg-[var(--ui-border)] before:mr-3"
                      >{{ query }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="flex gap-3">
              <UButton
                :label="isApprovingPlan ? 'Executing Plan...' : 'Approve Plan'"
                color="black"
                size="md"
                :loading="isApprovingPlan"
                :disabled="isApprovingPlan"
                @click="handleApprove"
              />
              <UButton label="Edit Directions" variant="ghost" color="neutral" size="md" :disabled="isApprovingPlan" />
            </div>
          </template>

          <!-- Phase: Focus (Researching, Critiquing, Synthesizing) -->
          <template v-else-if="isFocusPhase">
            <div class="space-y-12">
              <section class="space-y-4 mt-6">
                <p class="text-sm font-medium text-[var(--ui-text-muted)]">{{ phaseLabel }}</p>
                <h2 class="text-[28px] leading-tight font-serif text-[var(--ui-text-highlighted)] max-w-3xl">{{ resolvedSession.question }}</h2>
                <p class="text-[15px] text-[var(--ui-text-muted)] leading-relaxed max-w-3xl">{{ activeHeaderCopy }}</p>
              </section>

              <section class="py-6 border-y border-[var(--ui-border)]">
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-3 mb-1">
                    <span class="text-xs font-medium text-[var(--ui-text-muted)]">{{ activeStateEyebrow }}</span>
                    <span class="text-xs text-[var(--ui-text-dimmed)]">•</span>
                    <span class="text-xs font-medium text-[var(--ui-text-muted)]">{{ activeBadgeCopy }}</span>
                  </div>
                  <h3 class="text-xl font-serif text-[var(--ui-text-highlighted)]">{{ activeStateTitle }}</h3>
                  <p class="max-w-3xl text-sm leading-relaxed text-[var(--ui-text)] mt-1">{{ activeStateSummary }}</p>
                </div>

                <div v-if="activeTopic && resolvedSession.phase === 'researching'" class="mt-6 flex flex-wrap gap-2">
                  <span
                    v-for="query in activeTopic.queries"
                    :key="query"
                    class="text-xs text-[var(--ui-text-muted)] bg-[var(--ui-bg)] border border-[var(--ui-border)] px-3 py-1.5 rounded-md shadow-sm"
                  >{{ query }}</span>
                </div>
              </section>

              <section class="grid gap-8 sm:grid-cols-3">
                <div
                  v-for="metric in activeMetrics"
                  :key="metric.label"
                  class="flex flex-col"
                >
                  <p class="text-xs font-medium text-[var(--ui-text-muted)]">{{ metric.label }}</p>
                  <p class="mt-1 text-2xl font-serif text-[var(--ui-text-highlighted)]">{{ metric.value }}</p>
                  <p class="mt-2 text-[13px] leading-relaxed text-[var(--ui-text-muted)] max-w-[200px]">{{ metric.helper }}</p>
                </div>
              </section>

              <details v-if="resolvedSession.plan" class="group border-y border-[var(--ui-border)]">
                <summary class="cursor-pointer list-none py-5 flex items-center justify-between gap-3 focus:outline-none">
                  <p class="text-[15px] font-medium text-[var(--ui-text-highlighted)]">View Original Plan</p>
                  <UIcon
                    name="i-lucide-chevron-down"
                    class="text-[var(--ui-text-muted)] transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div class="pb-6 grid gap-2 pt-2">
                  <div
                    v-for="(topic, index) in resolvedSession.plan.topics"
                    :key="topic.id"
                    class="py-2"
                  >
                    <div class="flex items-start gap-4">
                      <span class="text-sm text-[var(--ui-text-muted)] w-6">{{ index + 1 }}.</span>
                      <div class="flex-1">
                        <div class="flex flex-col gap-1">
                          <h4 class="text-sm font-medium text-[var(--ui-text-highlighted)]">{{ topic.title }}</h4>
                          <span class="text-xs text-[var(--ui-text-muted)] flex items-center gap-2">
                            <span :class="topic.status === 'done' ? 'text-[var(--ui-text)]' : 'text-[var(--ui-text-dimmed)]'">{{ topic.status === 'done' ? 'Completed' : topic.status === 'active' ? 'Active' : 'Pending' }}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <section class="pt-2">
                <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 class="text-[15px] font-medium text-[var(--ui-text-highlighted)]">{{ activityTimelineTitle }}</h3>
                    <p class="mt-1 text-[13px] text-[var(--ui-text-muted)]">{{ activityTimelineCopy }}</p>
                  </div>
                  <UButton
                    v-if="canToggleActivityScope"
                    :label="showFullActivity ? 'Show focus view' : 'Show full timeline'"
                    variant="link"
                    color="neutral"
                    size="xs"
                    @click="showFullActivity = !showFullActivity"
                    class="px-0 font-medium h-auto py-0"
                  />
                </div>

                <div class="space-y-6">
                  <div
                    v-for="entry in displayedActivityEntries"
                    :key="entry.id"
                    class="flex gap-4"
                  >
                    <RoleBadge :role="entry.role" size="xs" class="shrink-0 mt-0.5" />
                    <div class="flex-1 space-y-1">
                      <div class="flex items-start justify-between gap-4">
                        <span class="text-[14px] text-[var(--ui-text)] leading-relaxed">{{ entry.message }}</span>
                        <span class="text-xs text-[var(--ui-text-muted)] shrink-0 mt-0.5">{{ formatLogTime(entry.timestamp) }}</span>
                      </div>
                    </div>
                  </div>

                  <div v-if="displayedActivityEntries.length === 0" class="py-8 text-[var(--ui-text-muted)] text-[14px]">
                    Waiting for agent milestones...
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
        close
        :ui="rightSidebarUi"
        :style="{ '--sidebar-width': '22rem' }"
      >
        <template #header>
          <div class="px-5 py-5 border-b border-[var(--ui-border)]">
            <p class="text-xs font-medium text-[var(--ui-text-muted)]">Research Artifacts</p>
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
              <div class="p-3 space-y-4">
                <p v-if="!resolvedSession?.evidence?.length" class="text-sm text-[var(--ui-text-muted)] text-center py-8">No evidence collected</p>
                <EvidenceCardComponent v-for="ev in resolvedSession?.evidence" :key="ev.id" :evidence="ev" />
              </div>
            </template>
            <template #critique>
              <div class="p-3 space-y-4">
                <p v-if="!resolvedSession?.critiques?.length" class="text-sm text-[var(--ui-text-muted)] text-center py-8">No critiques</p>
                <CritiqueCard v-for="critique in resolvedSession?.critiques" :key="critique.id" :critique="critique" />
              </div>
            </template>
            <template #contested>
              <div class="p-3 space-y-4">
                <p v-if="!resolvedSession?.contested?.length" class="text-sm text-[var(--ui-text-muted)] text-center py-8">No contested points</p>
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
    <p class="text-sm text-[var(--ui-text-muted)] mb-6">This research session doesn't exist or was deleted.</p>
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
const { sessions, activeSessionId, approvePlan, loadSession, refreshSessions, startSessionPolling, isPlaceholderSession, isOptimisticSession } = useResearch()

const sessionId = computed(() => route.params.id as string)
const session = computed(() => sessions.value.find(s => s.id === sessionId.value) || null)
const loadingSession = ref(false)
const sessionLookupComplete = ref(false)
const lastKnownQuestion = ref('')
const isApprovingPlan = ref(false)
const showFullActivity = ref(false)
const isLeftSidebarOpen = ref(true)
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
})

const showSessionRail = computed(() => {
  const phase = resolvedSession.value?.phase
  return phase === 'planning' || phase === 'plan-review'
})

const showRightRail = computed(() => resolvedSession.value?.phase === 'complete')

watch(showSessionRail, (visible) => {
  if (visible) {
    isLeftSidebarOpen.value = true
  }
}, { immediate: true })

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

const leftSidebarUi = {
  container: 'h-full',
  inner: 'h-full bg-[var(--ui-bg-elevated)] divide-transparent',
  header: 'block min-h-0 px-0 py-0',
  body: 'min-h-0 flex-1 gap-0 p-0',
}

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

const phaseTextColor = computed(() => {
  const colors: Record<string, string> = {
    researching: 'text-blue-600',
    critiquing: 'text-orange-600',
    synthesizing: 'text-violet-600',
  }
  return colors[resolvedSession.value?.phase || ''] || 'text-[var(--ui-text-muted)]'
})

const activeStateCardClass = computed(() => {
  const classes: Record<string, string> = {
    researching: 'border-blue-500/30 bg-blue-500/5',
    critiquing: 'border-orange-500/30 bg-orange-500/5',
    synthesizing: 'border-violet-500/30 bg-violet-500/5',
  }
  return classes[resolvedSession.value?.phase || ''] || 'border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]'
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

const activeHeaderCopy = computed(() => {
  if (resolvedSession.value?.phase === 'researching') {
    return `${completedTopicCount.value} of ${totalTopics.value} topics completed with ${displayEvidenceCount.value} sources captured so far.`
  }

  if (resolvedSession.value?.phase === 'critiquing') {
    return `${displayEvidenceCount.value} sources are being pressure-tested before the final synthesis is assembled.`
  }

  return `The final recommendation is being assembled from ${displayEvidenceCount.value} sources and ${resolvedSession.value?.critiques.length ?? 0} critique notes.`
})

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

const activityTimelineCopy = computed(() => {
  if (showFullActivity.value) {
    return 'Showing the full research activity feed across every phase.'
  }

  const copies: Record<string, string> = {
    researching: 'Showing curated searcher updates for the current research pass.',
    critiquing: 'Showing curated skeptic updates for the current critique pass.',
    synthesizing: 'Showing curated synthesizer updates for the final write-up.',
  }
  return copies[resolvedSession.value?.phase || ''] || 'Showing the latest agent milestones.'
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

const logTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const formatLogTime = (date: string) => logTimeFormatter.format(new Date(date))
</script>
