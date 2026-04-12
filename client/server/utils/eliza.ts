import { createError, type H3Event } from 'h3'
import {
  createMessagingSession,
  ensureUserWorld,
  getActiveAgentId,
  getChannelDetails,
  getCurrentMessageServerId,
  getRoomMemories,
  listMessageServerChannels,
  sendChannelMessage,
  sendSessionMessage,
  toElizaErrorMessage,
  updateChannelMetadata,
  type ChannelRecord,
  type MemoryResponse,
} from './eliza-api'
import {
  hasResearchUserWorldForServer,
  markResearchUserWorldReady,
} from './research-user'

type ResearchPlanRecord = {
  question: string
  goal: string
  topics: Array<{
    id: string
    title: string
    searchQueries: string[]
    priority: 'high' | 'medium' | 'low'
  }>
  approved: boolean
}

type StoredResearchSessionRecord = {
  question: string
  completedAt: number
  plan: ResearchPlanRecord
  answer: string
  summary: string
  keyPoints: string[]
  contestedPoints: string[]
  openQuestions: string[]
  evidence: Array<{
    topicId: string
    query: string
    title: string
    domain: string
    url: string
    snippet: string
  }>
  steps: Array<{
    role: 'searcher' | 'skeptic' | 'synthesizer'
    status: 'done'
    text: string
  }>
  debate?: {
    summary: string
    challenges: Array<{
      topicId: string
      claim: string
      concern: string
      severity: 'high' | 'medium' | 'low'
    }>
    missingEvidence: string[]
  }
}

type ResearchRunRecord = {
  taskId: string | null
  question: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  phase: 'queued' | 'searching' | 'challenging' | 'synthesizing' | 'done' | 'failed'
  text: string
  topicCount: number
  evidenceCount: number
  currentTopicIndex: number
  completedTopicCount: number
  createdAt: number
  updatedAt: number
  error?: string
}

type ResearchStateRecord = {
  channelId: string
  userId: string | null
  question: string
  phase: Exclude<UiResearchPhase, 'idle'>
  createdAt: number
  updatedAt: number
  plan: ResearchPlanRecord | null
  run: ResearchRunRecord | null
  session: StoredResearchSessionRecord | null
  progressLog: Array<{
    id: string
    timestamp: number
    role: 'planner' | 'searcher' | 'skeptic' | 'synthesizer'
    message: string
  }>
}

export type UiResearchPhase =
  | 'idle'
  | 'planning'
  | 'plan-review'
  | 'researching'
  | 'critiquing'
  | 'synthesizing'
  | 'complete'

export type UiResearchSession = {
  id: string
  question: string
  phase: UiResearchPhase
  bootstrap: {
    status: 'ready' | 'failed'
    errorMessage: string | null
    canRetry: boolean
  }
  plan: {
    question: string
    topics: Array<{
      id: string
      title: string
      queries: string[]
      status: 'pending' | 'active' | 'done'
    }>
    createdAt: string
  } | null
  evidence: Array<{
    id: string
    topicId: string
    title: string
    domain: string
    snippet: string
    relevance: string
    confidence: 'high' | 'medium' | 'low'
    url: string
  }>
  critiques: Array<{
    id: string
    type: 'objection' | 'contradiction' | 'gap' | 'weak-support'
    claim: string
    critique: string
    severity: 'high' | 'medium' | 'low'
  }>
  contested: Array<{
    id: string
    point: string
    forArgument: string
    againstArgument: string
  }>
  openQuestions: string[]
  summary: string
  finalAnswer: string
  confidenceLevel: number
  createdAt: string
  completedAt: string | null
  progressLog: Array<{
    id: string
    timestamp: string
    role: 'planner' | 'searcher' | 'skeptic' | 'synthesizer'
    message: string
  }>
}

type ResearchBootstrapMetadata = {
  status?: 'ready' | 'failed'
  errorMessage?: string | null
  failedAt?: string
  lastAttemptedAt?: string
}

type ResearchChannelMetadata = {
  agentId?: string
  question?: string
  researchBootstrap?: ResearchBootstrapMetadata
  source?: string
  userId?: string
}

const RESEARCH_CHANNEL_SOURCE = 'research-council-client'
const SESSION_CACHE_TTL_MS = 1_500
const SESSIONS_LIST_CACHE_TTL_MS = 2_000

