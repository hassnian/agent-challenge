import { createError, readBody } from 'h3'
import { buildPendingUiSession, createChannelSession, getAgentId } from '../../utils/eliza'
import { getOrCreateResearchUserId } from '../../utils/research-user'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ question?: string }>(event) ?? {}
  const userId = getOrCreateResearchUserId(event)
  const question = (body.question ?? '').trim()

  if (!question) {
    throw createError({ statusCode: 400, statusMessage: 'Missing question.' })
  }

  const agentId = await getAgentId(event)
  const activeSession = await createChannelSession(event, agentId, userId, question)
  return buildPendingUiSession(activeSession.channelId, question, activeSession)
})
