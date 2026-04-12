<template>
  <div class="space-y-8">
    <section class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-4 shadow-sm">
      <PhaseStepper phase="complete" layout="horizontal" />
    </section>

    <section>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <UBadge label="Complete" color="success" variant="subtle" size="sm" class="drop-shadow-sm font-medium" />
        <UBadge :label="`${session.evidence.length} sources`" color="neutral" variant="subtle" size="sm" class="drop-shadow-sm font-medium" />
        <UBadge :label="`${session.critiques.length} objections`" color="neutral" variant="subtle" size="sm" class="drop-shadow-sm font-medium" />
      </div>
      <h2 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)] leading-tight mb-3 drop-shadow-sm">{{ session.question }}</h2>
      <p class="text-[14px] text-[var(--ui-text-muted)] tracking-wide">
        Completed {{ formatDate(session.completedAt!) }} · {{ duration }} research time
      </p>
    </section>

    <section class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <div class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[12px] font-medium text-[var(--ui-text-muted)]">Confidence Level</span>
          <span class="text-sm font-semibold" :class="confidenceColor">{{ session.confidenceLevel }}%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-[var(--ui-bg-accented)] overflow-hidden">
          <div class="h-full rounded-full transition-all duration-1000 ease-out" :class="confidenceBg" :style="{ width: `${session.confidenceLevel}%` }" />
        </div>
        <div class="flex justify-between mt-1.5 text-[10px] text-[var(--ui-text-dimmed)]">
          <span>Low confidence</span>
          <span>High confidence</span>
        </div>
        <p class="mt-4 text-[12px] leading-relaxed text-[var(--ui-text-muted)]">
          The final recommendation is calibrated from collected evidence, skeptic review, and unresolved open questions.
        </p>
      </div>

      <div class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-5">
        <div class="mb-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text-dimmed)]">Research Snapshot</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="stat in snapshotStats" :key="stat.label" class="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-3">
            <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">{{ stat.label }}</p>
            <p class="mt-2 text-xl font-semibold tracking-tight text-[var(--ui-text-highlighted)]">{{ stat.value }}</p>
            <p class="mt-1 text-[11px] leading-relaxed text-[var(--ui-text-muted)]">{{ stat.helper }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-6">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">Executive Summary</h3>
        <span class="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-text-dimmed)]">Summary</span>
      </div>
      <p class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-line">{{ session.summary }}</p>
    </section>

    <section class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-6">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">Final Recommendation</h3>
        <span class="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-text-dimmed)]">Decision</span>
      </div>
      <div class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-line">{{ session.finalAnswer }}</div>
    </section>

    <section v-if="session.openQuestions.length" class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">Open Questions</h3>
        <span class="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-text-dimmed)]">{{ session.openQuestions.length }} remaining</span>
      </div>
      <ul class="space-y-2">
        <li v-for="(question, index) in session.openQuestions" :key="index" class="flex items-start gap-2 text-sm text-[var(--ui-text)]">
          <span class="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--ui-primary)] shrink-0" />
          <span class="leading-relaxed">{{ question }}</span>
        </li>
      </ul>
    </section>

    <section v-if="majorProgressEntries.length" class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">How Research Progressed</h3>
          <p class="mt-1 text-[12px] text-[var(--ui-text-muted)]">A compact timeline of the major research milestones.</p>
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="entry in majorProgressEntries"
          :key="entry.id"
          class="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] px-4 py-3"
        >
          <div class="mb-1.5 flex items-center justify-between gap-3">
            <RoleBadge :role="entry.role" size="xs" />
            <span class="text-[11px] font-medium text-[var(--ui-text-muted)]">{{ formatLogTime(entry.timestamp) }}</span>
          </div>
          <p class="text-[13px] leading-relaxed text-[var(--ui-text)]">{{ entry.message }}</p>
        </div>
      </div>
    </section>

    <div class="flex items-center gap-2 pt-4 border-t border-[var(--ui-border)]">
      <UButton label="Export Memo" icon="i-lucide-download" variant="outline" color="neutral" size="sm" />
      <UButton label="Follow Up" icon="i-lucide-message-circle" variant="soft" size="sm" />
      <UButton label="New Research" icon="i-lucide-plus" variant="ghost" color="neutral" size="sm" to="/" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ResearchSession } from '~/composables/useResearch'

const props = defineProps<{ session: ResearchSession }>()

const confidenceColor = computed(() => {
  const c = props.session.confidenceLevel
  return c >= 70 ? 'text-emerald-600' : c >= 50 ? 'text-amber-600' : 'text-red-600'
})

const confidenceBg = computed(() => {
  const c = props.session.confidenceLevel
  return c >= 70 ? 'bg-emerald-500' : c >= 50 ? 'bg-amber-500' : 'bg-red-500'
})

const duration = computed(() => {
  if (!props.session.completedAt) return '–'
  const mins = Math.round((new Date(props.session.completedAt).getTime() - new Date(props.session.createdAt).getTime()) / 60000)
  return mins < 1 ? '<1 min' : `${mins} min`
})

const snapshotStats = computed(() => ([
  {
    label: 'Topics Covered',
    value: props.session.plan?.topics.length ?? 0,
    helper: 'Approved topics completed in the session.',
  },
  {
    label: 'Sources Reviewed',
    value: props.session.evidence.length,
    helper: 'Evidence cards captured during research.',
  },
  {
    label: 'Objections Found',
    value: props.session.critiques.length,
    helper: 'Skeptic challenges surfaced before synthesis.',
  },
  {
    label: 'Open Questions',
    value: props.session.openQuestions.length,
    helper: 'Follow-up gaps left for the next pass.',
  },
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
