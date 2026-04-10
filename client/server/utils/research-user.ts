import { randomUUID } from 'node:crypto'
import { getCookie, setCookie, type H3Event } from 'h3'

const RESEARCH_USER_COOKIE = 'research_user_id'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const isUuid = (value: string) => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
)

export const getOrCreateResearchUserId = (event: H3Event) => {
  const existing = getCookie(event, RESEARCH_USER_COOKIE)?.trim()

  if (existing && isUuid(existing)) {
    return existing
  }

  const userId = randomUUID()

  setCookie(event, RESEARCH_USER_COOKIE, userId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })

  return userId
}

