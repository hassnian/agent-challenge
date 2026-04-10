import { createError, type H3Event } from 'h3'

export type AgentRecord = {
  id: string
  name?: string
  status?: string
}

export type MessageServerRecord = {
  id: string
  name?: string
  sourceType?: string
}

export type ChannelRecord = {
  id: string
  name?: string
  type?: string
  messageServerId?: string
  createdAt?: string | number
  updatedAt?: string | number
  metadata?: Record<string, unknown>
}

export type ActiveSessionRecord = {
  sessionId: string
  channelId: string
  agentId: string
  userId: string
  createdAt?: string | number
  expiresAt?: string | number
  metadata?: Record<string, unknown>
}

export type MemoryResponse<T> = {
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

const elizaFetch = <T>(
  event: H3Event,
  path: string,
  options?: Parameters<typeof $fetch<T>>[1]
) => $fetch<T>(`${getBaseUrl(event)}${path}`, options)

const getErrorStatusCode = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }

  return null
}

const toHttpTransportPayload = <T extends Record<string, unknown>>(payload: T) => ({
  ...payload,
  // The installed 1.7 server line accepts `transport`; newer docs often refer to `mode`.
  transport: 'http' as const,
})

export const toElizaErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null) {
    return fallback
  }

  const data = 'data' in error ? error.data : null
  if (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof data.error === 'object' &&
    data.error !== null &&
    'message' in data.error &&
    typeof data.error.message === 'string'
  ) {
    return data.error.message
  }

  if ('statusMessage' in error && typeof error.statusMessage === 'string' && error.statusMessage) {
    return error.statusMessage
  }

  if ('message' in error && typeof error.message === 'string' && error.message) {
    return error.message
  }

  return fallback
}

export const getActiveAgentId = async (event: H3Event) => {
  const response = await elizaFetch<{ success: boolean; data?: { agents?: AgentRecord[] } }>(event, '/api/agents')
  const agents = response.data?.agents ?? []
  const agent = agents.find((item) => item.status === 'active') ?? agents.at(0)

  if (!agent?.id) {
    throw createError({ statusCode: 503, statusMessage: 'No Eliza agent is available.' })
  }

  return agent.id
}

export const getCurrentMessageServerId = async (event: H3Event) => {
  const response = await elizaFetch<{ success: boolean; data?: { messageServers?: MessageServerRecord[] } }>(
    event,
    '/api/messaging/message-servers'
  )
  const messageServer = response.data?.messageServers?.at(0)

  if (!messageServer?.id) {
    throw createError({ statusCode: 503, statusMessage: 'No Eliza message server is available.' })
  }

  return messageServer.id
}

export const getChannelDetails = async (
  event: H3Event,
  channelId: string
): Promise<ChannelRecord | null> => {
  try {
    const response = await elizaFetch<{ success: boolean; data?: ChannelRecord }>(
      event,
      `/api/messaging/channels/${channelId}/details`
    )

    return response.data ?? null
  } catch (error) {
    if (getErrorStatusCode(error) === 404) {
      return null
    }

    throw error
  }
}

export const listMessageServerChannels = async (
  event: H3Event,
  messageServerId: string
) => {
  const response = await elizaFetch<{ success: boolean; data?: { channels?: ChannelRecord[] } }>(
    event,
    `/api/messaging/message-servers/${messageServerId}/channels`
  )

  return response.data?.channels ?? []
}

export const updateChannelMetadata = async (
  event: H3Event,
  channelId: string,
  metadata: Record<string, unknown>
) => {
  await elizaFetch(event, `/api/messaging/channels/${channelId}`, {
    method: 'PATCH',
    body: { metadata },
  })
}

export const createMessagingSession = async (
  event: H3Event,
  input: {
    agentId: string
    userId: string
    metadata?: Record<string, unknown>
  }
) => {
  return elizaFetch<ActiveSessionRecord>(event, '/api/messaging/sessions', {
    method: 'POST',
    body: input,
  })
}

export const sendSessionMessage = async (
  event: H3Event,
  sessionId: string,
  input: {
    content: string
    metadata?: Record<string, unknown>
  }
) => {
  return elizaFetch(
    event,
    `/api/messaging/sessions/${sessionId}/messages`,
    {
      method: 'POST',
      body: toHttpTransportPayload(input),
    }
  )
}

export const sendChannelMessage = async (
  event: H3Event,
  input: {
    channelId: string
    authorId: string
    messageServerId: string
    content: string
    sourceType?: string
    metadata?: Record<string, unknown>
  }
) => {
  const { channelId, authorId, messageServerId, content, sourceType, metadata } = input

  return elizaFetch(event, `/api/messaging/channels/${channelId}/messages`, {
    method: 'POST',
    body: toHttpTransportPayload({
      author_id: authorId,
      message_server_id: messageServerId,
      content,
      source_type: sourceType ?? 'research-council-client',
      metadata,
    }),
  })
}

export const getRoomMemories = async <T>(
  event: H3Event,
  agentId: string,
  channelId: string,
  options: {
    tableName: string
    limit?: number
  }
) => {
  return elizaFetch<MemoryResponse<T>>(
    event,
    `/api/memory/${agentId}/rooms/${channelId}/memories`,
    {
      query: {
        tableName: options.tableName,
        limit: options.limit ?? 20,
      },
    }
  )
}