type CacheEntry<T> = {
  expiresAt: number
  promise: Promise<T> | null
  value: T | null
}

const sessionResponseCache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_BOOTSTRAP_STATE: UiResearchSession['bootstrap'] = {
  status: 'ready',
  errorMessage: null,
  canRetry: false,
}

const normalizeDate = (value: string | number | undefined, fallback: number) => {
  if (typeof value === 'number') {
    return new Date(value).toISOString()
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return new Date(fallback).toISOString()
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toEvidenceConfidence = (domain: string) => {
  if (/(\.gov|\.edu|arxiv\.org|docs\.)/i.test(domain)) {
    return 'high' as const
  }

  if (/(wikipedia|medium|substack)/i.test(domain)) {
    return 'low' as const
  }

  return 'medium' as const
}

const toConfidenceLevel = (session: StoredResearchSessionRecord | null) => {
  if (!session) {
    return 0
  }

  const evidenceScore = Math.min(session.evidence.length * 6, 30)
  const keyPointScore = Math.min(session.keyPoints.length * 4, 20)
  const challengePenalty = Math.min((session.debate?.challenges.length ?? 0) * 5, 25)

  return clamp(55 + evidenceScore + keyPointScore - challengePenalty, 35, 92)
}

const toProgressLog = (
  phase: UiResearchPhase,
  createdAt: string,
  completedAt: string | null,
  session: StoredResearchSessionRecord | null
): UiResearchSession['progressLog'] => {
  if (session) {
    const stepGap = session.steps.length > 0 && completedAt
      ? Math.max(1, Math.floor((new Date(completedAt).getTime() - new Date(createdAt).getTime()) / (session.steps.length + 1)))
      : 60_000

    return session.steps.map((step, index) => ({
      id: `step-${index}`,
      timestamp: new Date(new Date(createdAt).getTime() + (index + 1) * stepGap).toISOString(),
      role: step.role,
      message: step.text,
    }))
  }

  if (phase === 'plan-review') {
    return [
      {
        id: 'plan-ready',
        timestamp: createdAt,
        role: 'planner' as const,
        message: 'Research plan ready for review.',
      },
    ]
  }

  if (phase === 'researching' || phase === 'critiquing' || phase === 'synthesizing') {
    return [
      {
        id: 'research-running',
        timestamp: createdAt,
        role: 'searcher' as const,
        message: 'Research is running in the background on the ElizaOS server.',
      },
    ]
  }

  return [
    {
      id: 'planning',
      timestamp: createdAt,
      role: 'planner',
      message: 'Creating a research plan.',
    },
  ]
}

const getResearchChannelMetadata = (channel: ChannelRecord | null | undefined) => {
  const metadata = channel?.metadata
  return metadata && typeof metadata === 'object'
    ? metadata as ResearchChannelMetadata
    : {}
}

const getBootstrapState = (
  channel: ChannelRecord | null | undefined
): UiResearchSession['bootstrap'] => {
  const bootstrap = getResearchChannelMetadata(channel).researchBootstrap

  if (bootstrap?.status === 'failed') {
    return {
      status: 'failed',
      errorMessage: bootstrap.errorMessage ?? 'Research failed to start on the Eliza server.',
      canRetry: true,
    }
  }

  return DEFAULT_BOOTSTRAP_STATE
}

const buildBootstrapMetadata = (
  status: UiResearchSession['bootstrap']['status'],
  errorMessage: string | null
): ResearchBootstrapMetadata => ({
  status,
  errorMessage,
  lastAttemptedAt: new Date().toISOString(),
  ...(status === 'failed' ? { failedAt: new Date().toISOString() } : {}),
})

const getBootstrapPrompt = (question: string) => `Help me research: ${question}`

const getCachedResponse = async <T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options?: { fresh?: boolean }
): Promise<T> => {
  if (options?.fresh) {
    sessionResponseCache.delete(key)
  }

  const now = Date.now()
  const existing = sessionResponseCache.get(key) as CacheEntry<T> | undefined

  if (existing) {
    if (existing.promise) {
      return existing.promise
    }

    if (existing.value !== null && existing.expiresAt > now) {
      return existing.value
    }
  }

  const promise = loader()
    .then((value) => {
      sessionResponseCache.set(key, {
        expiresAt: Date.now() + ttlMs,
        promise: null,
        value,
      })
      return value
    })
    .catch((error) => {
      sessionResponseCache.delete(key)
      throw error
    })

  sessionResponseCache.set(key, {
    expiresAt: now + ttlMs,
    promise,
    value: existing?.value ?? null,
  })

  return promise
}

const invalidateSessionCache = (userId: string, channelId?: string) => {
  sessionResponseCache.delete(`sessions:${userId}`)

  if (channelId) {
    sessionResponseCache.delete(`session:${userId}:${channelId}`)
  }
}

const runInBackground = (event: H3Event, task: Promise<void>) => {
  const pendingTask = task.catch((error) => {
    console.error('[research] background task failed', { error })
  })

  const backgroundEvent = event as H3Event & {
    waitUntil?: (promise: Promise<void>) => void
  }

  if (typeof backgroundEvent.waitUntil === 'function') {
    backgroundEvent.waitUntil(pendingTask)
    return
  }

  void pendingTask
}

const isResearchChannelForUser = (
  channel: ChannelRecord,
  userId: string,
  agentId: string
) => {
  const metadata = getResearchChannelMetadata(channel)

  return (
    metadata.userId === userId &&
    metadata.agentId === agentId &&
    typeof metadata.question === 'string' &&
    metadata.source === RESEARCH_CHANNEL_SOURCE
  )
}

const buildPersistedResearchChannelMetadata = (
  existingMetadata: Record<string, unknown> | undefined,
  input: {
    agentId: string
    userId: string
    question: string
    bootstrap: ResearchBootstrapMetadata
  }
): Record<string, unknown> => ({
  ...(existingMetadata ?? {}),
  agentId: input.agentId,
  userId: input.userId,
  question: input.question,
  source: RESEARCH_CHANNEL_SOURCE,
  researchBootstrap: input.bootstrap,
})

const syncResearchChannelMetadata = async (
  event: H3Event,
  input: {
    channelId: string
    agentId: string
    userId: string
    question: string
    bootstrap: ResearchBootstrapMetadata
  }
) => {
  const channel = await getChannelDetails(event, input.channelId)

  await updateChannelMetadata(
    event,
    input.channelId,
    buildPersistedResearchChannelMetadata(channel?.metadata, input)
  )
}

const buildBootstrapFailedUiSession = (
  channelId: string,
  question: string,
  createdAtValue: string | number | undefined,
  errorMessage: string
): UiResearchSession => {
  const createdAt = normalizeDate(createdAtValue, Date.now())

  return {
    id: channelId,
    question,
    phase: 'planning',
    bootstrap: {
      status: 'failed',
      errorMessage,
      canRetry: true,
    },
    plan: null,
    evidence: [],
    critiques: [],
    contested: [],
    openQuestions: [],
    summary: '',
    finalAnswer: '',
    confidenceLevel: 0,
    createdAt,
    completedAt: null,
    progressLog: [
      {
        id: 'bootstrap-failed',
        timestamp: createdAt,
        role: 'planner',
        message: errorMessage,
      },
    ],
  }
}

const getLatestMemoryMetadata = async <T>(
  event: H3Event,
  agentId: string,
  channelId: string,
  tableName: string,
  key: string
): Promise<T | null> => {
  let response: MemoryResponse<Record<string, T>>

  try {
    response = await getRoomMemories<Record<string, T>>(
      event,
      agentId,
      channelId,
      {
        tableName,
        limit: 1,
      }
    )
  } catch (error) {
    const statusCode = (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
    )
      ? error.statusCode
      : (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof error.status === 'number'
      )
        ? error.status
        : null

    if (statusCode === 404) {
      return null
    }

    throw error
  }

  const memory = response.data?.memories?.at(0)
  const metadata = memory?.content?.metadata
  if (!metadata || typeof metadata !== 'object' || !(key in metadata)) {
    return null
  }

  return metadata[key] ?? null
}

const getLatestResearchState = async (
  event: H3Event,
  agentId: string,
  channelId: string
) => {
  return getLatestMemoryMetadata<ResearchStateRecord>(event, agentId, channelId, 'research_state', 'state')
}

const listIndexedResearchStates = async (
  event: H3Event,
  agentId: string,
  userId: string
) => {
  let response: MemoryResponse<{ state?: ResearchStateRecord }>

  try {
    response = await getRoomMemories<{ state?: ResearchStateRecord }>(
      event,
      agentId,
      userId,
      {
        tableName: 'research_state_index',
        limit: 100,
      }
    )
  } catch (error) {
    const statusCode = (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
    )
      ? error.statusCode
      : (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof error.status === 'number'
      )
        ? error.status
        : null

    if (statusCode === 404) {
      return [] as ResearchStateRecord[]
    }

    throw error
  }

  const latestByChannelId = new Map<string, ResearchStateRecord>()

  for (const memory of response.data?.memories ?? []) {
    const state = memory.content?.metadata?.state
    if (!state?.channelId) {
      continue
    }

    const existing = latestByChannelId.get(state.channelId)
    if (!existing || state.updatedAt > existing.updatedAt) {
      latestByChannelId.set(state.channelId, state)
    }
  }

  return [...latestByChannelId.values()]
}

const getIndexedResearchStateForChannel = async (
  event: H3Event,
  agentId: string,
  userId: string,
  channelId: string
) => {
  const indexedStates = await listIndexedResearchStates(event, agentId, userId)
  return indexedStates.find((state) => state.channelId === channelId) ?? null
}

const toUiSessionFromState = (
  state: ResearchStateRecord
): UiResearchSession => {
  const session = state.session
  const phase = state.phase
  const createdAt = normalizeDate(state.createdAt, Date.now())
  const completedAt = session ? new Date(session.completedAt).toISOString() : null

  const planTopics = (session?.plan.topics ?? state.plan?.topics ?? []).map((topic, index) => {
    const topicIndex = index
    const completedCount = state.run?.completedTopicCount ?? 0
    const currentIndex = state.run?.currentTopicIndex ?? 0
    const isResearching = phase === 'researching' || phase === 'critiquing' || phase === 'synthesizing'

    let status: 'pending' | 'active' | 'done' = 'pending'
    if (phase === 'complete') {
      status = 'done'
    } else if (isResearching) {
      if (topicIndex < completedCount) {
        status = 'done'
      } else if (topicIndex === currentIndex && phase === 'researching') {
        status = 'active'
      }
    }

    return {
      id: topic.id,
      title: topic.title,
      queries: topic.searchQueries,
      status,
    }
  })

  const evidence = (session?.evidence ?? []).map((item, index) => ({
    id: `evidence-${index}`,
    topicId: item.topicId,
    title: item.title,
    domain: item.domain,
    snippet: item.snippet,
    relevance: item.query ? `Captured from query: ${item.query}` : 'Captured as supporting evidence for this topic.',
    confidence: toEvidenceConfidence(item.domain),
    url: item.url,
  }))

  const critiquesFromChallenges = (session?.debate?.challenges ?? []).map((challenge, index) => ({
    id: `challenge-${index}`,
    type: 'objection' as const,
    claim: challenge.claim,
    critique: challenge.concern,
    severity: challenge.severity,
  }))

  const critiquesFromMissingEvidence = (session?.debate?.missingEvidence ?? []).map((item, index) => ({
    id: `gap-${index}`,
    type: 'gap' as const,
    claim: 'Missing evidence',
    critique: item,
    severity: 'medium' as const,
  }))

  const contested = (session?.contestedPoints ?? []).map((point, index) => ({
    id: `contested-${index}`,
    point,
    forArgument: session?.keyPoints.at(0) ?? 'The final memo includes supporting evidence for this position.',
    againstArgument: session?.debate?.summary ?? 'The skeptic review highlights unresolved objections and uncertainty.',
  }))

  const progressLog = state.progressLog.length > 0
    ? state.progressLog.map((entry) => ({
      id: entry.id,
      timestamp: new Date(entry.timestamp).toISOString(),
      role: entry.role,
      message: entry.message,
    }))
    : toProgressLog(phase, createdAt, completedAt, session)

  return {
    id: state.channelId,
    question: session?.question ?? state.plan?.question ?? state.question,
    phase,
    bootstrap: DEFAULT_BOOTSTRAP_STATE,
    plan: planTopics.length > 0
      ? {
        question: session?.question ?? state.plan?.question ?? state.question,
        topics: planTopics,
        createdAt,
      }
      : null,
    evidence,
    critiques: [...critiquesFromChallenges, ...critiquesFromMissingEvidence],
    contested,
    openQuestions: session?.openQuestions ?? [],
    summary: session?.summary ?? '',
    finalAnswer: session?.answer ?? '',
    confidenceLevel: toConfidenceLevel(session),
    createdAt,
    completedAt,
    progressLog,
  }
}

const toPlanningUiSession = (
  channel: ChannelRecord
): UiResearchSession => {
  const createdAt = normalizeDate(channel.createdAt, Date.now())
  const metadata = getResearchChannelMetadata(channel)
  const bootstrap = getBootstrapState(channel)
  const question = typeof metadata.question === 'string'
    ? metadata.question
    : 'Untitled research session'

  return {
    id: channel.id,
    question,
    phase: 'planning',
    bootstrap,
    plan: null,
    evidence: [],
    critiques: [],
    contested: [],
    openQuestions: [],
    summary: '',
    finalAnswer: '',
    confidenceLevel: 0,
    createdAt,
    completedAt: null,
    progressLog: bootstrap.status === 'failed'
      ? [
        {
          id: 'bootstrap-failed',
          timestamp: createdAt,
          role: 'planner',
          message: bootstrap.errorMessage ?? 'Research failed to start on the Eliza server.',
        },
      ]
      : toProgressLog('planning', createdAt, null, null),
  }
}

export const buildPendingUiSession = (
  channelId: string,
  question: string,
  createdAtValue: string | number | undefined
): UiResearchSession => {
  const createdAt = normalizeDate(createdAtValue, Date.now())

  return {
    id: channelId,
    question,
    phase: 'planning',
    bootstrap: DEFAULT_BOOTSTRAP_STATE,
    plan: null,
    evidence: [],
    critiques: [],
    contested: [],
    openQuestions: [],
    summary: '',
    finalAnswer: '',
    confidenceLevel: 0,
    createdAt,
    completedAt: null,
    progressLog: toProgressLog('planning', createdAt, null, null),
  }
}

export const getAgentId = async (event: H3Event) => {
  return getActiveAgentId(event)
}

export const createResearchSession = async (
  event: H3Event,
  userId: string,
  question: string
) => {
  const agentId = await getActiveAgentId(event)
  const messageServerId = await getCurrentMessageServerId(event)

  // The bootstrap plugin's onboarding path looks for a user-owned world that is attached
  // to the current message server. Cache the success per browser user to avoid leaking
  // duplicate worlds on every research start.
  if (!hasResearchUserWorldForServer(event, messageServerId)) {
    await ensureUserWorld(event, agentId, userId, messageServerId)
    markResearchUserWorldReady(event, messageServerId)
  }

  const session = await createMessagingSession(event, {
    agentId,
    userId,
    metadata: {
      question,
      source: RESEARCH_CHANNEL_SOURCE,
    },
  })

  try {
    await syncResearchChannelMetadata(event, {
      channelId: session.channelId,
      agentId,
      userId,
      question,
      bootstrap: buildBootstrapMetadata('ready', null),
    })
  } catch (syncError) {
    console.error('[research] failed to persist bootstrap ready state', {
      channelId: session.channelId,
      error: syncError,
    })
  }

  runInBackground(event, (async () => {
    try {
      await sendSessionMessage(event, session.sessionId, {
        content: getBootstrapPrompt(question),
        metadata: {
          source: RESEARCH_CHANNEL_SOURCE,
        },
      })
    } catch (error) {
      const errorMessage = toElizaErrorMessage(
        error,
        'Research failed to start on the Eliza server. Retry to send the first message again.'
      )

      try {
        await syncResearchChannelMetadata(event, {
          channelId: session.channelId,
          agentId,
          userId,
          question,
          bootstrap: buildBootstrapMetadata('failed', errorMessage),
        })
      } catch (syncError) {
        console.error('[research] failed to persist bootstrap failure state', {
          channelId: session.channelId,
          error: syncError,
        })
      }
    }
  })())

  invalidateSessionCache(userId, session.channelId)

  return buildPendingUiSession(session.channelId, question, session.createdAt)
}

export const approveChannelPlan = async (
  event: H3Event,
  channelId: string,
  userId: string
) => {
  const channel = await getChannelDetails(event, channelId)
  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: 'Research session not found.' })
  }

  const messageServerId = channel.messageServerId ?? await getCurrentMessageServerId(event)

  await sendChannelMessage(event, {
    channelId,
    authorId: userId,
    messageServerId,
    content: 'Approve this research plan.',
    metadata: {
      source: RESEARCH_CHANNEL_SOURCE,
    },
  })

  invalidateSessionCache(userId, channelId)
}

