<template>
  <div class="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col px-6">
      <!-- Hero Input -->
      <div class="relative flex flex-1 flex-col justify-center overflow-hidden py-12">
        <!-- Decoration -->
        <div class="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none opacity-20 dark:opacity-10 blur-3xl">
          <div class="w-72 h-72 bg-gradient-to-br from-[var(--ui-primary)]/20 to-[var(--ui-bg)] rounded-full" />
        </div>

        <div class="mx-auto w-full max-w-xl text-center relative z-10">
          <h1 class="text-2xl font-serif font-normal tracking-tight text-[var(--ui-text-highlighted)] mb-3">
            What decision are you researching?
          </h1>
          <p class="text-[var(--ui-text-dimmed)] text-sm mb-10 max-w-md mx-auto">
            Enter a question and get an evidence-backed decision memo with sources, objections, and confidence.
          </p>

          <form @submit.prevent="startResearch" class="w-full relative group">
            <div class="relative rounded-xl bg-[var(--ui-bg)] dark:bg-zinc-900/80 border border-[var(--ui-border)]/60 focus-within:border-[var(--ui-primary)] focus-within:ring-1 focus-within:ring-[var(--ui-primary)]/50 transition-all overflow-hidden flex flex-col backdrop-blur-sm">
              <UTextarea
                v-model="question"
                autoresize
                :rows="2"
                :maxrows="6"
                placeholder="e.g. Should I pursue the AI agent market for a solo developer product?"
                autofocus
                variant="none"
                class="w-full text-[15px] p-4 bg-transparent resize-none outline-none focus:ring-0 placeholder:text-zinc-500"
                :ui="{ root: 'w-full', base: 'w-full !bg-transparent text-lg' }"
                @keydown.enter.prevent="startResearch"
              />
              <div class="flex items-center justify-end px-4 pb-3 pt-1">
                <UButton
                  type="submit"
                  icon="i-lucide-arrow-up"
                  trailing
                  size="sm"
                  :disabled="!question.trim()"
                  class="font-medium rounded-lg"
                />
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Recent Sessions -->
      <div v-if="recentSessions.length" class="border-t border-[var(--ui-border)]/30 py-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-[var(--ui-text-muted)]">Recent Research</h2>
            <UButton
              v-if="recentSessions.length > 3"
              label="View All"
              variant="ghost"
              color="neutral"
              size="xs"
              trailing-icon="i-lucide-arrow-right"
              to="/history"
            />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
            <div
              v-for="session in recentSessions.slice(0, 3)"
              :key="session.id"
              class="cursor-pointer p-4 rounded-lg bg-[var(--ui-bg-elevated)]/60 hover:bg-[var(--ui-bg-accented)] transition-all backdrop-blur-sm"
              @click="openSession(session.id)"
            >
              <div class="flex items-start justify-between gap-2 mb-3">
                <h3 class="text-[13px] font-medium text-[var(--ui-text-highlighted)] line-clamp-2 flex-1">
                  {{ session.question }}
                </h3>
                <span class="text-[12px] font-medium text-[var(--ui-text-dimmed)] shrink-0">
                  {{ session.confidenceLevel }}%
                </span>
              </div>
              <div class="flex items-center gap-3 text-[11px] text-[var(--ui-text-dimmed)]">
                <span>{{ formatDate(session.completedAt || session.createdAt) }}</span>
                <span>{{ session.evidence.length }} sources</span>
                <span>{{ session.critiques.length }} objections</span>
              </div>
            </div>
          </div>
      </div>

      <!-- Examples -->
      <div v-else class="border-t border-[var(--ui-border)]/30 py-8">
        <div class="mx-auto w-full max-w-md">
          <h2 class="text-sm font-medium text-[var(--ui-text-dimmed)] mb-4 text-center">Try an example</h2>
          <div class="flex flex-col gap-2">
            <button
              v-for="example in exampleQuestions"
              :key="example"
              class="text-left px-4 py-3 rounded-lg text-[13px] text-[var(--ui-text-muted)] bg-[var(--ui-bg-elevated)]/40 hover:bg-[var(--ui-bg-accented)] transition-all"
              @click="question = example"
            >
              {{ example }}
            </button>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { sessions, createSession } = useResearch()

const question = ref('')

const recentSessions = computed(() =>
  sessions.value.filter(s => s.phase === 'complete').slice(0, 6)
)

const exampleQuestions = [
  'Should I pursue the AI agent market as a solo developer?',
  'What are the strongest arguments for and against remote-first companies?',
  'Is Rust worth learning in 2025 for backend development?',
  'Should I bootstrap or raise funding for a B2B SaaS?',
]

const startResearch = async () => {
  if (!question.value.trim()) return
  const sessionId = await createSession(question.value.trim())
  question.value = ''
  router.push(`/session/${sessionId}`)
}

const openSession = (id: string) => router.push(`/session/${id}`)

const formatDate = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>
