import { createRouter, createWebHistory } from 'vue-router'
import { authExpired, authModeLabel, checkAuthSession, isDemoMode } from '../state/auth'
import { adminPhase, adminLogoutPending } from '../state/admin-session'
import { asAuthError } from '../api/admin-auth'

export function safeAuthDestination(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes(String.fromCharCode(92))) return '/dashboard'
  try {
    const url = new URL(value, window.location.origin)
    const keys: Record<string, string[]> = {
      '/dashboard': [],
      '/users': ['user', 'name', 'from', 'to', 'page', 'size', 'uid'],
      '/business-data': ['tab', 'user', 'keyword', 'ledger', 'type', 'category', 'from', 'to', 'month', 'page', 'size', 'lid', 'rid'],
      '/categories': ['tab', 'name', 'type', 'status', 'user', 'page', 'size'],
      '/audit-logs': ['from', 'to', 'admin', 'type', 'result', 'request', 'id', 'page', 'size'],
      '/system-status': [],
      '/feedback': [],
    }
    if (url.origin !== window.location.origin || !Object.hasOwn(keys, url.pathname)) return '/dashboard'
    const query = new URLSearchParams()
    for (const key of keys[url.pathname]) {
      const values = url.searchParams.getAll(key)
      if (values.length === 1 && values[0].length <= 100) query.set(key, values[0])
    }
    return url.pathname + (query.size ? `?${query.toString()}` : '')
  } catch { return '/dashboard' }
}

const apiWorkspace = () => import('../views/ApiWorkspaceView.vue')
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { title: '管理员登录' } },
    { path: '/auth-status', name: 'auth-status', component: () => import('../views/AuthStatusView.vue'), meta: { title: '认证连接状态' } },
    {
      path: '/',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', name: 'dashboard', component: isDemoMode ? () => import('../views/DashboardView.vue') : apiWorkspace, meta: { title: isDemoMode ? '数据概览' : '管理工作台' } },
        { path: 'users', name: 'users', component: isDemoMode ? () => import('../views/UsersView.vue') : () => import('../views/ApiUsersView.vue'), meta: { title: '用户管理' } },
        { path: 'business-data', name: 'business-data', component: isDemoMode ? () => import('../views/BusinessDataView.vue') : () => import('../views/ApiBusinessDataView.vue'), meta: { title: '业务数据查询' } },
        { path: 'categories', name: 'categories', component: isDemoMode ? () => import('../views/CategoriesView.vue') : () => import('../views/ApiCategoriesView.vue'), meta: { title: '分类管理' } },
        { path: 'audit-logs', name: 'audit-logs', component: isDemoMode ? () => import('../views/AuditLogsView.vue') : () => import('../views/ApiAuditLogsView.vue'), meta: { title: '操作日志' } },
        { path: 'system-status', name: 'system-status', component: isDemoMode ? () => import('../views/SystemStatusView.vue') : apiWorkspace, meta: { title: '系统状态' } },
        { path: 'feedback', name: 'feedback', component: isDemoMode ? () => import('../views/FeedbackView.vue') : apiWorkspace, meta: { title: '用户反馈' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const redirect = safeAuthDestination(to.name === 'login' || to.name === 'auth-status' ? to.query.redirect : to.fullPath)
  if (!isDemoMode && adminLogoutPending.value && to.name !== 'auth-status') return { name: 'auth-status', query: { redirect } }
  if (to.name === 'auth-status') return isDemoMode ? { name: 'login' } : true
  if (!isDemoMode && to.name === 'login' && adminPhase.value !== 'authenticated') return true
  try {
    const session = await checkAuthSession()
    if (to.matched.some(record => record.meta.requiresAuth) && !session) return { name: 'login', query: { redirect, ...(!isDemoMode || authExpired.value ? { reason: 'expired' } : {}) } }
    if (to.name === 'login' && session) return redirect
  } catch (error) {
    if (asAuthError(error).kind === 'cancelled') return false
    return { name: 'auth-status', query: { redirect } }
  }
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title || '管理后台')} — 柴记账 · ${authModeLabel}`
})

export default router