export const retryResearchBootstrap = async (
  event: H3Event,
  userId: string,
  channelId: string
) => {
  const channel = await getChannelDetails(event, channelId)

  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: 'Research session not found.' })
  }

  const metadata = getResearchChannelMetadata(channel)
  const agentId = typeof metadata.agentId === 'string'
    ? metadata.agentId
    : await getActiveAgentId(event)
  const question = typeof metadata.question === 'string' ? metadata.question : null

  if (!question) {
    throw createError({ statusCode: 409, statusMessage: 'Research question is missing for this session.' })
  }

  const messageServerId = channel.messageServerId ?? await getCurrentMessageServerId(event)

  try {
    await sendChannelMessage(event, {
      channelId,
      authorId: userId,
      messageServerId,
      content: getBootstrapPrompt(question),
      metadata: {
        source: RESEARCH_CHANNEL_SOURCE,
      },
    })

    try {
      await syncResearchChannelMetadata(event, {
        channelId,
        agentId,
        userId,
        question,
        bootstrap: buildBootstrapMetadata('ready', null),
      })
    } catch (syncError) {
      console.error('[research] failed to persist bootstrap ready state after retry', {
        channelId,
        error: syncError,
      })
    }

    invalidateSessionCache(userId, channelId)
    return buildPendingUiSession(channelId, question, channel.createdAt)
  } catch (error) {
    const errorMessage = toElizaErrorMessage(
      error,
      'Research failed to start on the Eliza server. Retry to send the first message again.'
    )

    try {
      await syncResearchChannelMetadata(event, {
        channelId,
        agentId,
        userId,
        question,
        bootstrap: buildBootstrapMetadata('failed', errorMessage),
      })
    } catch (syncError) {
      console.error('[research] failed to persist bootstrap failure state after retry', {
        channelId,
        error: syncError,
      })
    }

    invalidateSessionCache(userId, channelId)
    return buildBootstrapFailedUiSession(
      channelId,
      question,
      channel.createdAt,
      errorMessage
    )
  }
}

