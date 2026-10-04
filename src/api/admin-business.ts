import { isUserDate, isUserId } from './admin-users'

export interface AdminLedger { id: string; userId: string; userNickname: string | null; name: string; isDefault: boolean; createdAt: string; updatedAt: string; transactionCount: number }
export interface AdminTransaction { id: string; userId: string; userNickname: string | null; ledgerId: string; ledgerName: string; categoryId: string; categoryName: string | null; categoryStatus: 'active' | 'inactive' | 'deleted'; type: 'INCOME' | 'EXPENSE'; date: string; createdAt: string; updatedAt: string }
export interface AdminBudget { id: string; userId: string; userNickname: string | null; ledgerId: string; ledgerName: string; month: string; categoryId: string | null; categoryName: string | null; categoryStatus: 'total' | 'active' | 'inactive' | 'deleted'; createdAt: string; updatedAt: string }
export interface BusinessPage<T> { items: T[]; total: number; page: number; size: number }
export interface LedgerQuery { user?: string; keyword?: string; page: number; size: number }
export interface TransactionQuery { user?: string; ledger?: string; category?: string; type?: 'INCOME' | 'EXPENSE'; from?: string; to?: string; page: number; size: number }
export interface BudgetQuery { user?: string; ledger?: string; category?: string; month?: string; page: number; size: number }
type ErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'cancelled'

