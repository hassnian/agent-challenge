<template>
  <div class="p-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)]">
    <div class="flex items-center gap-2 mb-1.5">
      <UBadge :label="typeLabel" size="xs" :color="typeColor" variant="subtle" />
      <UBadge v-if="critique.severity === 'high'" label="High" size="xs" color="error" variant="subtle" />
    </div>
    <p class="text-[13px] font-medium text-[var(--ui-text-highlighted)] mb-1.5">"{{ critique.claim }}"</p>
    <p class="text-[12px] text-[var(--ui-text-muted)] leading-relaxed">{{ critique.critique }}</p>
  </div>
</template>

<script setup lang="ts">
import type { CritiqueNote } from '~/composables/useResearch'

type BadgeColor = 'error' | 'warning' | 'info' | 'neutral'

const props = defineProps<{ critique: CritiqueNote }>()

const typeConfig: Record<string, { label: string; color: BadgeColor }> = {
  objection: { label: 'Objection', color: 'error' },
  contradiction: { label: 'Contradiction', color: 'warning' },
  gap: { label: 'Gap', color: 'info' },
  'weak-support': { label: 'Weak Support', color: 'warning' },
}
const typeLabel = computed(() => typeConfig[props.critique.type]?.label || props.critique.type)
const typeColor = computed(() => typeConfig[props.critique.type]?.color || 'neutral')
</script>
