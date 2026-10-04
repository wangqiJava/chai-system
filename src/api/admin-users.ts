export interface AdminUser { id: string; nickname: string | null; createdAt: string; updatedAt: string; ledgerCount: number; transactionCount: number }
export interface AdminUsersPage { items: AdminUser[]; total: number; page: number; size: number }
export interface AdminUsersQuery { user?: string; name?: string; from?: string; to?: string; page: number; size: number }
type UserErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'cancelled'

export class AdminUsersError extends Error {
  constructor(public readonly kind: UserErrorKind, public readonly status = 0) {
    const messages: Record<number, string> = { 401: '管理员会话已失效，请重新登录。', 403: '用户查询被拒绝，请核对管理员权限与访问来源。', 404: '用户不存在、已删除或接口尚不可用。', 422: '筛选参数无效，请检查用户 ID、日期和分页。', 429: '查询过于频繁，请稍后重试。', 503: '用户查询暂不可用，请稍后重试。' }
    super(kind === 'http' ? messages[status] || '用户查询失败，请稍后重试。' : kind === 'timeout' ? '用户查询超时，请重试。' : kind === 'network' ? '无法连接用户查询服务，请检查网络。' : kind === 'cancelled' ? '查询已取消。' : '用户接口返回格式不正确，未展示该响应。')
    this.name = 'AdminUsersError'
  }
}
export const isUserId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export function isUserDate(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
function timestamp(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
function user(value: unknown): AdminUser {
  if (!object(value) || typeof value.id !== 'string' || !isUserId(value.id) || !(value.nickname === null || typeof value.nickname === 'string' && Array.from(value.nickname).length <= 64) || !timestamp(value.createdAt) || !timestamp(value.updatedAt) || !count(value.ledgerCount) || !count(value.transactionCount)) throw new AdminUsersError('invalid-response')
  return { id: value.id, nickname: value.nickname as string | null, createdAt: value.createdAt, updatedAt: value.updatedAt, ledgerCount: value.ledgerCount as number, transactionCount: value.transactionCount as number }
}
async function read(path: string, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new AdminUsersError('cancelled')
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10000)
  try {
    const response = await fetch(`/api/v1/admin/users${path}`, { method: 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new AdminUsersError('http', response.status)
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) throw new AdminUsersError('invalid-response')
    let body: unknown
    try { body = await response.json() } catch (error) { if (controller.signal.aborted) throw error; throw new AdminUsersError('invalid-response') }
    if (!object(body) || body.code !== 0 || !Object.hasOwn(body, 'data')) throw new AdminUsersError('invalid-response')
    return body.data
  } catch (error) {
    if (error instanceof AdminUsersError) throw error
    if (controller.signal.aborted) throw new AdminUsersError(timedOut ? 'timeout' : 'cancelled')
    throw new AdminUsersError('network')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
export async function fetchAdminUsers(query: AdminUsersQuery, signal?: AbortSignal): Promise<AdminUsersPage> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) })
  for (const key of ['user', 'name', 'from', 'to'] as const) if (query[key]) params.set(key, query[key])
  const value = await read(`?${params}`, signal)
  if (!object(value) || !Array.isArray(value.items) || !count(value.total) || !Number.isSafeInteger(value.page) || Number(value.page) < 1 || Number(value.page) > 10000 || value.size !== query.size || ![5, 10, 20].includes(Number(value.size))) throw new AdminUsersError('invalid-response')
  const total = value.total as number, page = value.page as number, size = value.size as number
  if (page !== Math.min(query.page, Math.max(1, Math.ceil(total / size))) || value.items.length !== Math.min(size, Math.max(0, total - (page - 1) * size))) throw new AdminUsersError('invalid-response')
  const items = value.items.map(user)
  if (new Set(items.map(item => item.id)).size !== items.length) throw new AdminUsersError('invalid-response')
  return { items, total, page, size }
}
export async function fetchAdminUser(id: string, signal?: AbortSignal) {
  if (!isUserId(id)) throw new AdminUsersError('http', 422)
  const result = user(await read(`/${encodeURIComponent(id)}`, signal))
  if (result.id.toLowerCase() !== id.toLowerCase()) throw new AdminUsersError('invalid-response')
  return result
}
