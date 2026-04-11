<template>
  <span class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" :class="config.classes">
    {{ config.label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ role: 'planner' | 'searcher' | 'skeptic' | 'synthesizer'; size?: 'xs' | 'sm' }>()

const configs = {
  planner: { label: 'Planner', classes: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' },
  searcher: { label: 'Searcher', classes: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' },
  skeptic: { label: 'Skeptic', classes: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400' },
  synthesizer: { label: 'Synthesizer', classes: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400' },
}

const config = computed(() => configs[props.role] || configs.planner)
</script>
