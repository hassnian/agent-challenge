<template>
  <div class="flex min-h-screen flex-col bg-[var(--ui-bg)]">
    <header class="border-b border-[var(--ui-border)]/50 bg-[var(--ui-bg)]/90 backdrop-blur-sm">
      <div class="mx-auto flex w-full max-w-6xl items-center px-4 py-4 sm:px-6">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2.5">
          <span class="h-0.5 w-4 rounded-full bg-[var(--ui-primary)]" />
          <div class="min-w-0">
            <h1 class="truncate text-[14px] font-semibold text-[var(--ui-text-highlighted)]">Synapse</h1>
            <p class="truncate text-[11px] leading-tight text-[var(--ui-text-dimmed)]">Personal Research Agent</p>
          </div>
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
