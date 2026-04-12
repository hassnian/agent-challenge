<template>
  <div class="py-3 border-b border-[var(--ui-border)]/30 last:border-0">
    <div class="flex items-start justify-between gap-2 mb-1">
      <div class="flex-1 min-w-0">
        <a :href="evidence.url" target="_blank" class="text-[13px] font-medium text-[var(--ui-text-highlighted)] hover:text-[var(--ui-primary)] transition-colors line-clamp-2">
          {{ evidence.title }}
        </a>
        <div class="flex items-center gap-1.5 mt-0.5">
          <p class="text-[11px] text-[var(--ui-text-dimmed)]">{{ evidence.domain }}</p>
          <ConfidenceDot :level="evidence.confidence" />
        </div>
      </div>
    </div>
    <p class="text-[12px] text-[var(--ui-text-muted)] leading-relaxed line-clamp-3">{{ evidence.snippet }}</p>
  </div>
</template>

<script setup lang="ts">
import type { EvidenceCard } from '~/composables/useResearch'
defineProps<{ evidence: EvidenceCard }>()
</script>
