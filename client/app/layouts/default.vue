<template>
  <div class="flex min-h-screen flex-col bg-[var(--ui-bg)]">
    <header class="border-b border-[var(--ui-border)]/50 bg-[var(--ui-bg)]/90 backdrop-blur-sm">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-4 sm:px-6">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90" aria-label="Synapse home">
          <img
            src="/branding/synapse_logo.svg"
            alt="Synapse"
            class="h-10 w-auto"
          >
        </NuxtLink>
      </div>
    </header>

    <main class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--ui-bg)]">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { refreshSessions } = useResearch()

await useAsyncData('research-bootstrap', async () => {
  await refreshSessions({ silent: true })
  return true
})
</script>
