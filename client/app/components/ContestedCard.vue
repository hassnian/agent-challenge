<template>
  <div class="p-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)]">
    <p class="text-[13px] font-medium text-[var(--ui-text-highlighted)] mb-2">{{ contested.point }}</p>
    <div class="flex flex-col gap-2">
      <div class="p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
        <p class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">For</p>
        <p class="text-[11px] text-emerald-800 dark:text-emerald-200 leading-relaxed">{{ contested.forArgument }}</p>
      </div>
      <div class="p-2.5 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50">
        <p class="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Against</p>
        <p class="text-[11px] text-red-800 dark:text-red-200 leading-relaxed">{{ contested.againstArgument }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ContestedPoint } from '~/composables/useResearch'
defineProps<{ contested: ContestedPoint }>()
</script>
