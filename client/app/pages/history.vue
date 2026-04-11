<template>
  <div class="h-full overflow-y-auto">
      <div class="max-w-4xl mx-auto px-6 py-8">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-semibold text-[var(--ui-text-highlighted)]">Research History</h1>
            <p class="text-sm text-[var(--ui-text-muted)] mt-0.5">{{ completedSessions.length }} completed sessions</p>
          </div>
          <UButton label="New Research" icon="i-lucide-plus" size="sm" to="/" />
        </div>

        <div v-if="completedSessions.length" class="space-y-3 stagger-children">
          <div
            v-for="session in completedSessions"
            :key="session.id"
            class="cursor-pointer p-5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] hover:border-[var(--ui-border-hover)] hover:shadow-sm transition-all"
            @click="$router.push(`/session/${session.id}`)"
          >
            <div class="flex items-start gap-4">
              <div
                class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                :class="getConfidenceClasses(session.confidenceLevel)"
              >
                {{ session.confidenceLevel }}%
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-1">{{ session.question }}</h3>
                <p class="text-[12px] text-[var(--ui-text-muted)] line-clamp-2 mb-2">{{ session.summary || 'No summary available' }}</p>
                <div class="flex items-center gap-3 text-[11px] text-[var(--ui-text-dimmed)]">
                  <span>{{ formatDate(session.completedAt || session.createdAt) }}</span>
                  <span>{{ session.evidence.length }} sources</span>
                  <span>{{ session.critiques.length }} objections</span>
                  <span>{{ session.contested.length }} contested</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-20">
          <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mb-2">No Research Yet</h2>
          <p class="text-sm text-[var(--ui-text-muted)] mb-4">Start your first research session.</p>
          <UButton label="Start Research" icon="i-lucide-plus" to="/" />
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
const { sessions } = useResearch()
const completedSessions = computed(() => sessions.value.filter(s => s.phase === 'complete'))

const getConfidenceClasses = (level: number) => {
  if (level >= 70) return 'bg-emerald-50 text-emerald-600 border border-emerald-100'
  if (level >= 50) return 'bg-amber-50 text-amber-600 border border-amber-100'
  return 'bg-red-50 text-red-600 border border-red-100'
}

const formatDate = (d: string) => {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
