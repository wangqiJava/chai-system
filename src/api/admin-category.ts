import { isUserId } from './admin-users'

export interface AdminCategory { id: string; userId: string | null; userNickname: string | null; ledgerId: string | null; ledgerName: string | null; name: string; icon: string | null; type: 'INCOME' | 'EXPENSE'; sort: number; isActive: boolean; isSystem: boolean; transactionCount: number; createdAt: string; updatedAt: string }
export interface CategoryPage { items: AdminCategory[]; total: number; page: number; size: number }
export interface CategoryQuery { scope: 'system' | 'custom'; user?: string; keyword?: string; ledger?: string; type?: 'INCOME' | 'EXPENSE'; status?: 'active' | 'inactive'; page: number; size: number }
export interface CreateCategoryInput { name: string; icon?: string; type: 'INCOME' | 'EXPENSE'; sort: number }
export interface UpdateCategoryInput { name?: string; icon?: string; sort?: number; isActive?: boolean }
type ErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response' | 'cancelled'

export class AdminCategoryError extends Error {
  constructor(public readonly kind: ErrorKind, public readonly status = 0) {
    const messages: Record<number, string> = { 401: '管理员会话已失效，请重新登录。', 403: '分类管理被拒绝，请核对权限与访问来源。', 404: '分类不存在、已删除或接口尚不可用。', 409: '分类状态或名称冲突，请刷新后重试。', 422: '分类参数无效，请检查名称、类型和排序。', 429: '操作过于频繁，请稍后重试。', 503: '分类服务暂不可用，请稍后重试。' }
    super(kind === 'http' ? messages[status] || '分类操作失败，请稍后重试。' : kind === 'timeout' ? '分类请求超时，请重试。' : kind === 'network' ? '无法连接分类服务，请检查网络。' : kind === 'cancelled' ? '分类请求已取消。' : '分类接口返回格式不正确，未展示该响应。')
    this.name = 'AdminCategoryError'
  }
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
const uuid = (value: unknown) => value === null || typeof value === 'string' && isUserId(value)
const text = (value: unknown) => value === null || typeof value === 'string' && Array.from(value).length <= 128
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const fields = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key))
function parseCategory(value: unknown): AdminCategory {
  if (!object(value) || !fields(value, ['id', 'userId', 'userNickname', 'ledgerId', 'ledgerName', 'name', 'icon', 'type', 'sort', 'isActive', 'isSystem', 'transactionCount', 'createdAt', 'updatedAt']) || !uuid(value.id) || !uuid(value.userId) || !uuid(value.ledgerId) || !text(value.userNickname) || !text(value.ledgerName) || !text(value.icon) || typeof value.name !== 'string' || Array.from(value.name).length < 2 || Array.from(value.name).length > 64 || !['INCOME', 'EXPENSE'].includes(String(value.type)) || !Number.isInteger(value.sort) || Number(value.sort) < 1 || Number(value.sort) > 99 || typeof value.isActive !== 'boolean' || typeof value.isSystem !== 'boolean' || !count(value.transactionCount) || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) throw new AdminCategoryError('invalid-response')
  if (value.isSystem !== (value.userId === null && value.ledgerId === null)) throw new AdminCategoryError('invalid-response')
  return value as unknown as AdminCategory
}
async function request(method: 'GET' | 'POST' | 'PATCH', suffix: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new AdminCategoryError('cancelled')
  const controller = new AbortController(); const abort = () => controller.abort(); let timedOut = false
  signal?.addEventListener('abort', abort, { once: true }); const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10000)
  try {
    const response = await fetch(`/api/v1/admin/categories${suffix}`, { method, credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal })
    if (!response.ok) throw new AdminCategoryError('http', response.status)
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) throw new AdminCategoryError('invalid-response')
    let envelope: unknown
    try { envelope = await response.json() } catch { throw new AdminCategoryError('invalid-response') }
    if (!object(envelope) || envelope.code !== 0 || !Object.hasOwn(envelope, 'data')) throw new AdminCategoryError('invalid-response')
    return envelope.data
  } catch (error) {
    if (error instanceof AdminCategoryError) throw error
    if (controller.signal.aborted) throw new AdminCategoryError(timedOut ? 'timeout' : 'cancelled')
    throw new AdminCategoryError('network')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
export async function fetchAdminCategories(query: CategoryQuery, signal?: AbortSignal): Promise<CategoryPage> {
  const params = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value))
  const value = await request('GET', `?${params}`, undefined, signal)
  if (!object(value) || !fields(value, ['items', 'total', 'page', 'size']) || !Array.isArray(value.items) || !count(value.total) || !Number.isSafeInteger(value.page) || Number(value.page) < 1 || Number(value.page) > 10000 || ![5, 10, 20].includes(Number(value.size)) || Number(value.size) !== query.size) throw new AdminCategoryError('invalid-response')
  const total = value.total as number, page = value.page as number, size = value.size as number
  if (page !== Math.min(query.page, Math.max(1, Math.ceil(total / size))) || value.items.length !== Math.min(size, Math.max(0, total - (page - 1) * size))) throw new AdminCategoryError('invalid-response')
  const items = value.items.map(parseCategory); if (new Set(items.map(item => item.id)).size !== items.length) throw new AdminCategoryError('invalid-response')
  return { items, total, page, size }
}
export async function fetchAdminCategory(id: string, signal?: AbortSignal) { if (!isUserId(id)) throw new AdminCategoryError('http', 422); const value = parseCategory(await request('GET', `/${encodeURIComponent(id)}`, undefined, signal)); if (value.id.toLowerCase() !== id.toLowerCase()) throw new AdminCategoryError('invalid-response'); return value }
export async function createAdminCategory(input: CreateCategoryInput, signal?: AbortSignal) { return parseCategory(await request('POST', '', input, signal)) }
export async function updateAdminCategory(id: string, input: UpdateCategoryInput, signal?: AbortSignal) { if (!isUserId(id)) throw new AdminCategoryError('http', 422); return parseCategory(await request('PATCH', `/${encodeURIComponent(id)}`, input, signal)) }
