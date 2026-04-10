import { listUserResearchSessions } from '../../utils/eliza'
import { getOrCreateResearchUserId } from '../../utils/research-user'

export default defineEventHandler(async (event) => {
  const userId = getOrCreateResearchUserId(event)
  return listUserResearchSessions(event, userId)
})
