<template>
  <div v-if="resolvedSession" class="h-full flex flex-col relative">
      <!-- 3-Panel -->
      <div class="flex-1 flex overflow-hidden">
        <!-- LEFT -->
        <aside class="w-68 border-r border-[var(--ui-border)] flex flex-col shrink-0 overflow-y-auto bg-[var(--ui-bg-elevated)]">
          <div class="px-4 py-4 border-b border-[var(--ui-border)]">
            <p class="text-[11px] font-semibold text-[var(--ui-text-muted)] uppercase tracking-widest mb-3">Progress</p>
            <PhaseStepper :phase="resolvedSession.phase" />
          </div>

          <div v-if="resolvedSession.plan && resolvedSession.phase !== 'plan-review'" class="p-4 border-b border-[var(--ui-border)]">
            <p class="text-[11px] font-semibold text-[var(--ui-text-muted)] uppercase tracking-widest mb-3">Research Plan</p>
            <div class="space-y-1.5">
              <div v-for="topic in resolvedSession.plan.topics" :key="topic.id" class="flex items-start gap-2 px-2.5 py-2 rounded-md bg-[var(--ui-bg)] border border-[var(--ui-border)]">
                <span class="mt-0.5 shrink-0 text-[13px]">
                  <span v-if="topic.status === 'done'" class="text-emerald-500">✓</span>
                  <span v-else-if="topic.status === 'active'" class="text-blue-500 inline-block animate-spin">↻</span>
                  <span v-else class="text-[var(--ui-text-dimmed)]">○</span>
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-[13px] font-medium" :class="topic.status === 'active' ? 'text-blue-400' : 'text-[var(--ui-text-highlighted)]'">{{ topic.title }}</p>
                  <p class="text-[11px] text-[var(--ui-text-muted)] mt-0.5">{{ topic.queries.length }} queries</p>
                </div>
              </div>
            </div>
          </div>

          <div class="flex-1 p-4">
            <p class="text-[11px] font-semibold text-[var(--ui-text-muted)] uppercase tracking-widest mb-3">Activity Log</p>
            <div class="space-y-3 max-h-[400px] overflow-y-auto">
              <div v-for="entry in resolvedSession.progressLog.slice().reverse().slice(0, 20)" :key="entry.id" class="animate-slide-up">
                <div class="flex items-center justify-between gap-1.5 mb-1">
                  <RoleBadge :role="entry.role" size="xs" />
                  <ClientOnly v-if="entry.timestamp">
                    <span class="text-[10px] font-medium text-[var(--ui-text-muted)]">{{ formatLogTime(entry.timestamp) }}</span>
                    <template #fallback>
                      <span class="text-[10px] font-medium text-[var(--ui-text-muted)]">&nbsp;</span>
                    </template>
                  </ClientOnly>
                </div>
                <p class="text-[12px] text-[var(--ui-text)] leading-relaxed pl-1 border-l-2 border-[var(--ui-border)] py-0.5">{{ entry.message }}</p>
              </div>
              <div v-if="!resolvedSession.progressLog.length" class="text-center py-8">
                <p class="text-[12px] font-medium text-[var(--ui-text-muted)]">Waiting to start…</p>
              </div>
            </div>
          </div>
        </aside>

        <!-- CENTER -->
        <div class="flex-1 overflow-y-auto bg-[var(--ui-bg)]">
          <div class="max-w-2xl mx-auto px-8 py-8">
            <!-- Planning -->
            <template v-if="!resolvedSession.plan && resolvedSession.phase === 'planning'">
              <div class="mb-8">
                <p class="text-[12px] font-medium tracking-wide mb-3 flex items-center gap-2 text-amber-600">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                  Creating Plan
                </p>
                <h2 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)] mb-2">{{ resolvedSession.question }}</h2>
              </div>
              <div class="flex gap-6 mb-6 py-3 border-y border-[var(--ui-border)]">
                <div>
                  <div class="shimmer h-6 w-12 rounded" />
                </div>
                <div>
                  <div class="shimmer h-6 w-12 rounded" />
                </div>
                <div>
                  <div class="shimmer h-6 w-12 rounded" />
                </div>
              </div>
              <div class="space-y-3 mb-6">
                <div class="shimmer h-3.5 rounded w-full" />
                <div class="shimmer h-3.5 rounded w-5/6" />
                <div class="shimmer h-3.5 rounded w-4/6" />
                <div class="shimmer h-3.5 rounded w-full" />
                <div class="shimmer h-3.5 rounded w-3/6" />
              </div>
            </template>

            <!-- Plan Review -->
            <template v-else-if="resolvedSession.phase === 'plan-review'">
              <div class="mb-8">
                <p class="text-[12px] font-medium text-amber-600 mb-2">Plan Ready</p>
                <h1 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">{{ resolvedSession.question }}</h1>
              </div>
              <div class="space-y-2.5 mb-6">
                <div v-for="(topic, i) in resolvedSession.plan?.topics" :key="topic.id" class="p-4 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]">
                  <div class="flex items-start gap-3">
                    <span class="text-[13px] font-semibold text-[var(--ui-text-dimmed)] mt-0.5 shrink-0 tabular-nums">{{ i + 1 }}.</span>
                    <div class="flex-1">
                      <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ topic.title }}</h3>
                      <div class="flex flex-wrap gap-1.5 mt-2">
                        <span v-for="query in topic.queries" :key="query" class="text-[11px] text-[var(--ui-text-muted)] px-2 py-0.5 rounded-full bg-[var(--ui-bg-accented)]">{{ query }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex gap-2">
                <UButton label="Approve" icon="i-lucide-check" size="md" @click="handleApprove" />
                <UButton label="Edit" variant="outline" color="neutral" size="md" disabled />
              </div>
            </template>

            <!-- Active Research -->
            <template v-else-if="resolvedSession.phase === 'researching' || resolvedSession.phase === 'critiquing' || resolvedSession.phase === 'synthesizing'">
              <div class="mb-8">
                <p class="text-[12px] font-medium tracking-wide uppercase mb-3 flex items-center gap-2" :class="phaseTextColor">
                  <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
                  {{ phaseLabel }}
                </p>
                <h2 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)] mb-2">{{ resolvedSession.question }}</h2>
              </div>

              <!-- Phase-specific main content -->
              <div v-if="resolvedSession.phase === 'researching'" class="space-y-6">
                <!-- Current topic being investigated -->
                <div v-if="activeTopic" class="p-5 rounded-xl border border-blue-500/30 bg-blue-500/5 animate-slide-up">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <p class="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Currently Investigating</p>
                    <span class="text-[11px] text-[var(--ui-text-muted)] ml-auto">{{ completedTopicCount }}/{{ totalTopics }} topics done</span>
                  </div>
                  <h3 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-2">{{ activeTopic.title }}</h3>
                  <div class="flex flex-wrap gap-1.5">
                    <span v-for="query in activeTopic.queries" :key="query" class="text-[11px] text-[var(--ui-text-muted)] px-2 py-0.5 rounded-full bg-[var(--ui-bg-accented)]">{{ query }}</span>
                  </div>
                </div>

                <!-- Progress bar -->
                <div class="flex items-center gap-3">
                  <div class="flex-1 h-1.5 rounded-full bg-[var(--ui-bg-elevated)] overflow-hidden">
                    <div class="h-full rounded-full bg-blue-500 transition-all duration-700" :style="{ width: `${researchProgressPercent}%` }" />
                  </div>
                  <span class="text-[11px] font-medium text-[var(--ui-text-muted)] tabular-nums">{{ researchProgressPercent }}%</span>
                </div>

                <!-- Evidence collected so far -->
                <div v-if="resolvedSession.evidence.length > 0">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">Evidence Collected</h3>
                    <span class="text-[11px] text-[var(--ui-text-muted)]">{{ resolvedSession.evidence.length }} sources</span>
                  </div>
                  <div class="space-y-2">
                    <div v-for="ev in resolvedSession.evidence.slice(0, 5)" :key="ev.id" class="p-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]">
                      <div class="flex items-start gap-2">
                        <span class="text-[11px] font-medium text-blue-400 shrink-0 mt-0.5">{{ ev.domain }}</span>
                        <div class="flex-1 min-w-0">
                          <p class="text-[13px] font-medium text-[var(--ui-text-highlighted)] truncate">{{ ev.title }}</p>
                          <p class="text-[11px] text-[var(--ui-text-muted)] mt-0.5 line-clamp-2">{{ ev.snippet }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Critiquing phase -->
              <div v-else-if="resolvedSession.phase === 'critiquing'" class="space-y-6">
                <div class="p-5 rounded-xl border border-orange-500/30 bg-orange-500/5 animate-slide-up">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <p class="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Skeptic Review</p>
                  </div>
                  <p class="text-sm text-[var(--ui-text)]">Challenging weak claims, missing evidence, and unresolved gaps across {{ resolvedSession.evidence.length }} sources.</p>
                </div>

                <div v-if="resolvedSession.critiques.length > 0" class="space-y-3">
                  <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">Issues Found</h3>
                  <div v-for="critique in resolvedSession.critiques.slice(0, 5)" :key="critique.id" class="p-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-[10px] font-semibold uppercase tracking-wider" :class="critique.severity === 'high' ? 'text-red-400' : critique.severity === 'medium' ? 'text-amber-400' : 'text-[var(--ui-text-muted)]'">{{ critique.severity }}</span>
                      <span class="text-[10px] text-[var(--ui-text-muted)]">{{ critique.type }}</span>
                    </div>
                    <p class="text-[13px] font-medium text-[var(--ui-text-highlighted)]">{{ critique.claim }}</p>
                    <p class="text-[12px] text-[var(--ui-text-muted)] mt-1">{{ critique.critique }}</p>
                  </div>
                </div>
              </div>

              <!-- Synthesizing phase -->
              <div v-else-if="resolvedSession.phase === 'synthesizing'" class="space-y-6">
                <div class="p-5 rounded-xl border border-violet-500/30 bg-violet-500/5 animate-slide-up">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    <p class="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">Synthesizing Findings</p>
                  </div>
                  <p class="text-sm text-[var(--ui-text)]">Combining the strongest supported findings into a final report.</p>
                </div>

                <div v-if="resolvedSession.summary" class="animate-slide-up">
                  <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-2">Executive Summary</h3>
                  <p class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-line">{{ resolvedSession.summary }}</p>
                </div>
                <div v-else class="space-y-3">
                  <div class="shimmer h-3.5 rounded w-full" />
                  <div class="shimmer h-3.5 rounded w-5/6" />
                  <div class="shimmer h-3.5 rounded w-4/6" />
                </div>

                <div v-if="resolvedSession.finalAnswer" class="animate-slide-up">
                  <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-2">Final Recommendation</h3>
                  <div class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-line">{{ resolvedSession.finalAnswer }}</div>
                </div>
              </div>
            </template>

            <!-- Complete -->
            <template v-else-if="resolvedSession.phase === 'complete'">
              <CompleteMemo :session="resolvedSession" />
            </template>
          </div>
        </div>

        <!-- RIGHT - Only show for complete phase -->
        <aside v-if="resolvedSession.phase === 'complete'" class="w-80 border-l border-[var(--ui-border)] flex flex-col shrink-0 overflow-hidden bg-[var(--ui-bg-elevated)]">
          <UTabs :items="rightPanelTabs" :default-value="rightPanelTabs[0]?.value ?? 'evidence'" class="flex flex-col h-full min-h-0" :ui="{ trigger: 'text-[12px] font-medium', content: 'flex-1 overflow-y-auto min-h-0' }">
            <template #evidence>
              <div class="p-3 space-y-3 stagger-children">
                <p v-if="!resolvedSession?.evidence?.length" class="text-[13px] font-medium text-[var(--ui-text-muted)] text-center py-8">No evidence collected</p>
                <EvidenceCardComponent v-for="ev in resolvedSession?.evidence" :key="ev.id" :evidence="ev" />
              </div>
            </template>
            <template #critique>
              <div class="p-3 space-y-3 stagger-children">
                <p v-if="!resolvedSession?.critiques?.length" class="text-[13px] font-medium text-[var(--ui-text-muted)] text-center py-8">No critiques</p>
                <CritiqueCard v-for="critique in resolvedSession?.critiques" :key="critique.id" :critique="critique" />
              </div>
            </template>
            <template #contested>
              <div class="p-3 space-y-3 stagger-children">
                <p v-if="!resolvedSession?.contested?.length" class="text-[13px] font-medium text-[var(--ui-text-muted)] text-center py-8">No contested points</p>
                <ContestedCard v-for="cp in resolvedSession?.contested" :key="cp.id" :contested="cp" />
              </div>
            </template>
          </UTabs>
        </aside>
      </div>
    </div>

  <div v-else class="h-full flex flex-col items-center justify-center">
    <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-2">Session Not Found</h2>
    <p class="text-sm text-[var(--ui-text-muted)] mb-4">This research session doesn't exist or was deleted.</p>
    <UButton label="Go Home" to="/" variant="outline" />
  </div>
</template>

<script setup lang="ts">
import type { ResearchSession, ResearchTopic } from '~/composables/useResearch'

const route = useRoute()
const { sessions, activeSessionId, approvePlan, loadSession, refreshSessions, startSessionPolling, isPlaceholderSession, isOptimisticSession } = useResearch()

const sessionId = computed(() => route.params.id as string)
const session = computed(() => sessions.value.find(s => s.id === sessionId.value) || null)
const loadingSession = ref(false)
const sessionLookupComplete = ref(false)
const lastKnownQuestion = ref('')

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

const rightPanelTabs = computed(() => [
  { label: `Evidence (${resolvedSession.value?.evidence.length || 0})`, value: 'evidence', slot: 'evidence' as const },
  { label: `Critique (${resolvedSession.value?.critiques.length || 0})`, value: 'critique', slot: 'critique' as const },
  { label: `Contested (${resolvedSession.value?.contested.length || 0})`, value: 'contested', slot: 'contested' as const },
])

const phaseLabel = computed(() => {
  const l: Record<string, string> = { researching: 'Researching', critiquing: 'Critiquing', synthesizing: 'Synthesizing' }
  return l[resolvedSession.value?.phase || ''] || 'In Progress'
})
const phaseTextColor = computed(() => {
  const c: Record<string, string> = { researching: 'text-blue-600', critiquing: 'text-orange-600', synthesizing: 'text-violet-600' }
  return c[resolvedSession.value?.phase || ''] || 'text-[var(--ui-text-muted)]'
})

const activeTopic = computed<ResearchTopic | null>(() => {
  const topics = resolvedSession.value?.plan?.topics ?? []
  return topics.find(t => t.status === 'active') || null
})

const totalTopics = computed(() => resolvedSession.value?.plan?.topics.length ?? 0)

const completedTopicCount = computed(() => {
  return resolvedSession.value?.plan?.topics.filter(t => t.status === 'done').length ?? 0
})

const researchProgressPercent = computed(() => {
  if (totalTopics.value === 0) return 0
  return Math.round((completedTopicCount.value / totalTopics.value) * 100)
})

const handleApprove = async () => {
  if (sessionId.value) {
    await approvePlan(sessionId.value)
  }
}

const logTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const formatLogTime = (d: string) => logTimeFormatter.format(new Date(d))
</script>
