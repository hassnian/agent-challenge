<template>
  <NuxtLayout>
    <div v-if="session" class="h-full flex flex-col relative">
      <!-- Top Structural Bar -->
      <header class="shrink-0 h-14 border-b border-[var(--ui-border)] bg-[var(--ui-bg)] px-4 flex items-center justify-between relative z-10 w-full transition-all">
        <div class="flex items-center gap-3 ml-10"> <!-- ml-10 acts as clearance for floating hamburger in default.vue -->
          <div class="flex items-center gap-1.5 text-[12px] text-[var(--ui-text-muted)] font-medium">
            <span class="hover:text-[var(--ui-text)] transition-colors cursor-pointer">Workspace</span>
            <UIcon name="i-lucide-chevron-right" class="text-[10px] opacity-50" />
            <span class="text-[var(--ui-text)]">Decision Report</span>
            <span v-if="session.phase === 'complete'" class="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] ml-1 uppercase tracking-wider font-bold">Done</span>
            <span v-else class="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] ml-1 uppercase tracking-wider font-bold">Active</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-share" variant="ghost" color="neutral" size="xs" class="text-[var(--ui-text-dimmed)]" />
          <UButton icon="i-lucide-more-horizontal" variant="ghost" color="neutral" size="xs" class="text-[var(--ui-text-dimmed)]" />
        </div>
      </header>

      <!-- 3-Panel -->
      <div class="flex-1 flex overflow-hidden">
        <!-- LEFT -->
        <aside class="w-68 border-r border-[var(--ui-border)] flex flex-col shrink-0 overflow-y-auto bg-[var(--ui-bg-elevated)]">
          <div class="px-4 py-4 border-b border-[var(--ui-border)]">
            <p class="text-[11px] font-semibold text-[var(--ui-text-muted)] uppercase tracking-widest mb-3">Progress</p>
            <PhaseStepper :phase="session.phase" />
          </div>

          <div v-if="session.plan" class="p-4 border-b border-[var(--ui-border)]">
            <p class="text-[11px] font-semibold text-[var(--ui-text-muted)] uppercase tracking-widest mb-3">Research Plan</p>
            <div class="space-y-1.5">
              <div v-for="topic in session.plan.topics" :key="topic.id" class="flex items-start gap-2 px-2.5 py-2 rounded-md bg-[var(--ui-bg)] border border-[var(--ui-border)]">
                <span class="mt-0.5 shrink-0 text-[13px]">
                  <span v-if="topic.status === 'done'" class="text-emerald-500">✓</span>
                  <span v-else-if="topic.status === 'active'" class="text-blue-500 inline-block animate-spin">↻</span>
                  <span v-else class="text-[var(--ui-text-dimmed)]">○</span>
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-[13px] font-medium text-[var(--ui-text-highlighted)]">{{ topic.title }}</p>
                  <p class="text-[11px] text-[var(--ui-text-muted)] mt-0.5">{{ topic.queries.length }} queries</p>
                </div>
              </div>
            </div>
            <UButton v-if="session.phase === 'plan-review'" label="Approve & Start Research" icon="i-lucide-check" block class="mt-3" size="sm" @click="handleApprove" />
          </div>

          <div class="flex-1 p-4">
            <p class="text-[11px] font-semibold text-[var(--ui-text-muted)] uppercase tracking-widest mb-3">Activity Log</p>
            <div class="space-y-3">
              <div v-for="entry in session.progressLog.slice().reverse().slice(0, 20)" :key="entry.id" class="animate-slide-up">
                <div class="flex items-center gap-1.5 mb-1">
                  <RoleBadge :role="entry.role" size="xs" />
                  <span class="text-[10px] font-medium text-[var(--ui-text-muted)]">{{ formatLogTime(entry.timestamp) }}</span>
                </div>
                <p class="text-[12px] text-[var(--ui-text)] leading-relaxed pl-1 border-l-2 border-[var(--ui-border)] py-0.5">{{ entry.message }}</p>
              </div>
              <div v-if="!session.progressLog.length" class="text-center py-8">
                <p class="text-[12px] font-medium text-[var(--ui-text-muted)]">Waiting to start…</p>
              </div>
            </div>
          </div>
        </aside>

        <!-- CENTER -->
        <div class="flex-1 overflow-y-auto bg-[var(--ui-bg)]">
          <div class="max-w-2xl mx-auto px-8 py-8">
            <!-- Planning -->
            <template v-if="!session.plan && session.phase === 'planning'">
              <div class="flex flex-col items-center justify-center py-20 text-center">
                <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-2">Creating Research Plan</h2>
                <p class="text-sm text-[var(--ui-text-muted)] max-w-sm mb-6">Analyzing your question and identifying key topics…</p>
                <div class="flex gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-[var(--ui-primary)] animate-bounce" style="animation-delay: 0s" />
                  <span class="w-1.5 h-1.5 rounded-full bg-[var(--ui-primary)] opacity-70 animate-bounce" style="animation-delay: 0.15s" />
                  <span class="w-1.5 h-1.5 rounded-full bg-[var(--ui-primary)] opacity-40 animate-bounce" style="animation-delay: 0.3s" />
                </div>
              </div>
            </template>

            <!-- Plan Review -->
            <template v-else-if="session.phase === 'plan-review'">
              <div class="mb-6">
                <p class="text-[12px] font-medium text-amber-600 mb-2">Plan Ready</p>
                <h2 class="text-xl font-semibold text-[var(--ui-text-highlighted)] mb-1">Review Your Research Plan</h2>
                <p class="text-sm text-[var(--ui-text-muted)]">Review the topics below. Once approved, evidence collection begins.</p>
              </div>
              <div class="space-y-2.5 mb-6">
                <div v-for="(topic, i) in session.plan?.topics" :key="topic.id" class="p-4 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]">
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
                <UButton label="Approve & Start Research" icon="i-lucide-check" size="md" @click="handleApprove" />
                <UButton label="Edit Plan" variant="outline" color="neutral" size="md" disabled />
              </div>
            </template>

            <!-- Active Research -->
            <template v-else-if="session.phase === 'researching' || session.phase === 'critiquing' || session.phase === 'synthesizing'">
              <div class="mb-8">
                <p class="text-[12px] font-medium tracking-wide uppercase mb-3 flex items-center gap-2" :class="phaseTextColor">
                  <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
                  {{ phaseLabel }}
                </p>
                <h2 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)] mb-2">{{ session.question }}</h2>
                <p class="text-[15px] text-[var(--ui-text-muted)]">Memo is being written as research progresses…</p>
              </div>
              <div class="flex gap-6 mb-6 py-3 border-y border-[var(--ui-border)]">
                <div>
                  <p class="text-[11px] text-[var(--ui-text-dimmed)]">Sources</p>
                  <p class="text-lg font-semibold text-[var(--ui-text-highlighted)] tabular-nums">{{ session.evidence.length }}</p>
                </div>
                <div>
                  <p class="text-[11px] text-[var(--ui-text-dimmed)]">Objections</p>
                  <p class="text-lg font-semibold text-[var(--ui-text-highlighted)] tabular-nums">{{ session.critiques.length }}</p>
                </div>
                <div>
                  <p class="text-[11px] text-[var(--ui-text-dimmed)]">Contested</p>
                  <p class="text-lg font-semibold text-[var(--ui-text-highlighted)] tabular-nums">{{ session.contested.length }}</p>
                </div>
              </div>
              <div v-if="session.summary" class="animate-slide-up mb-6">
                <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-2">Executive Summary</h3>
                <p class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-line">{{ session.summary }}</p>
              </div>
              <div v-else class="space-y-3 mb-6">
                <div class="shimmer h-3.5 rounded w-full" />
                <div class="shimmer h-3.5 rounded w-5/6" />
                <div class="shimmer h-3.5 rounded w-4/6" />
                <div class="shimmer h-3.5 rounded w-full" />
                <div class="shimmer h-3.5 rounded w-3/6" />
              </div>
              <div v-if="session.finalAnswer" class="animate-slide-up">
                <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-2">Final Recommendation</h3>
                <div class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-line">{{ session.finalAnswer }}</div>
              </div>
            </template>

            <!-- Complete -->
            <template v-else-if="session.phase === 'complete'">
              <CompleteMemo :session="session" />
            </template>
          </div>
        </div>

        <!-- RIGHT -->
        <aside v-if="showRightPanel" class="w-80 border-l border-[var(--ui-border)] flex flex-col shrink-0 overflow-hidden bg-[var(--ui-bg-elevated)]">
          <UTabs :items="rightPanelTabs" :default-value="rightPanelTabs[0]?.value ?? 'evidence'" class="flex flex-col h-full" :ui="{ trigger: 'text-[12px] font-medium' }">
            <template #evidence>
              <div class="p-3 space-y-3 overflow-y-auto stagger-children">
                <p v-if="!session?.evidence?.length" class="text-[13px] font-medium text-[var(--ui-text-muted)] text-center py-8">Evidence will appear here…</p>
                <EvidenceCardComponent v-for="ev in session?.evidence" :key="ev.id" :evidence="ev" />
              </div>
            </template>
            <template #critique>
              <div class="p-3 space-y-3 overflow-y-auto stagger-children">
                <p v-if="!session?.critiques?.length" class="text-[13px] font-medium text-[var(--ui-text-muted)] text-center py-8">Critique notes appear after evidence review</p>
                <CritiqueCard v-for="critique in session?.critiques" :key="critique.id" :critique="critique" />
              </div>
            </template>
            <template #contested>
              <div class="p-3 space-y-3 overflow-y-auto stagger-children">
                <p v-if="!session?.contested?.length" class="text-[13px] font-medium text-[var(--ui-text-muted)] text-center py-8">Contested points appear after critique</p>
                <ContestedCard v-for="cp in session?.contested" :key="cp.id" :contested="cp" />
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
  </NuxtLayout>
