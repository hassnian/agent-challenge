import { createError, type H3Event } from 'h3'

type AgentRecord = {
  id: string
  name?: string
  status?: string
}

type ChannelRecord = {
  id: string
  name?: string
  createdAt?: string | number
  metadata?: Record<string, unknown>
}

type ActiveSessionRecord = {
  sessionId: string
  channelId: string
  agentId: string
  userId: string
  createdAt?: string | number
  metadata?: Record<string, unknown>
}

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
  sessionId: string | null
}

type MemoryResponse<T> = {
  success: boolean
  data?: {
    memories?: Array<{
      id?: string
      createdAt?: number
      content?: {
        metadata?: T
      }
    }>
  }
}

const DEFAULT_ELIZA_SERVER_URL = 'http://127.0.0.1:3000'

const getBaseUrl = (event: H3Event) => {
  const config = useRuntimeConfig(event)
  const value = typeof config.elizaServerUrl === 'string' && config.elizaServerUrl.length > 0
    ? config.elizaServerUrl
    : DEFAULT_ELIZA_SERVER_URL

  return value.replace(/\/$/, '')
}

const elizaFetch = <T>(event: H3Event, path: string, options?: Parameters<typeof $fetch<T>>[1]) => {
  return $fetch<T>(`${getBaseUrl(event)}${path}`, options)
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
      role: 'planner' as const,
      message: 'Creating a research plan.',
    },
  ]
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
    response = await elizaFetch<MemoryResponse<Record<string, T>>>(
      event,
      `/api/memory/${agentId}/rooms/${channelId}/memories`,
      {
        query: {
          tableName,
          limit: 1,
        },
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
    response = await elizaFetch<MemoryResponse<{ state?: ResearchStateRecord }>>(
      event,
      `/api/memory/${agentId}/rooms/${userId}/memories`,
      {
        query: {
          tableName: 'research_state_index',
          limit: 100,
        },
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

const getChannelDetails = async (
  event: H3Event,
  channelId: string
): Promise<ChannelRecord | null> => {
  try {
    const response = await elizaFetch<{ success: boolean; data?: ChannelRecord }>(
      event,
      `/api/messaging/channels/${channelId}/details`
    )

    return response.data ?? null
  } catch {
    return null
  }
}

const getActiveSessions = async (event: H3Event, userId: string, agentId?: string) => {
  const response = await elizaFetch<{ sessions?: ActiveSessionRecord[] }>(event, '/api/messaging/sessions')

  return (response.sessions ?? []).filter((item) => (
    item.userId === userId && (!agentId || item.agentId === agentId)
  ))
}

const toUiSessionFromState = (
  state: ResearchStateRecord,
  activeSession: ActiveSessionRecord | null
): UiResearchSession => {
  const session = state.session
  const phase = state.phase
  const createdAt = normalizeDate(state.createdAt, Date.now())
  const completedAt = session ? new Date(session.completedAt).toISOString() : null

  const planTopics = (session?.plan.topics ?? state.plan?.topics ?? []).map((topic) => ({
    id: topic.id,
    title: topic.title,
    queries: topic.searchQueries,
    status: phase === 'complete'
      ? 'done' as const
      : phase === 'researching' || phase === 'critiquing' || phase === 'synthesizing'
        ? 'active' as const
        : 'pending' as const,
  }))

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
    sessionId: activeSession?.sessionId ?? null,
  }
}

const toPlanningUiSession = (
  channel: ChannelRecord,
  activeSession: ActiveSessionRecord | null
): UiResearchSession => {
  const createdAt = normalizeDate(channel.createdAt ?? activeSession?.createdAt, Date.now())
  const question = typeof channel.metadata?.question === 'string'
    ? channel.metadata.question
    : 'Untitled research session'

  return {
    id: channel.id,
    question,
    phase: 'planning',
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
    sessionId: activeSession?.sessionId ?? null,
  }
}

export const buildPendingUiSession = (
  channelId: string,
  question: string,
  activeSession: ActiveSessionRecord | null
): UiResearchSession => {
  const createdAt = normalizeDate(activeSession?.createdAt, Date.now())

  return {
    id: channelId,
    question,
    phase: 'planning',
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
    sessionId: activeSession?.sessionId ?? null,
  }
}

export const getAgentId = async (event: H3Event) => {
  const response = await elizaFetch<{ success: boolean; data?: { agents?: AgentRecord[] } }>(event, '/api/agents')
  const agents = response.data?.agents ?? []
  const agent = agents.find((item) => item.status === 'active') ?? agents.at(0)

  if (!agent?.id) {
    throw createError({ statusCode: 503, statusMessage: 'No Eliza agent is available.' })
  }

  return agent.id
}

export const createChannelSession = async (
  event: H3Event,
  agentId: string,
  userId: string,
  question: string
) => {
  const session = await elizaFetch<ActiveSessionRecord>(event, '/api/messaging/sessions', {
    method: 'POST',
    body: {
      agentId,
      userId,
      metadata: {
        question,
        source: 'research-council-client',
      },
    },
  })

  const baseUrl = getBaseUrl(event)

  void $fetch(`${baseUrl}/api/messaging/sessions/${session.sessionId}/messages`, {
    method: 'POST',
    body: {
      content: `Help me research: ${question}`,
      transport: 'http',
    },
  }).catch((error) => {
    console.error('[research] failed to dispatch initial session message', {
      sessionId: session.sessionId,
      channelId: session.channelId,
      userId,
      error,
    })
  })

  return session
}

export const approveChannelPlan = async (
  event: H3Event,
  sessionId: string
) => {
  await elizaFetch(event, `/api/messaging/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: {
      content: 'Approve this research plan.',
      transport: 'http',
    },
  })
}

export const listUserResearchSessions = async (event: H3Event, userId: string) => {
  const agentId = await getAgentId(event)
  const [indexedStates, activeSessions] = await Promise.all([
    listIndexedResearchStates(event, agentId, userId),
    getActiveSessions(event, userId, agentId),
  ])
  const activeSessionsByChannelId = new Map(activeSessions.map((item) => [item.channelId, item]))
  const sessionsByChannelId = new Map(
    indexedStates
      .filter((state) => !state.userId || state.userId === userId)
      .map((state) => [
        state.channelId,
        toUiSessionFromState(state, activeSessionsByChannelId.get(state.channelId) ?? null),
      ])
  )

  const missingActiveChannelIds = activeSessions
    .map((session) => session.channelId)
    .filter((channelId) => !sessionsByChannelId.has(channelId))

  const directChannels = await Promise.all(
    missingActiveChannelIds.map((channelId) => getChannelDetails(event, channelId))
  )

  for (const channel of directChannels) {
    if (!channel?.id) {
      continue
    }

    const activeSession = activeSessionsByChannelId.get(channel.id) ?? null
    const metadataUserId = typeof channel.metadata?.userId === 'string' ? channel.metadata.userId : null
    const metadataAgentId = typeof channel.metadata?.agentId === 'string' ? channel.metadata.agentId : null

    if (
      (metadataUserId === userId && metadataAgentId === agentId) ||
      (!!activeSession && activeSession.userId === userId && activeSession.agentId === agentId)
    ) {
      sessionsByChannelId.set(channel.id, toPlanningUiSession(channel, activeSession))
    }
  }

  const sessions = [...sessionsByChannelId.values()]

  sessions.sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime())

  return {
    agentId,
    sessions,
  }
}

export const getUserResearchSession = async (
  event: H3Event,
  userId: string,
  channelId: string
) => {
  const agentId = await getAgentId(event)
  const [state, activeSessions] = await Promise.all([
    getLatestResearchState(event, agentId, channelId),
    getActiveSessions(event, userId, agentId),
  ])
  const activeSession = activeSessions.find((item) => item.channelId === channelId) ?? null

  if (state && (!state.userId || state.userId === userId)) {
    return {
      agentId,
      session: toUiSessionFromState(state, activeSession),
    }
  }

  const channel = await getChannelDetails(event, channelId)

  if (!channel) {
    return {
      agentId,
      session: null,
    }
  }

  const metadataUserId = typeof channel.metadata?.userId === 'string' ? channel.metadata.userId : null
  const metadataAgentId = typeof channel.metadata?.agentId === 'string' ? channel.metadata.agentId : null
  const belongsToUser = (
    (metadataUserId === userId && metadataAgentId === agentId) ||
    (!!activeSession && activeSession.userId === userId && activeSession.agentId === agentId)
  )

  if (!belongsToUser) {
    return {
      agentId,
      session: null,
    }
  }

  return {
    agentId,
    session: toPlanningUiSession(channel, activeSession),
  }
}
