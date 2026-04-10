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
  sessionId: string | null
}

const POLL_INTERVAL_MS = 4000

const upsertSession = (sessions: Ref<ResearchSession[]>, session: ResearchSession) => {
  const next = [...sessions.value]
  const index = next.findIndex(item => item.id === session.id)

  if (index === -1) {
    next.unshift(session)
  } else {
    next[index] = session
  }

  next.sort((a, b) => {
    const left = new Date(a.completedAt || a.createdAt).getTime()
    const right = new Date(b.completedAt || b.createdAt).getTime()
    return right - left
  })

  sessions.value = next
}

export const useResearch = () => {
  const sessions = useState<ResearchSession[]>('research-sessions', () => [])
  const activeSessionId = useState<string | null>('active-session-id', () => null)
  const activeSession = computed(() => {
    if (!activeSessionId.value) {
      return null
    }

    return sessions.value.find(session => session.id === activeSessionId.value) || null
  })

  const initialized = useState<boolean>('research-initialized', () => false)
  const pollStarted = useState<boolean>('research-poll-started', () => false)
  const loading = useState<boolean>('research-loading', () => false)

  const refreshSessions = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      loading.value = true
    }

    try {
      const response = await $fetch<{ sessions: ResearchSession[] }>('/api/research/bootstrap')

      sessions.value = response.sessions

      if (activeSessionId.value && !response.sessions.some(session => session.id === activeSessionId.value)) {
        activeSessionId.value = null
      }
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  const loadSession = async (channelId: string) => {
    if (!channelId) {
      return null
    }

    const session = await $fetch<ResearchSession>(`/api/research/channels/${channelId}`)

    upsertSession(sessions, session)
    return session
  }

  const createSession = async (question: string) => {
    const session = await $fetch<ResearchSession>('/api/research/sessions', {
      method: 'POST',
      body: {
        question,
      },
    })

    upsertSession(sessions, session)
    activeSessionId.value = session.id
    return session.id
  }

  const approvePlan = async (channelId: string) => {
    const session = await $fetch<ResearchSession>(`/api/research/channels/${channelId}/approve`, {
      method: 'POST',
    })

    upsertSession(sessions, session)
    activeSessionId.value = session.id
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

  if (import.meta.client && !pollStarted.value) {
    pollStarted.value = true
    window.setInterval(() => {
      void refreshSessions({ silent: true })
    }, POLL_INTERVAL_MS)
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    loading,
    createSession,
    approvePlan,
    refreshSessions,
    loadSession,
    deleteSession,
  }
}
