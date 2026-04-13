<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
useHead({
  title: 'Synapse — Personal Research Agent',
  meta: [
    { name: 'description', content: 'Turn hard questions into evidence-backed decision memos with Synapse, a personal research agent powered by AI.' },
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/branding/synapse_logo.svg' },
    { rel: 'shortcut icon', href: '/branding/synapse_logo.svg' },
    { rel: 'apple-touch-icon', href: '/branding/synapse_logo.svg' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,300;400;600;700&display=swap' },
  ],
})
</script>
