<template>
  <div class="space-y-3 relative before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-[var(--ui-border)] before:-z-10">
    <div v-for="step in steps" :key="step.key" class="flex items-start gap-3">
      <div
        class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] ring-2 ring-[var(--ui-bg)] transition-all duration-300 mt-0.5"
        :class="getStepClasses(step.key)"
      >
        <UIcon v-if="isComplete(step.key)" name="i-lucide-check" class="text-[10px] drop-shadow-sm" />
        <UIcon v-else-if="isCurrent(step.key)" name="i-lucide-loader-2" class="text-[10px] animate-spin" />
        <span v-else class="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      </div>
      <div class="flex-1 min-w-0 pt-0.5">
        <span
          class="block text-[13px] transition-colors duration-200"
          :class="isComplete(step.key) || isCurrent(step.key) ? 'text-[var(--ui-text-highlighted)] font-medium tracking-tight' : 'text-[var(--ui-text-dimmed)]'"
        >{{ step.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ResearchPhase } from '~/composables/useResearch'

const props = defineProps<{ phase: ResearchPhase }>()

const steps = [
  { key: 'planning' as const, label: 'Plan' },
  { key: 'researching' as const, label: 'Research' },
  { key: 'critiquing' as const, label: 'Critique' },
  { key: 'synthesizing' as const, label: 'Synthesis' },
  { key: 'complete' as const, label: 'Done' },
]

const phaseOrder: ResearchPhase[] = ['idle', 'planning', 'plan-review', 'researching', 'critiquing', 'synthesizing', 'complete']
const phaseIndex = computed(() => phaseOrder.indexOf(props.phase))
const getStepPhaseIndex = (key: string) => key === 'planning' ? phaseOrder.indexOf('planning') : phaseOrder.indexOf(key as ResearchPhase)

const isComplete = (key: string) => {
  const idx = getStepPhaseIndex(key)
  return phaseIndex.value > idx || (key === 'complete' && props.phase === 'complete')
}
const isCurrent = (key: string) => {
  if (key === 'planning' && props.phase === 'planning') return true
  return props.phase === key
}
const getStepClasses = (key: string) => {
  if (isComplete(key)) return 'bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-600/50'
  if (isCurrent(key)) return 'bg-[var(--ui-bg)] text-[var(--ui-primary)] shadow-[0_0_12px_var(--ui-primary)/20] ring-1 ring-[var(--ui-primary)]'
  return 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text-dimmed)] ring-1 ring-inset ring-[var(--ui-border)] shadow-inner'
}
</script>
