export interface DependencyStatus { status: 'up' | 'down' | 'timeout'; latencyMs: number; message: string }
export interface RuntimeStatus { nodeVersion: string; uptimeSeconds: number }
export interface AdminSystemStatus { status: 'ok' | 'degraded'; checkedAt: string; durationMs: number; runtime: RuntimeStatus; checks: { api: { status: 'up'; message: string }; database: DependencyStatus; redis: DependencyStatus } }
type ErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'cancelled'

export class AdminSystemError extends Error {
  constructor(public readonly kind: ErrorKind, public readonly status = 0) {
    const messages: Record<number, string> = { 401: '管理员会话已失效，请重新登录。', 403: '状态查询被拒绝，请核对权限与访问来源。', 404: '系统状态接口尚不可用，请检查后端版本或代理配置。', 422: '状态查询参数无效。', 429: '查询过于频繁，请稍后重试。', 503: '认证或服务依赖暂不可用，无法取得状态快照，请稍后重试。' }
    super(kind === 'http' ? messages[status] || '系统状态查询失败，请重试。' : kind === 'timeout' ? '状态查询超时，请重试。' : kind === 'network' ? '无法连接状态服务，请检查网络。' : kind === 'cancelled' ? '状态查询已取消。' : '状态接口响应格式不正确，未展示该响应。')
    this.name = 'AdminSystemError'
  }
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
const fields = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const milliseconds = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const seconds = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const message = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 128
const nodeVersion = (value: unknown) => typeof value === 'string' && /^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(value)
function dependency(value: unknown): value is DependencyStatus { return object(value) && fields(value, ['status', 'latencyMs', 'message']) && ['up', 'down', 'timeout'].includes(String(value.status)) && milliseconds(value.latencyMs) && message(value.message) }
function parse(value: unknown): AdminSystemStatus {
  if (!object(value) || !fields(value, ['status', 'checkedAt', 'durationMs', 'runtime', 'checks']) || !['ok', 'degraded'].includes(String(value.status)) || typeof value.checkedAt !== 'string' || !Number.isFinite(Date.parse(value.checkedAt)) || new Date(value.checkedAt).toISOString() !== value.checkedAt || !milliseconds(value.durationMs) || !object(value.runtime) || !fields(value.runtime, ['nodeVersion', 'uptimeSeconds']) || !nodeVersion(value.runtime.nodeVersion) || !seconds(value.runtime.uptimeSeconds) || !object(value.checks) || !fields(value.checks, ['api', 'database', 'redis']) || !object(value.checks.api) || !fields(value.checks.api, ['status', 'message']) || value.checks.api.status !== 'up' || !message(value.checks.api.message) || !dependency(value.checks.database) || !dependency(value.checks.redis)) throw new AdminSystemError('invalid-response')
  const healthy = value.checks.database.status === 'up' && value.checks.redis.status === 'up'
  if (value.status !== (healthy ? 'ok' : 'degraded')) throw new AdminSystemError('invalid-response')
  return value as unknown as AdminSystemStatus
}
export async function fetchAdminSystemStatus(signal?: AbortSignal): Promise<AdminSystemStatus> {
  if (signal?.aborted) throw new AdminSystemError('cancelled')
  const controller = new AbortController()
  const abort = () => controller.abort()
  let timedOut = false
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10000)
  try {
    const response = await fetch('/api/v1/admin/system-status', { method: 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new AdminSystemError('http', response.status)
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) throw new AdminSystemError('invalid-response')
    let body: unknown
    try { body = await response.json() } catch (error) { if (controller.signal.aborted) throw error; throw new AdminSystemError('invalid-response') }
    if (!object(body) || body.code !== 0 || !Object.hasOwn(body, 'data')) throw new AdminSystemError('invalid-response')
    return parse(body.data)
  } catch (error) {
    if (error instanceof AdminSystemError) throw error
    if (controller.signal.aborted) throw new AdminSystemError(timedOut ? 'timeout' : 'cancelled')
    throw new AdminSystemError('network')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
