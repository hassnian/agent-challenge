<template>
  <div class="py-3 border-b border-[var(--ui-border)]/30 last:border-0">
    <p class="text-[13px] font-medium text-[var(--ui-text-highlighted)] mb-3">{{ contested.point }}</p>
    <div class="grid grid-cols-2 gap-3">
      <div class="border-l-2 border-emerald-500/30 pl-3">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-text-dimmed)] mb-1">For</p>
        <p class="text-[12px] text-[var(--ui-text-muted)] leading-relaxed">{{ contested.forArgument }}</p>
      </div>
      <div class="border-l-2 border-red-500/30 pl-3">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-text-dimmed)] mb-1">Against</p>
        <p class="text-[12px] text-[var(--ui-text-muted)] leading-relaxed">{{ contested.againstArgument }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ContestedPoint } from '~/composables/useResearch'
defineProps<{ contested: ContestedPoint }>()
</script>