export const listUserResearchSessions = async (
  event: H3Event,
  userId: string,
  options?: { fresh?: boolean }
) => {
  return getCachedResponse(`sessions:${userId}`, SESSIONS_LIST_CACHE_TTL_MS, async () => {
    const agentId = await getAgentId(event)
    const messageServerId = await getCurrentMessageServerId(event)
    const [indexedStates, channels] = await Promise.all([
      listIndexedResearchStates(event, agentId, userId),
      listMessageServerChannels(event, messageServerId),
    ])

    const sessionsByChannelId = new Map(
      indexedStates
        .filter((state) => !state.userId || state.userId === userId)
        .map((state) => [
          state.channelId,
          toUiSessionFromState(state),
        ])
    )

    for (const channel of channels) {
      if (!channel?.id || sessionsByChannelId.has(channel.id)) {
        continue
      }

      if (isResearchChannelForUser(channel, userId, agentId)) {
        sessionsByChannelId.set(channel.id, toPlanningUiSession(channel))
      }
    }

    const sessions = [...sessionsByChannelId.values()]

    sessions.sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime())

    return {
      agentId,
      sessions,
    }
  }, options)
}

export const getUserResearchSession = async (
  event: H3Event,
  userId: string,
  channelId: string,
  options?: { fresh?: boolean }
) => {
  return getCachedResponse(`session:${userId}:${channelId}`, SESSION_CACHE_TTL_MS, async () => {
    const agentId = await getAgentId(event)
    const indexedState = await getIndexedResearchStateForChannel(
      event,
      agentId,
      userId,
      channelId
    )

    if (indexedState) {
      return {
        agentId,
        session: toUiSessionFromState(indexedState),
      }
    }

    const state = await getLatestResearchState(event, agentId, channelId)

    if (state && (!state.userId || state.userId === userId)) {
      return {
        agentId,
        session: toUiSessionFromState(state),
      }
    }

    const channel = await getChannelDetails(event, channelId)

    if (!channel) {
      return {
        agentId,
        session: null,
      }
    }

    if (!isResearchChannelForUser(channel, userId, agentId)) {
      return {
        agentId,
        session: null,
      }
    }

    return {
      agentId,
      session: toPlanningUiSession(channel),
    }
  }, options)
}
