import { randomUUID } from 'node:crypto'
import {
  getCookie,
  setCookie,
  type H3Event,
} from 'h3'

const RESEARCH_USER_COOKIE = 'research_user_id'
const RESEARCH_WORLD_SERVER_COOKIE = 'research_user_world_server_id'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
const LEGACY_SHARED_USER_ID = 'ca615a1b-10ed-4da5-a9c6-1d1fc42b6a03'

const isUuid = (value: string) => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
)

export const getOrCreateResearchUserId = (event: H3Event) => {
  const existing = getCookie(event, RESEARCH_USER_COOKIE)?.trim()
  const userId = (
    existing &&
    existing !== LEGACY_SHARED_USER_ID &&
    isUuid(existing)
  )
    ? existing
    : randomUUID()

  setCookie(event, RESEARCH_USER_COOKIE, userId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })

  return userId
}

export const hasResearchUserWorldForServer = (event: H3Event, messageServerId: string) => (
  getCookie(event, RESEARCH_WORLD_SERVER_COOKIE)?.trim() === messageServerId
)

export const markResearchUserWorldReady = (event: H3Event, messageServerId: string) => {
  setCookie(event, RESEARCH_WORLD_SERVER_COOKIE, messageServerId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}
