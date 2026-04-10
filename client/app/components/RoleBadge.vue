<template>
  <span class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" :class="config.classes">
    {{ config.label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ role: 'planner' | 'searcher' | 'skeptic' | 'synthesizer'; size?: 'xs' | 'sm' }>()

const configs = {
  planner: { label: 'Planner', classes: 'bg-amber-50 text-amber-700' },
  searcher: { label: 'Searcher', classes: 'bg-blue-50 text-blue-700' },
  skeptic: { label: 'Skeptic', classes: 'bg-orange-50 text-orange-700' },
  synthesizer: { label: 'Synthesizer', classes: 'bg-violet-50 text-violet-700' },
}

const config = computed(() => configs[props.role] || configs.planner)
</script>
