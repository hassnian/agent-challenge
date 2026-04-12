<template>
  <span class="inline-flex items-center text-[10px] font-medium tracking-wide" :class="config.classes">
    {{ config.label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ role: 'planner' | 'searcher' | 'skeptic' | 'synthesizer'; size?: 'xs' | 'sm' }>()

const configs = {
  planner: { label: 'Planner', classes: 'text-amber-500/70 dark:text-amber-400/70' },
  searcher: { label: 'Searcher', classes: 'text-blue-500/70 dark:text-blue-400/70' },
  skeptic: { label: 'Skeptic', classes: 'text-orange-500/70 dark:text-orange-400/70' },
  synthesizer: { label: 'Synthesizer', classes: 'text-violet-500/70 dark:text-violet-400/70' },
}

const config = computed(() => configs[props.role] || configs.planner)
</script>
