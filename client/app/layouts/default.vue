<template>
  <div class="flex h-screen bg-[var(--ui-bg)]">
    <!-- Sidebar -->
    <aside
      class="border-r border-[var(--ui-border)] flex flex-col bg-[var(--ui-bg-elevated)] shrink-0 transition-[width,opacity] duration-300"
      :class="isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'"
    >
      <!-- Brand -->
      <div class="px-4 py-4 border-b border-[var(--ui-border)] flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2">
          <span class="text-[var(--ui-primary)] text-lg drop-shadow-sm">◆</span>
          <div class="min-w-0">
            <h1 class="text-[14px] font-semibold text-[var(--ui-text-highlighted)] truncate">Research Council</h1>
            <p class="text-[11px] text-[var(--ui-text-muted)] leading-tight truncate">Decision Research</p>
          </div>
        </NuxtLink>
      </div>

      <!-- New Research -->
      <div class="p-3">
        <UButton
          icon="i-lucide-plus"
          label="New Research"
          block
          size="sm"
          class="font-medium shadow-sm transition-transform active:scale-[0.98]"
          @click="handleNewResearch"
        />
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-3">
        <div class="mb-4">
          <p class="text-[10px] font-semibold text-[var(--ui-text-dimmed)] uppercase tracking-widest px-2 mb-1.5">Active</p>
          <template v-if="activeSessions.length">
            <button
              v-for="session in activeSessions"
              :key="session.id"
              class="w-full text-left px-2.5 py-2 rounded-md text-[13px] hover:bg-[var(--ui-bg-accented)] transition-colors mb-0.5"
              :class="{ 'bg-[var(--ui-bg-accented)] shadow-sm ring-1 ring-[var(--ui-border)]': selectedSessionId === session.id }"
              @click="navigateToSession(session.id)"
            >
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full shrink-0 ring-2 ring-current/20 shadow-[0_0_6px_current]" :class="phaseColor(session.phase)" />
                <span class="truncate font-medium transition-colors" :class="selectedSessionId === session.id ? 'text-[var(--ui-text-highlighted)]' : 'text-[var(--ui-text)]'">{{ session.question.slice(0, 36) }}{{ session.question.length > 36 ? '…' : '' }}</span>
              </div>
              <p class="text-[11px] text-[var(--ui-text-muted)] mt-1 ml-3.5">{{ formatPhase(session.phase) }}</p>
            </button>
          </template>
          <p v-else class="text-[12px] text-[var(--ui-text-dimmed)] px-2 py-1">No active research</p>
        </div>

        <div class="h-px bg-[var(--ui-border)] my-3 mx-2" />

        <div>
          <p class="text-[10px] font-semibold text-[var(--ui-text-dimmed)] uppercase tracking-widest px-2 mb-1.5">History</p>
          <template v-if="completedSessions.length">
            <button
              v-for="session in completedSessions"
              :key="session.id"
              class="w-full text-left px-2.5 py-2 rounded-md text-[13px] hover:bg-[var(--ui-bg-accented)] transition-colors mb-0.5"
              :class="{ 'bg-[var(--ui-bg-accented)] shadow-sm ring-1 ring-[var(--ui-border)]': selectedSessionId === session.id }"
              @click="navigateToSession(session.id)"
            >
              <span class="truncate transition-colors block font-medium" :class="selectedSessionId === session.id ? 'text-[var(--ui-text-highlighted)]' : 'text-[var(--ui-text-muted)]'">{{ session.question.slice(0, 36) }}{{ session.question.length > 36 ? '…' : '' }}</span>
              <div class="flex items-center gap-2 mt-1">
                <ClientOnly>
                  <span class="text-[11px] text-[var(--ui-text-dimmed)]">{{ formatDate(session.completedAt || session.createdAt) }}</span>
                  <template #fallback>
                    <span class="text-[11px] text-[var(--ui-text-dimmed)]">&nbsp;</span>
                  </template>
                </ClientOnly>
                <span class="text-[11px] text-[var(--ui-text-muted)] font-medium">{{ session.confidenceLevel }}%</span>
              </div>
            </button>
          </template>
          <p v-else class="text-[12px] text-[var(--ui-text-dimmed)] px-2 py-1">No completed sessions</p>
        </div>
      </nav>

      <!-- Footer -->
      <div class="p-3 border-t border-[var(--ui-border)] flex items-center justify-between bg-[var(--ui-bg)]">
        <div class="flex items-center gap-2 pl-2">
          <UIcon name="i-lucide-command" class="text-[var(--ui-text-dimmed)] text-[12px]" />
          <span class="text-[11px] font-medium text-[var(--ui-text-muted)] tracking-wide">Workspace</span>
        </div>
        <ClientOnly>
          <UButton
            :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
            color="neutral"
            variant="ghost"
            size="xs"
            class="transition-transform hover:rotate-12 hover:scale-110 active:scale-95"
            @click="isDark = !isDark"
          />
          <template #fallback>
            <div class="w-6 h-6" />
          </template>
        </ClientOnly>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden bg-[var(--ui-bg)] relative flex flex-col">
      <div class="absolute top-[11px] left-60 z-50">
        <UButton
          :icon="isSidebarOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left'"
          variant="ghost"
          color="neutral"
          size="sm"
          class="text-[var(--ui-text-dimmed)] hover:text-[var(--ui-text-highlighted)] transition-colors"
          @click="isSidebarOpen = !isSidebarOpen"
        />
      </div>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { sessions, activeSessionId, refreshSessions } = useResearch()

await useAsyncData('research-bootstrap', async () => {
  await refreshSessions({ silent: true })
  return true
})

const isSidebarOpen = ref(false)

const colorMode = useColorMode()
const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (value) => { colorMode.preference = value ? 'dark' : 'light' }
})

const activeSessions = computed(() =>
  sessions.value.filter(s => s.phase !== 'complete' && s.phase !== 'idle')
)
const completedSessions = computed(() =>
  sessions.value.filter(s => s.phase === 'complete')
)
const selectedSessionId = computed(() =>
  typeof route.params.id === 'string' && route.params.id.length > 0
    ? route.params.id
    : activeSessionId.value
)

const handleNewResearch = () => { router.push('/') }

const navigateToSession = (id: string) => {
  activeSessionId.value = id
  router.push(`/session/${id}`)
}

const phaseColor = (phase: string) => {
  const c: Record<string, string> = {
    planning: 'bg-amber-400', 'plan-review': 'bg-amber-400',
    researching: 'bg-blue-400', critiquing: 'bg-orange-400',
    synthesizing: 'bg-violet-400', complete: 'bg-emerald-500',
  }
  return c[phase] || 'bg-[var(--ui-border)]'
}

const formatPhase = (phase: string) => {
  const l: Record<string, string> = {
    planning: 'Creating plan…', 'plan-review': 'Awaiting approval',
    researching: 'Researching…', critiquing: 'Critiquing…',
    synthesizing: 'Synthesizing…', complete: 'Complete',
  }
  return l[phase] || phase
}

const historyDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

const formatDate = (dateStr: string) => historyDateFormatter.format(new Date(dateStr))
</script>
