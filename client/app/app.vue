<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>

<script setup lang="ts">
useHead({
  title: 'Research Council — Personal Decision Research',
  meta: [
    { name: 'description', content: 'Turn hard questions into evidence-backed decision memos. A personal research council powered by AI.' },
  ],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' },
  ],
})
</script>