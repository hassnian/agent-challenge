export type ResearchPhase = 'idle' | 'planning' | 'plan-review' | 'researching' | 'critiquing' | 'synthesizing' | 'complete'

export interface ResearchTopic {
  id: string
  title: string
  queries: string[]
  status: 'pending' | 'active' | 'done'
}

export interface ResearchPlan {
  question: string
  topics: ResearchTopic[]
  createdAt: string
}

export interface EvidenceCard {
  id: string
  topicId: string
  title: string
  domain: string
  snippet: string
  relevance: string
  confidence: 'high' | 'medium' | 'low'
  url: string
}

export interface CritiqueNote {
  id: string
  type: 'objection' | 'contradiction' | 'gap' | 'weak-support'
  claim: string
  critique: string
  severity: 'high' | 'medium' | 'low'
}

export interface ContestedPoint {
  id: string
  point: string
  forArgument: string
  againstArgument: string
}

export interface ProgressEntry {
  id: string
  timestamp: string
  role: 'planner' | 'searcher' | 'skeptic' | 'synthesizer'
  message: string
}

export interface ResearchSession {
  id: string
  question: string
  phase: ResearchPhase
  bootstrap: {
    status: 'ready' | 'failed'
    errorMessage: string | null
    canRetry: boolean
  }
  plan: ResearchPlan | null
  evidence: EvidenceCard[]
  critiques: CritiqueNote[]
  contested: ContestedPoint[]
  openQuestions: string[]
  summary: string
  finalAnswer: string
  confidenceLevel: number
  createdAt: string
  completedAt: string | null
  progressLog: ProgressEntry[]
}

const SESSION_POLL_INTERVAL_MS = 4000
const phaseOrder: Record<ResearchPhase, number> = {
  idle: 0,
  planning: 1,
  'plan-review': 2,
  researching: 3,
  critiquing: 4,
  synthesizing: 5,
  complete: 6,
}

let sessionPollingInterval: ReturnType<typeof globalThis.setInterval> | null = null
let refreshSessionsPromise: Promise<void> | null = null

const isPlaceholderSession = (session: ResearchSession | null | undefined) => (
  !!session &&
  session.phase === 'planning' &&
  session.plan === null &&
  session.bootstrap.status === 'ready'
)

const sortSessions = (sessions: ResearchSession[]) => {
  sessions.sort((a, b) => {
    const left = new Date(a.completedAt || a.createdAt).getTime()
    const right = new Date(b.completedAt || b.createdAt).getTime()
    return right - left
  })
}

const mergeSession = (
  current: ResearchSession,
  incoming: ResearchSession,
  options?: { preferIncoming?: boolean }
): ResearchSession => {
  const preferIncoming = options?.preferIncoming === true
  const keepIncomingPhase = preferIncoming || phaseOrder[incoming.phase] >= phaseOrder[current.phase]
  const mergedPhase = keepIncomingPhase ? incoming.phase : current.phase
  const keepIncomingPlan = preferIncoming || !!incoming.plan
  const incomingLooksFresher = phaseOrder[incoming.phase] > phaseOrder[current.phase]

  return {
    ...current,
    ...incoming,
    question: incoming.question || current.question,
    phase: mergedPhase,
    bootstrap:
      preferIncoming ||
      incoming.bootstrap.status === 'failed' ||
      current.bootstrap.status !== 'failed'
        ? incoming.bootstrap
        : current.bootstrap,
    plan: keepIncomingPlan ? incoming.plan : current.plan,
    evidence:
      preferIncoming || incomingLooksFresher || incoming.evidence.length >= current.evidence.length
        ? incoming.evidence
        : current.evidence,
    critiques:
      preferIncoming || incomingLooksFresher || incoming.critiques.length >= current.critiques.length
        ? incoming.critiques
        : current.critiques,
    contested:
      preferIncoming || incomingLooksFresher || incoming.contested.length >= current.contested.length
        ? incoming.contested
        : current.contested,
    openQuestions:
      preferIncoming || incomingLooksFresher || incoming.openQuestions.length >= current.openQuestions.length
        ? incoming.openQuestions
        : current.openQuestions,
    summary: preferIncoming || incoming.summary ? incoming.summary : current.summary,
    finalAnswer: preferIncoming || incoming.finalAnswer ? incoming.finalAnswer : current.finalAnswer,
    confidenceLevel: preferIncoming ? incoming.confidenceLevel : Math.max(current.confidenceLevel, incoming.confidenceLevel),
    createdAt: new Date(incoming.createdAt).getTime() <= new Date(current.createdAt).getTime()
      ? incoming.createdAt
      : current.createdAt,
    completedAt: preferIncoming ? incoming.completedAt : incoming.completedAt || current.completedAt,
    progressLog:
      preferIncoming || incomingLooksFresher || incoming.progressLog.length >= current.progressLog.length
        ? incoming.progressLog
        : current.progressLog,
  }
}

const upsertSession = (
  sessions: Ref<ResearchSession[]>,
  session: ResearchSession,
  options?: { preferIncoming?: boolean }
) => {
  const next = [...sessions.value]
  const index = next.findIndex(item => item.id === session.id)

  if (index === -1) {
    next.unshift(session)
  } else {
    const current = next[index]
    if (!current) {
      next.unshift(session)
    } else {
      next[index] = mergeSession(current, session, options)
    }
  }

  sortSessions(next)
  sessions.value = next
}

