export type AuditType = '登录' | '数据查询' | '敏感数据查看' | '分类管理'
export type AuditResult = '成功' | '失败' | '限流'
export interface AdminAuditLog { time: string; admin: string; type: AuditType; target: string; result: AuditResult; requestId: string; summary: string }
export interface AdminAuditPage { items: AdminAuditLog[]; total: number; page: number; size: number }
export interface AdminAuditQuery { from?: string; to?: string; admin?: string; type?: AuditType; result?: AuditResult; request?: string; page: number; size: number }
type AuditErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'cancelled'

export class AdminAuditError extends Error {
  constructor(public readonly kind: AuditErrorKind, public readonly status = 0) {
    const messages: Record<number, string> = { 401: '管理员会话已失效，请重新登录。', 403: '操作日志查询被拒绝，请核对管理员权限与访问来源。', 422: '日志筛选参数无效，请检查日期、类型和分页。', 429: '查询过于频繁，请稍后重试。', 503: '操作日志暂不可用，请稍后重试。' }
    super(kind === 'http' ? messages[status] || '操作日志查询失败，请稍后重试。' : kind === 'timeout' ? '操作日志查询超时，请重试。' : kind === 'network' ? '无法连接操作日志服务，请检查网络。' : kind === 'cancelled' ? '查询已取消。' : '日志接口返回格式不正确，未展示该响应。')
    this.name = 'AdminAuditError'
  }
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function timestamp(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
function audit(value: unknown): AdminAuditLog {
  if (!object(value) || !timestamp(value.time) || typeof value.admin !== 'string' || !['登录', '数据查询', '敏感数据查看', '分类管理'].includes(String(value.type)) || typeof value.target !== 'string' || !['成功', '失败', '限流'].includes(String(value.result)) || typeof value.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.requestId) || typeof value.summary !== 'string') throw new AdminAuditError('invalid-response')
  return { time: value.time, admin: value.admin, type: value.type as AuditType, target: value.target, result: value.result as AuditResult, requestId: value.requestId, summary: value.summary }
}
async function read(path: string, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new AdminAuditError('cancelled')
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10000)
  try {
    const response = await fetch(`/api/v1/admin/audit-logs${path}`, { method: 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new AdminAuditError('http', response.status)
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) throw new AdminAuditError('invalid-response')
    let body: unknown
    try { body = await response.json() } catch (error) { if (controller.signal.aborted) throw error; throw new AdminAuditError('invalid-response') }
    if (!object(body) || body.code !== 0 || !Object.hasOwn(body, 'data')) throw new AdminAuditError('invalid-response')
    return body.data
  } catch (error) {
    if (error instanceof AdminAuditError) throw error
    if (controller.signal.aborted) throw new AdminAuditError(timedOut ? 'timeout' : 'cancelled')
    throw new AdminAuditError('network')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
export async function fetchAdminAudit(query: AdminAuditQuery, signal?: AbortSignal): Promise<AdminAuditPage> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) })
  for (const key of ['from', 'to', 'admin', 'type', 'result', 'request'] as const) if (query[key]) params.set(key, query[key])
  const value = await read(`?${params}`, signal)
  if (!object(value) || !Array.isArray(value.items) || !Number.isSafeInteger(value.total) || Number(value.total) < 0 || !Number.isSafeInteger(value.page) || Number(value.page) < 1 || value.size !== query.size || ![5, 10, 20].includes(Number(value.size))) throw new AdminAuditError('invalid-response')
  const items = value.items.map(audit)
  const total = value.total as number, page = value.page as number, size = value.size as number
  if (page !== Math.min(query.page, Math.max(1, Math.ceil(total / size)))) throw new AdminAuditError('invalid-response')
  return { items, total, page, size }
}
