export interface AdminOverview { status: 'ok'; checkedAt: string; counts: { users: number; ledgers: number; transactions: number; budgets: number; categories: number } }
export interface AdminOverviewTrendPoint { date: string; users: number; ledgers: number; transactions: number; budgets: number; categories: number }
export interface AdminOverviewTrend { status: 'ok'; checkedAt: string; days: 7 | 30; startDate: string; endDate: string; series: AdminOverviewTrendPoint[] }
type ErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'cancelled'

export class AdminOverviewError extends Error {
  constructor(public readonly kind: ErrorKind, public readonly status = 0) {
    const messages: Record<number, string> = { 401: '管理员会话已失效，请重新登录。', 403: '业务概览查询被拒绝，请核对权限与访问来源。', 404: '业务概览接口尚不可用，请检查后端版本或代理配置。', 429: '查询过于频繁，请稍后重试。', 503: '业务概览暂不可用，请稍后重试。' }
    super(kind === 'http' ? messages[status] || '业务概览查询失败，请稍后重试。' : kind === 'timeout' ? '业务概览查询超时，请重试。' : kind === 'network' ? '无法连接业务概览服务，请检查网络。' : kind === 'cancelled' ? '业务概览查询已取消。' : '业务概览响应格式不正确，未展示该响应。')
    this.name = 'AdminOverviewError'
  }
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const fields = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
function parse(value: unknown): AdminOverview {
  if (!object(value) || !fields(value, ['status', 'checkedAt', 'counts']) || value.status !== 'ok' || !timestamp(value.checkedAt) || !object(value.counts) || !fields(value.counts, ['users', 'ledgers', 'transactions', 'budgets', 'categories']) || !count(value.counts.users) || !count(value.counts.ledgers) || !count(value.counts.transactions) || !count(value.counts.budgets) || !count(value.counts.categories)) throw new AdminOverviewError('invalid-response')
  return value as unknown as AdminOverview
}

const dateOnly = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
function parseTrend(value: unknown): AdminOverviewTrend {
  if (!object(value) || !fields(value, ['status', 'checkedAt', 'days', 'startDate', 'endDate', 'series']) || value.status !== 'ok' || !timestamp(value.checkedAt) || ![7, 30].includes(Number(value.days)) || !dateOnly(value.startDate) || !dateOnly(value.endDate) || !Array.isArray(value.series) || value.series.length !== Number(value.days)) throw new AdminOverviewError('invalid-response')
  const series = value.series.map(item => {
    if (!object(item) || !fields(item, ['date', 'users', 'ledgers', 'transactions', 'budgets', 'categories']) || !dateOnly(item.date) || !count(item.users) || !count(item.ledgers) || !count(item.transactions) || !count(item.budgets) || !count(item.categories)) throw new AdminOverviewError('invalid-response')
    return item as unknown as AdminOverviewTrendPoint
  })
  return { status: 'ok', checkedAt: value.checkedAt, days: Number(value.days) as 7 | 30, startDate: value.startDate, endDate: value.endDate, series }
}

export async function fetchAdminOverview(signal?: AbortSignal): Promise<AdminOverview> {
  if (signal?.aborted) throw new AdminOverviewError('cancelled')
  const controller = new AbortController()
  const abort = () => controller.abort()
  let timedOut = false
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10000)
  try {
    const response = await fetch('/api/v1/admin/overview', { method: 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new AdminOverviewError('http', response.status)
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) throw new AdminOverviewError('invalid-response')
    let body: unknown
    try { body = await response.json() } catch (error) { if (controller.signal.aborted) throw error; throw new AdminOverviewError('invalid-response') }
    if (!object(body) || body.code !== 0 || !Object.hasOwn(body, 'data')) throw new AdminOverviewError('invalid-response')
    return parse(body.data)
  } catch (error) {
    if (error instanceof AdminOverviewError) throw error
    if (controller.signal.aborted) throw new AdminOverviewError(timedOut ? 'timeout' : 'cancelled')
    throw new AdminOverviewError('network')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}

export async function fetchAdminOverviewTrend(days: 7 | 30, signal?: AbortSignal): Promise<AdminOverviewTrend> {
  if (signal?.aborted) throw new AdminOverviewError('cancelled')
  const controller = new AbortController()
  const abort = () => controller.abort()
  let timedOut = false
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10000)
  try {
    const response = await fetch(`/api/v1/admin/overview/trend?days=${days}`, { method: 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new AdminOverviewError('http', response.status)
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) throw new AdminOverviewError('invalid-response')
    let body: unknown
    try { body = await response.json() } catch (error) { if (controller.signal.aborted) throw error; throw new AdminOverviewError('invalid-response') }
    if (!object(body) || body.code !== 0 || !Object.hasOwn(body, 'data')) throw new AdminOverviewError('invalid-response')
    return parseTrend(body.data)
  } catch (error) {
    if (error instanceof AdminOverviewError) throw error
    if (controller.signal.aborted) throw new AdminOverviewError(timedOut ? 'timeout' : 'cancelled')
    throw new AdminOverviewError('network')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
