<template>
  <div class="space-y-0">
    <!-- Header -->
    <section class="pb-6 border-b border-[var(--ui-border)]/40">
      <h2 class="text-3xl font-serif font-normal tracking-tight text-[var(--ui-text-highlighted)] leading-tight mb-3">{{ session.question }}</h2>
      <p class="text-sm text-[var(--ui-text-muted)]">
        Completed {{ formatDate(session.completedAt!) }} · {{ duration }} · {{ session.evidence.length }} sources · {{ session.critiques.length }} objections
      </p>
    </section>

    <!-- Confidence + Stats -->
    <section class="py-8 border-b border-[var(--ui-border)]/40">
      <div class="flex items-baseline gap-8 flex-wrap">
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-serif font-light tracking-tight" :class="confidenceColor">{{ session.confidenceLevel }}%</span>
          <span class="text-sm text-[var(--ui-text-dimmed)]">confidence</span>
        </div>
        <div class="flex gap-8">
          <div v-for="stat in snapshotStats" :key="stat.label">
            <p class="text-2xl font-serif font-light text-[var(--ui-text-highlighted)]">{{ stat.value }}</p>
            <p class="text-[11px] text-[var(--ui-text-dimmed)] mt-0.5">{{ stat.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Executive Summary -->
    <section class="py-8 border-b border-[var(--ui-border)]/40">
      <h3 class="text-lg font-serif font-normal text-[var(--ui-text-highlighted)] mb-4">Executive Summary</h3>
      <p class="text-[15px] text-[var(--ui-text)] leading-[1.75] whitespace-pre-line">{{ session.summary }}</p>
    </section>

    <!-- Final Recommendation -->
    <section class="py-8 border-b border-[var(--ui-border)]/40">
      <div class="pl-5 border-l-2 border-[var(--ui-primary)]/30">
        <h3 class="text-lg font-serif font-normal text-[var(--ui-text-highlighted)] mb-4">Final Recommendation</h3>
        <div class="text-[15px] text-[var(--ui-text)] leading-[1.75] whitespace-pre-line">{{ session.finalAnswer }}</div>
      </div>
    </section>

    <!-- Open Questions -->
    <section v-if="session.openQuestions.length" class="py-8 border-b border-[var(--ui-border)]/40">
      <h3 class="text-lg font-serif font-normal text-[var(--ui-text-highlighted)] mb-4">Open Questions</h3>
      <ul class="space-y-2.5">
        <li v-for="(question, index) in session.openQuestions" :key="index" class="flex items-start gap-3 text-[15px] text-[var(--ui-text)]">
          <span class="text-[var(--ui-text-dimmed)]/40 shrink-0 select-none">—</span>
          <span class="leading-relaxed">{{ question }}</span>
        </li>
      </ul>
    </section>

    <!-- Research Timeline -->
    <section v-if="majorProgressEntries.length" class="py-8 border-b border-[var(--ui-border)]/40">
      <h3 class="text-lg font-serif font-normal text-[var(--ui-text-highlighted)] mb-1">How Research Progressed</h3>
      <p class="text-[13px] text-[var(--ui-text-dimmed)] mb-6">Key milestones from the research process.</p>

      <div class="space-y-0">
        <div
          v-for="entry in majorProgressEntries"
          :key="entry.id"
          class="flex items-start gap-4 py-3 border-b border-[var(--ui-border)]/20 last:border-0"
        >
          <span class="text-[11px] font-medium text-[var(--ui-text-dimmed)] shrink-0 w-16 mt-0.5">{{ formatLogTime(entry.timestamp) }}</span>
          <RoleBadge :role="entry.role" size="xs" class="shrink-0 mt-0.5" />
          <p class="text-[13px] leading-relaxed text-[var(--ui-text)]">{{ entry.message }}</p>
        </div>
      </div>
    </section>

    <!-- Actions -->
    <div class="flex items-center gap-2 pt-8">
      <UButton
        :label="isExporting ? 'Exporting…' : 'Export Memo'"
        icon="i-lucide-download"
        variant="outline"
        color="neutral"
        size="sm"
        :loading="isExporting"
        :disabled="isExporting"
        @click="exportMemo"
      />
      <UButton label="Follow Up" icon="i-lucide-message-circle" variant="ghost" color="neutral" size="sm" :disabled="true" />
      <UButton label="New Research" icon="i-lucide-plus" variant="ghost" color="neutral" size="sm" to="/" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ResearchSession } from '~/composables/useResearch'

const props = defineProps<{ session: ResearchSession }>()
const isExporting = ref(false)

const confidenceColor = computed(() => {
  const c = props.session.confidenceLevel
  return c >= 70 ? 'text-emerald-500' : c >= 50 ? 'text-amber-500' : 'text-red-500'
})

const duration = computed(() => {
  if (!props.session.completedAt) return '–'
  const mins = Math.round((new Date(props.session.completedAt).getTime() - new Date(props.session.createdAt).getTime()) / 60000)
  return mins < 1 ? '<1 min' : `${mins} min`
})

const snapshotStats = computed(() => ([
  { label: 'Topics', value: props.session.plan?.topics.length ?? 0 },
  { label: 'Sources', value: props.session.evidence.length },
  { label: 'Objections', value: props.session.critiques.length },
  { label: 'Open', value: props.session.openQuestions.length },
]))

const majorProgressEntries = computed(() => {
  return props.session.progressLog
    .filter((entry) => /ready|approved|starting|investigating|collected|challenging|combining|completed/i.test(entry.message))
    .slice(-6)
    .reverse()
})

const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const logTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const formatLogTime = (date: string) => logTimeFormatter.format(new Date(date))

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'memo'

const sanitizeFilePart = (value: string) => value
  .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const toMarkdownList = (items: string[]) => (
  items.length > 0
    ? items.map(item => `- ${item}`).join('\n')
    : '_None._'
)

const addSectionReadme = (
  folder: { file: (name: string, data: string) => unknown } | null | undefined,
  title: string,
  body: string
) => {
  folder?.file('README.md', `# ${title}\n\n${body.trim()}\n`)
}

const exportMemo = async () => {
  if (!import.meta.client || isExporting.value) {
    return
  }

  isExporting.value = true

  try {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const rootName = `${slugify(props.session.question)}-memo`
    const root = zip.folder(rootName)

    if (!root) {
      throw new Error('Failed to create zip root folder.')
    }

    const completedLabel = props.session.completedAt
      ? formatDate(props.session.completedAt)
      : 'Not completed'

    root.file('README.md', [
      `# ${props.session.question}`,
      '',
      `- Completed: ${completedLabel}`,
      `- Confidence: ${props.session.confidenceLevel}%`,
      `- Topics: ${props.session.plan?.topics.length ?? 0}`,
      `- Sources: ${props.session.evidence.length}`,
      `- Objections: ${props.session.critiques.length}`,
      `- Open questions: ${props.session.openQuestions.length}`,
      '',
      '## Contents',
      '',
      '- `memo/executive-summary.md`',
      '- `memo/final-recommendation.md`',
      '- `plan/`',
      '- `evidence/`',
      '- `critiques/`',
      '- `contested/`',
      '- `process/`',
    ].join('\n'))

    const memoFolder = root.folder('memo')
    memoFolder?.file('executive-summary.md', `# Executive Summary\n\n${props.session.summary || '_No summary available._'}\n`)
    memoFolder?.file('final-recommendation.md', `# Final Recommendation\n\n${props.session.finalAnswer || '_No final recommendation available._'}\n`)

    const planFolder = root.folder('plan')
    addSectionReadme(
      planFolder,
      'Plan',
      props.session.plan
        ? `Original research question: **${props.session.plan.question}**`
        : 'No plan was captured for this memo.'
    )

    for (const [index, topic] of (props.session.plan?.topics ?? []).entries()) {
      const filename = `${String(index + 1).padStart(2, '0')}-${slugify(topic.title)}.md`
      planFolder?.file(filename, [
        `# ${topic.title}`,
        '',
        `- Status: ${topic.status}`,
        '',
        '## Queries',
        '',
        toMarkdownList(topic.queries),
      ].join('\n'))
    }

    const evidenceFolder = root.folder('evidence')
    addSectionReadme(
      evidenceFolder,
      'Evidence',
      props.session.evidence.length > 0
        ? `Captured ${props.session.evidence.length} evidence item(s).`
        : 'No evidence items were captured.'
    )

    for (const [index, evidence] of props.session.evidence.entries()) {
      const filename = `${String(index + 1).padStart(2, '0')}-${slugify(evidence.title)}.md`
      evidenceFolder?.file(filename, [
        `# ${evidence.title}`,
        '',
        `- Topic ID: ${evidence.topicId}`,
        `- Domain: ${evidence.domain}`,
        `- Confidence: ${evidence.confidence}`,
        `- URL: ${evidence.url}`,
        '',
        '## Relevance',
        '',
        evidence.relevance,
        '',
        '## Snippet',
        '',
        evidence.snippet || '_No snippet available._',
      ].join('\n'))
    }

    const critiquesFolder = root.folder('critiques')
    addSectionReadme(
      critiquesFolder,
      'Critiques',
      props.session.critiques.length > 0
        ? `Captured ${props.session.critiques.length} critique item(s).`
        : 'No critique items were captured.'
    )

    for (const [index, critique] of props.session.critiques.entries()) {
      const filename = `${String(index + 1).padStart(2, '0')}-${slugify(critique.claim || critique.type)}.md`
      const critiqueTitle = critique.claim || critique.type || `Critique ${index + 1}`
      critiquesFolder?.file(filename, [
        `# ${critiqueTitle}`,
        '',
        `- Type: ${critique.type}`,
        `- Severity: ${critique.severity}`,
        '',
        '## Critique',
        '',
        critique.critique,
      ].join('\n'))
    }

    const contestedFolder = root.folder('contested')
    addSectionReadme(
      contestedFolder,
      'Contested Points',
      props.session.contested.length > 0
        ? `Captured ${props.session.contested.length} contested point(s).`
        : 'No contested points were captured.'
    )

    for (const [index, item] of props.session.contested.entries()) {
      const filename = `${String(index + 1).padStart(2, '0')}-${slugify(item.point)}.md`
      contestedFolder?.file(filename, [
        `# ${item.point}`,
        '',
        '## Supporting Argument',
        '',
        item.forArgument,
        '',
        '## Counter Argument',
        '',
        item.againstArgument,
      ].join('\n'))
    }

    const processFolder = root.folder('process')
    processFolder?.file('open-questions.md', `# Open Questions\n\n${toMarkdownList(props.session.openQuestions)}\n`)
    processFolder?.file('timeline.md', [
      '# Research Timeline',
      '',
      ...(props.session.progressLog.length > 0
        ? props.session.progressLog.map(entry => [
          `## ${entry.message}`,
          '',
          `- Role: ${entry.role}`,
          `- Time: ${new Date(entry.timestamp).toISOString()}`,
          '',
        ].join('\n'))
        : ['_No timeline entries available._']),
    ].join('\n'))

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${sanitizeFilePart(rootName)}.zip`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export memo zip', error)
    window.alert('Failed to export memo.')
  } finally {
    isExporting.value = false
  }
}
</script>