export class AdminBusinessError extends Error {
  constructor(public readonly kind: ErrorKind, public readonly status = 0) {
    const messages: Record<number, string> = { 401: '管理员会话已失效，请重新登录。', 403: '业务查询被拒绝，请核对权限与访问来源。', 404: '资源不存在、已删除或接口尚不可用。', 422: '筛选参数无效，请检查 ID、日期和分页。', 429: '查询过于频繁，请稍后重试。', 503: '业务查询暂不可用，请稍后重试。' }
    super(kind === 'http' ? messages[status] || '业务查询失败，请稍后重试。' : kind === 'timeout' ? '业务查询超时，请重试。' : kind === 'network' ? '无法连接业务查询服务，请检查网络。' : kind === 'cancelled' ? '查询已取消。' : '业务接口返回格式不正确，未展示该响应。')
    this.name = 'AdminBusinessError'
  }
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const text = (value: unknown): value is string => typeof value === 'string' && Array.from(value).length <= 64
const nullableText = (value: unknown) => value === null || text(value)
const uuid = (value: unknown) => typeof value === 'string' && isUserId(value)
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const fields = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key))
function ledger(value: unknown): AdminLedger {
  if (!object(value) || !fields(value, ['id', 'userId', 'userNickname', 'name', 'isDefault', 'createdAt', 'updatedAt', 'transactionCount']) || !uuid(value.id) || !uuid(value.userId) || !nullableText(value.userNickname) || !text(value.name) || typeof value.isDefault !== 'boolean' || !timestamp(value.createdAt) || !timestamp(value.updatedAt) || !count(value.transactionCount)) throw new AdminBusinessError('invalid-response')
  return value as unknown as AdminLedger
}
function transaction(value: unknown): AdminTransaction {
  if (!object(value) || !fields(value, ['id', 'userId', 'userNickname', 'ledgerId', 'ledgerName', 'categoryId', 'categoryName', 'categoryStatus', 'type', 'date', 'createdAt', 'updatedAt']) || !uuid(value.id) || !uuid(value.userId) || !uuid(value.ledgerId) || !uuid(value.categoryId) || !nullableText(value.userNickname) || !text(value.ledgerName) || !['active', 'inactive', 'deleted'].includes(String(value.categoryStatus)) || !(value.categoryStatus === 'deleted' ? value.categoryName === null : text(value.categoryName)) || !['INCOME', 'EXPENSE'].includes(String(value.type)) || typeof value.date !== 'string' || !isUserDate(value.date) || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) throw new AdminBusinessError('invalid-response')
  return value as unknown as AdminTransaction
}
function budget(value: unknown): AdminBudget {
  if (!object(value) || !fields(value, ['id', 'userId', 'userNickname', 'ledgerId', 'ledgerName', 'month', 'categoryId', 'categoryName', 'categoryStatus', 'createdAt', 'updatedAt']) || !uuid(value.id) || !uuid(value.userId) || !uuid(value.ledgerId) || !nullableText(value.userNickname) || !text(value.ledgerName) || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(value.month)) || !(value.categoryId === null || uuid(value.categoryId)) || !['total', 'active', 'inactive', 'deleted'].includes(String(value.categoryStatus)) || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) throw new AdminBusinessError('invalid-response')
  const categoryValid = value.categoryStatus === 'total' ? value.categoryId === null && value.categoryName === null : value.categoryStatus === 'deleted' ? value.categoryId !== null && value.categoryName === null : value.categoryId !== null && text(value.categoryName)
  if (!categoryValid) throw new AdminBusinessError('invalid-response')
  return value as unknown as AdminBudget
}
async function read(resource: 'ledgers' | 'transactions' | 'budgets', suffix: string, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new AdminBusinessError('cancelled')
  const controller = new AbortController()
  const abort = () => controller.abort()
  let timedOut = false
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10000)
  try {
    const response = await fetch(`/api/v1/admin/${resource}${suffix}`, { method: 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new AdminBusinessError('http', response.status)
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) throw new AdminBusinessError('invalid-response')
    let body: unknown
    try { body = await response.json() } catch (error) { if (controller.signal.aborted) throw error; throw new AdminBusinessError('invalid-response') }
    if (!object(body) || body.code !== 0 || !Object.hasOwn(body, 'data')) throw new AdminBusinessError('invalid-response')
    return body.data
  } catch (error) {
    if (error instanceof AdminBusinessError) throw error
    if (controller.signal.aborted) throw new AdminBusinessError(timedOut ? 'timeout' : 'cancelled')
    throw new AdminBusinessError('network')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
async function list<T extends { id: string }>(resource: 'ledgers' | 'transactions' | 'budgets', query: LedgerQuery | TransactionQuery | BudgetQuery, parse: (value: unknown) => T, signal?: AbortSignal): Promise<BusinessPage<T>> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value))
  const value = await read(resource, `?${params}`, signal)
  if (!object(value) || !fields(value, ['items', 'total', 'page', 'size']) || !Array.isArray(value.items) || !count(value.total) || !Number.isSafeInteger(value.page) || Number(value.page) < 1 || Number(value.page) > 10000 || value.size !== query.size || ![5, 10, 20].includes(Number(value.size))) throw new AdminBusinessError('invalid-response')
  const total = value.total as number, page = value.page as number, size = value.size as number
  if (page !== Math.min(query.page, Math.max(1, Math.ceil(total / size))) || value.items.length !== Math.min(size, Math.max(0, total - (page - 1) * size))) throw new AdminBusinessError('invalid-response')
  const items = value.items.map(parse)
  if (new Set(items.map(row => row.id)).size !== items.length) throw new AdminBusinessError('invalid-response')
  return { items, total, page, size }
}
async function detail<T extends { id: string }>(resource: 'ledgers' | 'transactions' | 'budgets', id: string, parse: (value: unknown) => T, signal?: AbortSignal) {
  if (!isUserId(id)) throw new AdminBusinessError('http', 422)
  const result = parse(await read(resource, `/${encodeURIComponent(id)}`, signal))
  if (result.id.toLowerCase() !== id.toLowerCase()) throw new AdminBusinessError('invalid-response')
  return result
}
export const fetchAdminLedgers = (query: LedgerQuery, signal?: AbortSignal) => list('ledgers', query, ledger, signal)
export const fetchAdminTransactions = (query: TransactionQuery, signal?: AbortSignal) => list('transactions', query, transaction, signal)
export const fetchAdminBudgets = (query: BudgetQuery, signal?: AbortSignal) => list('budgets', query, budget, signal)
export const fetchAdminLedger = (id: string, signal?: AbortSignal) => detail('ledgers', id, ledger, signal)
export const fetchAdminTransaction = (id: string, signal?: AbortSignal) => detail('transactions', id, transaction, signal)
export const fetchAdminBudget = (id: string, signal?: AbortSignal) => detail('budgets', id, budget, signal)
