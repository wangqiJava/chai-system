import { computed } from 'vue'
import { isDemoMode, authModeLabel } from '../config/auth'
import { demoSession, demoSessionMemoryOnly, demoSessionExpired, getDemoSession, startDemoSession, endDemoSession } from './session'
import { adminSession, adminPhase, verifyAdminSession, signInAdmin, signOutAdmin } from './admin-session'

export { isDemoMode, authModeLabel }
export const authChecking = computed(() => !isDemoMode && ['checking', 'logging-out'].includes(adminPhase.value))
export const authDisplayName = computed(() => isDemoMode ? demoSession.value?.displayName || '演示管理员' : adminSession.value?.admin.displayName || '管理员')
export const authMemoryOnly = computed(() => isDemoMode && demoSessionMemoryOnly.value)
export const authExpired = computed(() => isDemoMode && demoSessionExpired.value)
export const authVerified = computed(() => isDemoMode ? Boolean(demoSession.value) : adminPhase.value === 'authenticated' && Boolean(adminSession.value))

export async function checkAuthSession() { return isDemoMode ? getDemoSession() : verifyAdminSession() }
export async function signIn(username: string, password: string) {
  if (isDemoMode) { startDemoSession(); return }
  await signInAdmin(username, password)
}
export async function signOut() { if (isDemoMode) endDemoSession(); else await signOutAdmin() }