const buildOptimisticApprovedSession = (session: ResearchSession): ResearchSession => {
  const topics = session.plan?.topics ?? []
  const hasStartedTopics = topics.some(topic => topic.status === 'done' || topic.status === 'active')
  const nextTopics = hasStartedTopics
    ? topics
    : topics.map((topic, index) => ({
      ...topic,
      status: index === 0 ? 'active' : topic.status,
    }))
  const hasQueuedLog = session.progressLog.some(entry => entry.message === 'Plan approved. Research queued.')

  return {
    ...session,
    phase: 'researching',
    plan: session.plan
      ? {
        ...session.plan,
        topics: nextTopics,
      }
      : null,
    progressLog: hasQueuedLog
      ? session.progressLog
      : [
        ...session.progressLog,
        {
          id: `optimistic-approve-${Date.now()}`,
          timestamp: new Date().toISOString(),
          role: 'planner',
          message: 'Plan approved. Research queued.',
        },
      ],
  }
}

export const useResearch = () => {
  const requestFetch = useRequestFetch()
  const sessions = useState<ResearchSession[]>('research-sessions', () => [])
  const activeSessionId = useState<string | null>('active-session-id', () => null)
  const activeSession = computed(() => {
    if (!activeSessionId.value) {
      return null
    }

    return sessions.value.find(session => session.id === activeSessionId.value) || null
  })

  const initialized = useState<boolean>('research-initialized', () => false)
  const loading = useState<boolean>('research-loading', () => false)
  const optimisticSessionIds = useState<string[]>('research-optimistic-session-ids', () => [])
  const activePollingSessionId = useState<string | null>('research-active-polling-session-id', () => null)

  const markSessionOptimistic = (channelId: string) => {
    if (optimisticSessionIds.value.includes(channelId)) {
      return
    }

    optimisticSessionIds.value = [...optimisticSessionIds.value, channelId]
  }

  const settleSession = (session: ResearchSession) => {
    if (isPlaceholderSession(session)) {
      return
    }

    optimisticSessionIds.value = optimisticSessionIds.value.filter(id => id !== session.id)
  }

  const refreshSessions = async (options?: { silent?: boolean }) => {
    if (refreshSessionsPromise) {
      return refreshSessionsPromise
    }

    if (!options?.silent) {
      loading.value = true
    }

    refreshSessionsPromise = (async () => {
      try {
        const response = await requestFetch<{ sessions: ResearchSession[] }>('/api/research/bootstrap')
        const merged = new Map(sessions.value.map(session => [session.id, session]))

        for (const session of response.sessions) {
          const existing = merged.get(session.id)
          const next = existing ? mergeSession(existing, session) : session
          merged.set(session.id, next)
          settleSession(next)
        }

        sessions.value = [...merged.values()]
        sortSessions(sessions.value)
      } finally {
        loading.value = false
        initialized.value = true
        refreshSessionsPromise = null
      }
    })()

    return refreshSessionsPromise
  }

  const loadSession = async (channelId: string) => {
    if (!channelId) {
      return null
    }

    const session = await requestFetch<ResearchSession>(`/api/research/channels/${channelId}`)

    upsertSession(sessions, session)
    settleSession(session)
    return session
  }

  const createSession = async (question: string) => {
    const session = await requestFetch<ResearchSession>('/api/research/sessions', {
      method: 'POST',
      body: {
        question,
      },
    })

    upsertSession(sessions, session, { preferIncoming: true })
    activeSessionId.value = session.id
    markSessionOptimistic(session.id)

    startSessionPolling(session.id)

    return session.id
  }

  const startSessionPolling = (channelId: string) => {
    if (!import.meta.client) {
      return
    }

    if (activePollingSessionId.value === channelId && sessionPollingInterval) {
      return
    }

    activePollingSessionId.value = channelId

    if (sessionPollingInterval) {
      clearInterval(sessionPollingInterval)
    }

    sessionPollingInterval = globalThis.setInterval(async () => {
      try {
        const updated = await requestFetch<ResearchSession>(`/api/research/channels/${channelId}`)
        upsertSession(sessions, updated)
        settleSession(updated)

        if (updated.phase === 'complete' || updated.bootstrap.status === 'failed') {
          if (sessionPollingInterval) {
            clearInterval(sessionPollingInterval)
            sessionPollingInterval = null
          }

          activePollingSessionId.value = null
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, SESSION_POLL_INTERVAL_MS)
  }

  const approvePlan = async (channelId: string) => {
    const existing = sessions.value.find(session => session.id === channelId) || null

    if (existing) {
      upsertSession(sessions, buildOptimisticApprovedSession(existing), { preferIncoming: true })
      activeSessionId.value = existing.id
      startSessionPolling(existing.id)
    }

    const session = await requestFetch<ResearchSession>(`/api/research/channels/${channelId}/approve`, {
      method: 'POST',
    })

    upsertSession(sessions, session, { preferIncoming: true })
    settleSession(session)
    activeSessionId.value = session.id
    startSessionPolling(session.id)
    return session
  }

  const retryBootstrap = async (channelId: string) => {
    const session = await requestFetch<ResearchSession>(`/api/research/channels/${channelId}/retry-bootstrap`, {
      method: 'POST',
    })

    upsertSession(sessions, session, { preferIncoming: true })
    markSessionOptimistic(session.id)
    activeSessionId.value = session.id
    startSessionPolling(session.id)
    return session
  }

  const deleteSession = (channelId: string) => {
    sessions.value = sessions.value.filter(session => session.id !== channelId)
    if (activeSessionId.value === channelId) {
      activeSessionId.value = null
    }
  }

  if (import.meta.client && !initialized.value) {
    void refreshSessions()
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    loading,
    createSession,
    approvePlan,
    retryBootstrap,
    refreshSessions,
    loadSession,
    deleteSession,
    startSessionPolling,
    isPlaceholderSession,
    isOptimisticSession: (channelId: string) => optimisticSessionIds.value.includes(channelId),
  }
}
