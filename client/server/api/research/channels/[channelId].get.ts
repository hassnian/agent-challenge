import { createError } from 'h3'
import { getUserResearchSession } from '../../../utils/eliza'
import { getOrCreateResearchUserId } from '../../../utils/research-user'

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

  return session
})