</template>

<script setup lang="ts">
const route = useRoute()
const { sessions, activeSessionId, approvePlan, loadSession } = useResearch()

const sessionId = computed(() => route.params.id as string)
const session = computed(() => sessions.value.find(s => s.id === sessionId.value))

watch(sessionId, async (id) => {
  if (!id) {
    return
  }

  activeSessionId.value = id
  if (!sessions.value.find(item => item.id === id)) {
    await loadSession(id)
  }
}, { immediate: true })

const showRightPanel = computed(() => session.value && session.value.phase !== 'planning' && session.value.phase !== 'idle')

const rightPanelTabs = computed(() => [
  { label: `Evidence (${session.value?.evidence.length || 0})`, value: 'evidence', slot: 'evidence' as const },
  { label: `Critique (${session.value?.critiques.length || 0})`, value: 'critique', slot: 'critique' as const },
  { label: `Contested (${session.value?.contested.length || 0})`, value: 'contested', slot: 'contested' as const },
])

const phaseLabel = computed(() => {
  const l: Record<string, string> = { researching: 'Researching', critiquing: 'Critiquing', synthesizing: 'Synthesizing' }
  return l[session.value?.phase || ''] || 'In Progress'
})
const phaseTextColor = computed(() => {
  const c: Record<string, string> = { researching: 'text-blue-600', critiquing: 'text-orange-600', synthesizing: 'text-violet-600' }
  return c[session.value?.phase || ''] || 'text-[var(--ui-text-muted)]'
})

const handleApprove = async () => {
  if (sessionId.value) {
    await approvePlan(sessionId.value)
  }
}

const formatTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const formatLogTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
</script>
