import { createError, readBody } from 'h3'
import { getUserResearchSession, updateChannelPlan } from '../../../../utils/eliza'
import { getOrCreateResearchUserId } from '../../../../utils/research-user'

const sleep = (ms: number) => new Promise(resolve => globalThis.setTimeout(resolve, ms))

const getLatestProgressTimestamp = (timestamps: string[]) => (
  timestamps.reduce((latest, value) => {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? latest : Math.max(latest, parsed)
  }, 0)
)

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'channelId')
  const userId = getOrCreateResearchUserId(event)
  const body = await readBody<{ instructions?: string }>(event) ?? {}
  const instructions = (body.instructions ?? '').trim()

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channelId.' })
  }

  if (!instructions) {
    throw createError({ statusCode: 400, statusMessage: 'Missing plan update instructions.' })
  }

  const { session } = await getUserResearchSession(event, userId, channelId)

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Research session not found.' })
  }

  const previousLatestProgressTimestamp = getLatestProgressTimestamp(
    session.progressLog.map(entry => entry.timestamp)
  )

  await updateChannelPlan(event, channelId, userId, instructions)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(500)

    const refreshed = await getUserResearchSession(event, userId, channelId, { fresh: true })
    const nextSession = refreshed.session

    if (!nextSession) {
      continue
    }

    const nextLatestProgressTimestamp = getLatestProgressTimestamp(
      nextSession.progressLog.map(entry => entry.timestamp)
    )

    if (
      nextSession.phase === 'plan-review' &&
      nextLatestProgressTimestamp > previousLatestProgressTimestamp
    ) {
      return nextSession
    }
  }

  const fallback = await getUserResearchSession(event, userId, channelId, { fresh: true })

  if (!fallback.session) {
    throw createError({ statusCode: 404, statusMessage: 'Research session not found after plan update.' })
  }

  return fallback.session
})
