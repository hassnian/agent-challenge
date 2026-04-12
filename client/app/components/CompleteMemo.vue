<template>
  <div class="space-y-0">
    <!-- Header -->
    <section class="pb-6 border-b border-[var(--ui-border)]/40">
      <h2 class="text-3xl font-serif font-normal tracking-tight text-[var(--ui-text-highlighted)] leading-tight mb-3">{{ session.question }}</h2>
      <p class="text-sm text-[var(--ui-text-muted)]">
        Completed {{ formatDate(session.completedAt!) }} · {{ duration }} · {{ session.evidence.length }} sources · {{ session.critiques.length }} objections
      </p>
    </section>

    <!-- Confidence + Stats -->
    <section class="py-8 border-b border-[var(--ui-border)]/40">
      <div class="flex items-baseline gap-8 flex-wrap">
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-serif font-light tracking-tight" :class="confidenceColor">{{ session.confidenceLevel }}%</span>
          <span class="text-sm text-[var(--ui-text-dimmed)]">confidence</span>
        </div>
        <div class="flex gap-8">
          <div v-for="stat in snapshotStats" :key="stat.label">
            <p class="text-2xl font-serif font-light text-[var(--ui-text-highlighted)]">{{ stat.value }}</p>
            <p class="text-[11px] text-[var(--ui-text-dimmed)] mt-0.5">{{ stat.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Executive Summary -->
    <section class="py-8 border-b border-[var(--ui-border)]/40">
      <h3 class="text-lg font-serif font-normal text-[var(--ui-text-highlighted)] mb-4">Executive Summary</h3>
      <p class="text-[15px] text-[var(--ui-text)] leading-[1.75] whitespace-pre-line">{{ session.summary }}</p>
    </section>

    <!-- Final Recommendation -->
    <section class="py-8 border-b border-[var(--ui-border)]/40">
      <div class="pl-5 border-l-2 border-[var(--ui-primary)]/30">
        <h3 class="text-lg font-serif font-normal text-[var(--ui-text-highlighted)] mb-4">Final Recommendation</h3>
        <div class="text-[15px] text-[var(--ui-text)] leading-[1.75] whitespace-pre-line">{{ session.finalAnswer }}</div>
      </div>
    </section>

    <!-- Open Questions -->
    <section v-if="session.openQuestions.length" class="py-8 border-b border-[var(--ui-border)]/40">
      <h3 class="text-lg font-serif font-normal text-[var(--ui-text-highlighted)] mb-4">Open Questions</h3>
      <ul class="space-y-2.5">
        <li v-for="(question, index) in session.openQuestions" :key="index" class="flex items-start gap-3 text-[15px] text-[var(--ui-text)]">
          <span class="text-[var(--ui-text-dimmed)]/40 shrink-0 select-none">—</span>
          <span class="leading-relaxed">{{ question }}</span>
        </li>
      </ul>
    </section>

    <!-- Research Timeline -->
    <section v-if="majorProgressEntries.length" class="py-8 border-b border-[var(--ui-border)]/40">
      <h3 class="text-lg font-serif font-normal text-[var(--ui-text-highlighted)] mb-1">How Research Progressed</h3>
      <p class="text-[13px] text-[var(--ui-text-dimmed)] mb-6">Key milestones from the research process.</p>

      <div class="space-y-0">
        <div
          v-for="entry in majorProgressEntries"
          :key="entry.id"
          class="flex items-start gap-4 py-3 border-b border-[var(--ui-border)]/20 last:border-0"
        >
          <span class="text-[11px] font-medium text-[var(--ui-text-dimmed)] shrink-0 w-16 mt-0.5">{{ formatLogTime(entry.timestamp) }}</span>
          <RoleBadge :role="entry.role" size="xs" class="shrink-0 mt-0.5" />
          <p class="text-[13px] leading-relaxed text-[var(--ui-text)]">{{ entry.message }}</p>
        </div>
      </div>
    </section>

    <!-- Actions -->
    <div class="flex items-center gap-2 pt-8">
      <UButton label="Export Memo" icon="i-lucide-download" variant="outline" color="neutral" size="sm" />
      <UButton label="Follow Up" icon="i-lucide-message-circle" variant="ghost" color="neutral" size="sm" />
      <UButton label="New Research" icon="i-lucide-plus" variant="ghost" color="neutral" size="sm" to="/" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ResearchSession } from '~/composables/useResearch'

const props = defineProps<{ session: ResearchSession }>()

const confidenceColor = computed(() => {
  const c = props.session.confidenceLevel
  return c >= 70 ? 'text-emerald-500' : c >= 50 ? 'text-amber-500' : 'text-red-500'
})

const duration = computed(() => {
  if (!props.session.completedAt) return '–'
  const mins = Math.round((new Date(props.session.completedAt).getTime() - new Date(props.session.createdAt).getTime()) / 60000)
  return mins < 1 ? '<1 min' : `${mins} min`
})

const snapshotStats = computed(() => ([
  { label: 'Topics', value: props.session.plan?.topics.length ?? 0 },
  { label: 'Sources', value: props.session.evidence.length },
  { label: 'Objections', value: props.session.critiques.length },
  { label: 'Open', value: props.session.openQuestions.length },
]))

const majorProgressEntries = computed(() => {
  return props.session.progressLog
    .filter((entry) => /ready|approved|starting|investigating|collected|challenging|combining|completed/i.test(entry.message))
    .slice(-6)
    .reverse()
})

const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const logTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const formatLogTime = (date: string) => logTimeFormatter.format(new Date(date))
</script>
