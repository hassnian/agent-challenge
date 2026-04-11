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

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Research session not found.' })
  }

  await approveChannelPlan(event, channelId, userId)

  const refreshed = await getUserResearchSession(event, userId, channelId, { fresh: true })

  if (!refreshed.session) {
    throw createError({ statusCode: 404, statusMessage: 'Research session not found after approval.' })
  }

  return refreshed.session
})
