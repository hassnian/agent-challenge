import { createError } from 'h3'
import { approveChannelPlan, getUserResearchSession } from '../../../../utils/eliza'
import { getOrCreateResearchUserId } from '../../../../utils/research-user'

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'channelId')
  const userId = getOrCreateResearchUserId(event)

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channelId.' })
  }

  const { session } = await getUserResearchSession(event, userId, channelId)

  if (!session?.sessionId) {
    throw createError({ statusCode: 409, statusMessage: 'No active Eliza messaging session is available for this channel.' })
  }

  await approveChannelPlan(event, session.sessionId)

  const refreshed = await getUserResearchSession(event, userId, channelId)

  if (!refreshed.session) {
    throw createError({ statusCode: 404, statusMessage: 'Research session not found after approval.' })
  }

  return refreshed.session
})
