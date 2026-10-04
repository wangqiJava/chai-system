import { readonly, ref, shallowRef } from 'vue'
import { AdminAuthError, asAuthError, fetchAdminSession, loginAdmin, logoutAdmin, type AdminSession } from '../api/admin-auth'
import { isDemoMode } from '../config/auth'

type Phase = 'idle' | 'checking' | 'signing-in' | 'authenticated' | 'unauthenticated' | 'logging-out' | 'error'
const current = shallowRef<AdminSession | null>(null)
const phase = ref<Phase>('idle')
const failure = shallowRef<AdminAuthError | null>(null)
const checkedAt = ref(0)
const logoutPending = ref(false)
const logoutMarkerAvailable = ref(true)
// 仅保存退出意图（值为 1），不是身份或凭据，不能用于放行任何页面。
const LOGOUT_MARKER = 'chai-system.admin-logout-pending.v1'
if (!isDemoMode) {
  try { logoutPending.value = sessionStorage.getItem(LOGOUT_MARKER) === '1' } catch { logoutMarkerAvailable.value = false }
}
export const adminSession = readonly(current)
export const adminPhase = readonly(phase)
export const adminFailure = readonly(failure)
export const adminCheckedAt = readonly(checkedAt)
export const adminLogoutPending = readonly(logoutPending)
export const adminLogoutMarkerAvailable = readonly(logoutMarkerAvailable)
let generation = 0
let controller: AbortController | undefined
let verification: Promise<AdminSession | null> | null = null

function setLogoutPending(value: boolean) {
  logoutPending.value = value
  try { if (value) sessionStorage.setItem(LOGOUT_MARKER, '1'); else sessionStorage.removeItem(LOGOUT_MARKER) } catch { logoutMarkerAvailable.value = false }
}
function begin(next: Phase) {
  if (isDemoMode) throw new AdminAuthError('cancelled')
  generation++
  controller?.abort()
  controller = new AbortController()
  verification = null
  phase.value = next
  current.value = null
  failure.value = null
  return { id: generation, signal: controller.signal }
}
function assertCurrent(id: number) { if (id !== generation) throw new AdminAuthError('cancelled') }
function accept(session: AdminSession, id: number) {
  assertCurrent(id)
  current.value = session
  checkedAt.value = Date.now()
  phase.value = 'authenticated'
  failure.value = null
  return session
}

export function verifyAdminSession(): Promise<AdminSession | null> {
  if (logoutPending.value) return Promise.reject(new AdminAuthError('logout-pending'))
  if (verification) return verification
  const operation = begin('checking')
  const pending = (async () => {
    try { return accept(await fetchAdminSession(operation.signal), operation.id) } catch (error) {
      assertCurrent(operation.id)
      const known = asAuthError(error)
      if (known.kind === 'http' && known.status === 401) { phase.value = 'unauthenticated'; return null }
      phase.value = 'error'
      failure.value = known
      throw known
    } finally { if (operation.id === generation) verification = null }
  })()
  verification = pending
  return pending
}

export async function signInAdmin(username: string, password: string) {
  if (logoutPending.value) throw new AdminAuthError('logout-pending')
  const operation = begin('signing-in')
  try { return accept(await loginAdmin(username, password, operation.signal), operation.id) } catch (error) {
    assertCurrent(operation.id)
    const known = asAuthError(error)
    phase.value = 'unauthenticated'
    failure.value = known
    throw known
  }
}

export function cancelAdminLogin() {
  if (phase.value !== 'signing-in') return
  generation++
  controller?.abort()
  phase.value = 'idle'
  current.value = null
}

export async function signOutAdmin() {
  if (phase.value === 'logging-out') throw new AdminAuthError('logout-pending')
  const operation = begin('logging-out')
  setLogoutPending(true)
  try { await logoutAdmin(operation.signal); assertCurrent(operation.id) } catch (error) {
    assertCurrent(operation.id)
    const known = asAuthError(error)
    if (!(known.kind === 'http' && known.status === 401)) { phase.value = 'error'; failure.value = known; throw known }
  }
  setLogoutPending(false)
  phase.value = 'unauthenticated'
  failure.value = null
}
