<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <UBadge label="Complete" color="success" variant="subtle" size="sm" class="drop-shadow-sm font-medium" />
        <UBadge :label="`${session.evidence.length} sources`" color="neutral" variant="subtle" size="sm" class="drop-shadow-sm font-medium" />
        <UBadge :label="`${session.critiques.length} objections`" color="neutral" variant="subtle" size="sm" class="drop-shadow-sm font-medium" />
      </div>
      <h2 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)] leading-tight mb-3 drop-shadow-sm">{{ session.question }}</h2>
      <p class="text-[14px] text-[var(--ui-text-muted)] tracking-wide">
        Completed {{ formatDate(session.completedAt!) }} &middot; {{ duration }} research time
      </p>
    </div>

    <!-- Confidence -->
    <div class="mb-8 p-4 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)]">
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
    </div>

    <!-- Summary -->
    <section class="mb-8">
      <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-2">Executive Summary</h3>
      <p class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-line">{{ session.summary }}</p>
    </section>

    <div class="h-px bg-[var(--ui-border)] my-6" />

    <!-- Final Answer -->
    <section class="mb-8">
      <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-2">Final Recommendation</h3>
      <div class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-line">{{ session.finalAnswer }}</div>
    </section>

    <div class="h-px bg-[var(--ui-border)] my-6" />

    <!-- Contested Points -->
    <section v-if="session.contested.length" class="mb-8">
      <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-3">
        Contested Points
        <span class="text-[var(--ui-text-dimmed)] font-normal ml-1">({{ session.contested.length }})</span>
      </h3>
      <div class="space-y-3">
        <div v-for="cp in session.contested" :key="cp.id" class="p-4 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]">
          <p class="text-[13px] font-medium text-[var(--ui-text-highlighted)] mb-3">{{ cp.point }}</p>
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 rounded-md bg-emerald-50 border border-emerald-100">
              <p class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">For</p>
              <p class="text-[12px] text-emerald-800 leading-relaxed">{{ cp.forArgument }}</p>
            </div>
            <div class="p-3 rounded-md bg-red-50 border border-red-100">
              <p class="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-1">Against</p>
              <p class="text-[12px] text-red-800 leading-relaxed">{{ cp.againstArgument }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="h-px bg-[var(--ui-border)] my-6" />

    <!-- Open Questions -->
    <section v-if="session.openQuestions.length" class="mb-8">
      <h3 class="text-sm font-semibold text-[var(--ui-text-highlighted)] mb-3">
        Open Questions
        <span class="text-[var(--ui-text-dimmed)] font-normal ml-1">({{ session.openQuestions.length }})</span>
      </h3>
      <ul class="space-y-2">
        <li v-for="(q, i) in session.openQuestions" :key="i" class="flex items-start gap-2 text-sm text-[var(--ui-text)]">
          <span class="text-[var(--ui-text-dimmed)] shrink-0">•</span>
          <span class="leading-relaxed">{{ q }}</span>
        </li>
      </ul>
    </section>

    <!-- Actions -->
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
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
</script>
