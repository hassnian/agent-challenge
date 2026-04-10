<template>
  <div class="p-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] hover:shadow-sm transition-shadow">
    <div class="flex items-start justify-between gap-2 mb-1.5">
      <div class="flex-1 min-w-0">
        <a :href="evidence.url" target="_blank" class="text-[13px] font-medium text-[var(--ui-text-highlighted)] hover:text-[var(--ui-primary)] transition-colors line-clamp-2">
          {{ evidence.title }}
        </a>
        <p class="text-[11px] text-[var(--ui-text-dimmed)] mt-0.5">{{ evidence.domain }}</p>
      </div>
      <ConfidenceDot :level="evidence.confidence" />
    </div>
    <p class="text-[12px] text-[var(--ui-text-muted)] leading-relaxed line-clamp-3 mb-2">{{ evidence.snippet }}</p>
    <p class="text-[11px] text-[var(--ui-text-dimmed)] leading-relaxed italic">{{ evidence.relevance }}</p>
  </div>
</template>

<script setup lang="ts">
import type { EvidenceCard } from '~/composables/useResearch'
defineProps<{ evidence: EvidenceCard }>()
</script>
