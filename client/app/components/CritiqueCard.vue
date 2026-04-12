<template>
  <div class="py-3 border-b border-[var(--ui-border)]/30 last:border-0">
    <div class="flex items-center gap-2 mb-1.5">
      <span class="text-[10px] font-semibold uppercase tracking-wider" :class="typeTextColor">{{ typeLabel }}</span>
      <span v-if="critique.severity === 'high'" class="text-[10px] font-semibold uppercase tracking-wider text-red-500/80">High</span>
    </div>
    <p class="text-[13px] font-medium text-[var(--ui-text-highlighted)] mb-1.5">"{{ critique.claim }}"</p>
    <p class="text-[12px] text-[var(--ui-text-muted)] leading-relaxed">{{ critique.critique }}</p>
  </div>
</template>

<script setup lang="ts">
import type { CritiqueNote } from '~/composables/useResearch'

const props = defineProps<{ critique: CritiqueNote }>()

const typeConfig: Record<string, { label: string; color: string }> = {
  objection: { label: 'Objection', color: 'text-red-500/70' },
  contradiction: { label: 'Contradiction', color: 'text-amber-500/70' },
  gap: { label: 'Gap', color: 'text-blue-500/70' },
  'weak-support': { label: 'Weak Support', color: 'text-amber-500/70' },
}
const typeLabel = computed(() => typeConfig[props.critique.type]?.label || props.critique.type)
const typeTextColor = computed(() => typeConfig[props.critique.type]?.color || 'text-[var(--ui-text-muted)]')
</script>
