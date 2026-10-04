import { readonly, ref, shallowRef } from 'vue'

// 仅用于前端演示导航，不是登录凭据，不能作为任何服务端的授权依据。
export const DEMO_SESSION_KEY = 'chai-system.demo-session.v1'
export const DEMO_SESSION_TTL = 30 * 60 * 1000

export interface DemoSession {
  mode: 'demo'
  account: 'demo-admin'
  displayName: string
  createdAt: number
  expiresAt: number
}

const current = shallowRef<DemoSession | null>(null)
const memoryOnly = ref(false)
const expired = ref(false)

export const demoSession = readonly(current)
export const demoSessionMemoryOnly = readonly(memoryOnly)
export const demoSessionExpired = readonly(expired)

function removeStoredSession() {
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY)
  } catch {
    memoryOnly.value = true
  }
}

export function getDemoSession(): DemoSession | null {
  let candidate: unknown = current.value
  if (!memoryOnly.value) {
    try {
      const stored = sessionStorage.getItem(DEMO_SESSION_KEY)
      try { candidate = stored ? JSON.parse(stored) : null } catch {
        current.value = null
        removeStoredSession()
        return null
      }
    } catch {
      if (current.value) memoryOnly.value = true
      else removeStoredSession()
    }
  }
  if (!candidate || typeof candidate !== 'object') {
    current.value = null
    return null
  }
  const value = candidate as Partial<DemoSession>
  if (value.mode !== 'demo' || value.account !== 'demo-admin' ||
      typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) ||
      typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= value.createdAt || value.expiresAt - value.createdAt > DEMO_SESSION_TTL) {
    current.value = null
    removeStoredSession()
    return null
  }
  if (value.expiresAt <= Date.now()) {
    expired.value = true
    current.value = null
    removeStoredSession()
    return null
  }
  current.value = {
    mode: 'demo',
    account: 'demo-admin',
    displayName: '演示管理员',
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  }
  return current.value
}

export function startDemoSession() {
  const now = Date.now()
  current.value = { mode: 'demo', account: 'demo-admin', displayName: '演示管理员', createdAt: now, expiresAt: now + DEMO_SESSION_TTL }
  expired.value = false
  memoryOnly.value = false
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(current.value))
  } catch {
    memoryOnly.value = true
  }
}

export function endDemoSession() {
  current.value = null
  expired.value = false
  removeStoredSession()
}
