export interface AdminIdentity { id: string; username: string; displayName: string; role: 'admin' }
export interface AdminSession { admin: AdminIdentity; expiresAt: string }
export type AuthErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'cancelled' | 'logout-pending'

export class AdminAuthError extends Error {
  constructor(public readonly kind: AuthErrorKind, public readonly status = 0, public readonly retryAfter = 0) {
    const messages: Record<number, string> = {
      401: '账号或密码错误，或管理员会话已失效。',
      403: '请求来源未获允许，请检查同源代理与后端 ADMIN_ORIGIN 配置。',
      404: '管理员认证接口尚未启用或未正确转发，请联系管理员检查配置。',
      422: '账号或密码格式不符合要求，请检查输入。',
      429: '登录尝试过于频繁，请稍后再试。',
      503: '认证服务或其存储暂不可用，请稍后重试。',
    }
    const fallback: Record<AuthErrorKind, string> = { http: '认证请求失败，请稍后重试。', network: '无法连接认证服务，请检查网络或同源代理。', timeout: '认证请求超时，请重试；本次结果尚未确认。', 'invalid-response': '认证服务响应不符合接口约定，暂不能确认管理员身份。', cancelled: '认证请求已取消。', 'logout-pending': '上次退出尚未得到服务端确认，请先重试退出。' }
    super(kind === 'http' ? messages[status] || fallback.http : fallback[kind])
    this.name = 'AdminAuthError'
  }
}

export function asAuthError(error: unknown): AdminAuthError { return error instanceof AdminAuthError ? error : new AdminAuthError('network') }

function validateSession(value: unknown): AdminSession {
  const data = value as Partial<AdminSession> | null
  const admin = data?.admin
  if (!data || !admin || typeof admin.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(admin.id) || typeof admin.username !== 'string' || !/^[a-z][a-z0-9._-]{2,31}$/.test(admin.username) || typeof admin.displayName !== 'string' || !admin.displayName.trim() || Array.from(admin.displayName).length > 64 || admin.role !== 'admin' || typeof data.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) throw new AdminAuthError('invalid-response')
  return { admin: { id: admin.id, username: admin.username, displayName: admin.displayName, role: 'admin' }, expiresAt: data.expiresAt }
}

async function requestAuth(action: 'login' | 'me' | 'logout', credentials?: { username: string; password: string }, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  if (signal?.aborted) throw new AdminAuthError('cancelled')
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10000)
  try {
    const response = await fetch(`/api/v1/admin/auth/${action}`, {
      method: action === 'me' ? 'GET' : 'POST', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: action === 'me' ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(action === 'login' ? { body: JSON.stringify(credentials) } : {}),
    })
    if (!response.ok) {
      const retry = Number(response.headers.get('Retry-After'))
      throw new AdminAuthError('http', response.status, Number.isInteger(retry) && retry > 0 ? Math.min(retry, 3600) : 0)
    }
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) throw new AdminAuthError('invalid-response')
    let body: { code?: unknown; data?: unknown }
    try { body = await response.json() } catch (error) { if (controller.signal.aborted) throw error; throw new AdminAuthError('invalid-response') }
    if (!body || typeof body !== 'object' || body.code !== 0 || !Object.hasOwn(body, 'data')) throw new AdminAuthError('invalid-response')
    if (action === 'logout' && body.data !== null) throw new AdminAuthError('invalid-response')
    return body.data
  } catch (error) {
    if (error instanceof AdminAuthError) throw error
    if (controller.signal.aborted) throw new AdminAuthError(timedOut ? 'timeout' : 'cancelled')
    throw new AdminAuthError('network')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}

export async function loginAdmin(username: string, password: string, signal?: AbortSignal) { return validateSession(await requestAuth('login', { username, password }, signal)) }
export async function fetchAdminSession(signal?: AbortSignal) { return validateSession(await requestAuth('me', undefined, signal)) }
export async function logoutAdmin(signal?: AbortSignal) { await requestAuth('logout', undefined, signal) }
