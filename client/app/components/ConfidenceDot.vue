<template>
  <span
    class="w-2 h-2 rounded-full shrink-0"
    :class="dotClass"
    :title="`Confidence: ${level}`"
  />
</template>

<script setup lang="ts">
const props = defineProps<{ level: 'high' | 'medium' | 'low' }>()
const dotClass = computed(() => {
  switch (props.level) {
    case 'high': return 'bg-emerald-400'
    case 'medium': return 'bg-amber-400'
    case 'low': return 'bg-red-400'
    default: return 'bg-[var(--ui-border)]'
  }
})
</script>
