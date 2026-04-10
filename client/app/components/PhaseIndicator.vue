<template>
  <div class="flex items-center gap-2">
    <span class="w-1.5 h-1.5 rounded-full shrink-0 ring-4 ring-current/10 shadow-[0_0_8px_current]" :class="dotClass" />
    <span class="text-[12px] font-medium tracking-tight" :class="textClass">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import type { ResearchPhase } from '~/composables/useResearch'

const props = defineProps<{ phase: ResearchPhase }>()

const config: Record<ResearchPhase, { label: string; dotClass: string; textClass: string }> = {
  idle: { label: 'Idle', dotClass: 'bg-[var(--ui-border)]', textClass: 'text-[var(--ui-text-dimmed)]' },
  planning: { label: 'Creating plan…', dotClass: 'bg-amber-400 animate-pulse-dot', textClass: 'text-amber-600' },
  'plan-review': { label: 'Awaiting approval', dotClass: 'bg-amber-400', textClass: 'text-amber-600' },
  researching: { label: 'Researching…', dotClass: 'bg-blue-400 animate-pulse-dot', textClass: 'text-blue-600' },
  critiquing: { label: 'Critiquing…', dotClass: 'bg-orange-400 animate-pulse-dot', textClass: 'text-orange-600' },
  synthesizing: { label: 'Synthesizing…', dotClass: 'bg-violet-400 animate-pulse-dot', textClass: 'text-violet-600' },
  complete: { label: 'Complete', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600' },
}

const label = computed(() => config[props.phase]?.label || props.phase)
const dotClass = computed(() => config[props.phase]?.dotClass || 'bg-[var(--ui-border)]')
const textClass = computed(() => config[props.phase]?.textClass || 'text-[var(--ui-text-dimmed)]')
</script>
