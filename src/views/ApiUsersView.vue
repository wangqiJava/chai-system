<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TableState from '../components/TableState.vue'
import TablePagination from '../components/TablePagination.vue'
import { AdminUsersError, fetchAdminUser, fetchAdminUsers, isUserDate, isUserId, type AdminUser } from '../api/admin-users'

const route = useRoute()
const router = useRouter()
type Filters = { user: string; name: string; from: string; to: string }
const one = (key: string, fallback = '') => typeof route.query[key] === 'string' ? String(route.query[key]) : fallback
const filters = computed<Filters>(() => ({ user: one('user').trim().toLowerCase(), name: one('name').trim(), from: one('from'), to: one('to') }))
const page = computed(() => Number(one('page', '1')))
const size = computed(() => Number(one('size', '10')))
const selectedId = computed(() => one('uid').toLowerCase())
const draft = reactive<Filters>({ user: '', name: '', from: '', to: '' })
const rows = ref<AdminUser[]>([])
const total = ref<number | null>(null)
const loading = ref(false)
const listError = ref('')
const formError = ref('')
const detail = ref<AdminUser | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
let listController: AbortController | undefined
let detailController: AbortController | undefined
let listGeneration = 0
let detailGeneration = 0
let disposed = false

function validate(values: Filters) {
  if (values.user.trim() && !isUserId(values.user.trim())) return '请输入完整的 UUID 用户 ID。'
  if (Array.from(values.name.trim()).length > 64 || Array.from(values.name).some(char => { const code = char.codePointAt(0)!; return code < 32 || (code >= 127 && code <= 159) })) return '昵称最多 64 个字符，不能包含控制字符。'
  if (values.from && !isUserDate(values.from) || values.to && !isUserDate(values.to)) return '请输入有效的注册日期。'
  if (values.from && values.to && values.from > values.to) return '开始日期不能晚于结束日期。'
  return ''
}
function queryError() {
  if (['user', 'name', 'from', 'to', 'page', 'size', 'uid'].some(key => Array.isArray(route.query[key]))) return '地址中包含重复参数，请重置筛选。'
  if (!/^[1-9][0-9]{0,4}$/.test(one('page', '1')) || page.value > 10000 || !['5', '10', '20'].includes(one('size', '10'))) return '分页参数无效，请重置筛选。'
  return validate(filters.value)
}
async function unauthenticated() {
  rows.value = []
  total.value = null
  detail.value = null
  listController?.abort()
  detailController?.abort()
  await router.replace({ name: 'login', query: { redirect: route.fullPath, reason: 'expired' } }).catch(() => { listError.value = '会话已失效，请刷新页面重新登录。' })
}
async function loadList() {
  const generation = ++listGeneration
  listController?.abort()
  rows.value = []
  total.value = null
  listError.value = queryError()
  loading.value = false
  if (listError.value) return
  listController = new AbortController()
  loading.value = true
  try {
    const result = await fetchAdminUsers({ ...filters.value, page: page.value, size: size.value }, listController.signal)
    if (disposed || generation !== listGeneration) return
    rows.value = result.items
    total.value = result.total
    if (result.page !== page.value) await router.replace({ name: 'users', query: { ...route.query, page: String(result.page) } })
  } catch (error) {
    if (disposed || generation !== listGeneration || error instanceof AdminUsersError && error.kind === 'cancelled') return
    if (error instanceof AdminUsersError && error.status === 401) { await unauthenticated(); return }
    listError.value = error instanceof AdminUsersError ? error.message : '用户查询失败，请重试。'
  } finally { if (!disposed && generation === listGeneration) loading.value = false }
}
async function loadDetail() {
  const generation = ++detailGeneration
  detailController?.abort()
  detail.value = null
  detailError.value = ''
  detailLoading.value = false
  if (!selectedId.value) return
  if (!isUserId(selectedId.value)) { detailError.value = '用户 ID 无效，请关闭详情后重新查询。'; return }
  detailController = new AbortController()
  detailLoading.value = true
  try {
    const result = await fetchAdminUser(selectedId.value, detailController.signal)
    if (!disposed && generation === detailGeneration) detail.value = result
  } catch (error) {
    if (disposed || generation !== detailGeneration || error instanceof AdminUsersError && error.kind === 'cancelled') return
    if (error instanceof AdminUsersError && error.status === 401) { await unauthenticated(); return }
    detailError.value = error instanceof AdminUsersError ? error.message : '用户详情查询失败，请重试。'
  } finally { if (!disposed && generation === detailGeneration) detailLoading.value = false }
}
function buildQuery(values: Filters, nextPage = 1, nextSize = size.value) {
  const query: Record<string, string> = { page: String(nextPage), size: String([5, 10, 20].includes(nextSize) ? nextSize : 10) }
  for (const key of ['user', 'name', 'from', 'to'] as const) if (values[key].trim()) query[key] = key === 'user' ? values[key].trim().toLowerCase() : values[key].trim()
  return query
}
async function navigate(query: Record<string, string>) {
  const destination = { name: 'users', query }
  if (router.resolve(destination).fullPath === route.fullPath) await loadList()
  else await router.push(destination)
}
async function submitFilters() { formError.value = validate(draft); if (!formError.value) await navigate(buildQuery(draft)) }
async function resetFilters() { Object.assign(draft, { user: '', name: '', from: '', to: '' }); formError.value = ''; await navigate(buildQuery(draft)) }
function changePage(value: number, nextSize: number) { return navigate(buildQuery(filters.value, value, nextSize)) }
function openUser(id: string) { return router.push({ name: 'users', query: { ...route.query, uid: id } }) }
async function closeUser() {
  const id = selectedId.value
  const query = { ...route.query }; delete query.uid
  await router.replace({ name: 'users', query })
  await nextTick()
  ;(document.getElementById(`api-user-detail-${id}`) || document.getElementById('api-users-id'))?.focus()
}
const name = (user: AdminUser) => user.nickname || '未设置昵称'
const initial = (user: AdminUser) => Array.from(name(user))[0]
const time = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'UTC', hour12: false })

watch(() => JSON.stringify(['user', 'name', 'from', 'to', 'page', 'size'].map(key => route.query[key])), () => { Object.assign(draft, filters.value); formError.value = ''; void loadList() }, { immediate: true })
watch(() => route.query.uid, () => { void loadDetail() }, { immediate: true })
onBeforeUnmount(() => { disposed = true; ++listGeneration; ++detailGeneration; listController?.abort(); detailController?.abort(); rows.value = []; detail.value = null })
</script>

<template>
  <section class="business-page api-users" aria-labelledby="api-users-title">
    <div class="page-head"><div><h1 id="api-users-title" class="page-title">用户管理</h1><p class="page-desc">只读查询基本资料与关联数量；不展示财务明细，不提供修改、封禁或删除操作。</p></div><span class="tag tag-green">真实接口 · 只读</span></div>
    <div class="card query-card">
      <form class="filter-bar" aria-label="用户筛选" @submit.prevent="submitFilters">
        <div class="field query-field"><label class="field-label" for="api-users-id">用户 ID</label><input id="api-users-id" v-model="draft.user" class="input num" maxlength="36" placeholder="完整 UUID" aria-describedby="api-users-filter-error"></div>
        <div class="field query-field wide-field"><label class="field-label" for="api-users-name">昵称</label><input id="api-users-name" v-model="draft.name" class="input" maxlength="128" placeholder="昵称关键词" aria-describedby="api-users-filter-error"></div>
        <div class="field"><span class="field-label">注册日期（UTC）</span><div class="date-group"><label class="sr-only" for="api-users-from">注册开始日期</label><input id="api-users-from" v-model="draft.from" class="input" type="date" aria-describedby="api-users-filter-error"><span>至</span><label class="sr-only" for="api-users-to">注册结束日期</label><input id="api-users-to" v-model="draft.to" class="input" type="date" aria-describedby="api-users-filter-error"></div></div>
        <div class="filter-actions"><button id="api-users-query" class="btn btn-primary" type="submit" :disabled="loading"><AppIcon name="i-search" size="sm" />查询</button><button class="btn" type="button" @click="resetFilters">重置</button></div>
      </form>
      <p v-show="formError" id="api-users-filter-error" class="field-error filter-error" role="alert">{{ formError }}</p>
    </div>
    <div class="card table-card" :aria-busy="loading">
      <div class="table-toolbar"><span class="note">{{ loading ? '正在查询用户…' : total === null ? '查询尚未完成' : `共 ${total} 位可查询用户` }}</span><span v-if="hasFilters" class="tag tag-blue">已应用筛选</span><button class="btn btn-sm" type="button" :disabled="loading" @click="loadList">刷新列表</button></div>
      <div v-if="hasFilters" class="filter-chips"><span v-if="filters.user">用户 ID：{{ filters.user }}</span><span v-if="filters.name">昵称：{{ filters.name }}</span><span v-if="filters.from || filters.to">注册日期（UTC）：{{ filters.from || '不限' }} 至 {{ filters.to || '不限' }}</span></div>
      <div v-if="!loading && !listError && rows.length" class="table-wrap" role="region" aria-label="用户列表，可横向滚动查看全部列" tabindex="0"><table class="tbl users-table"><thead><tr><th scope="col">用户 ID</th><th scope="col">昵称</th><th scope="col">注册时间（UTC）</th><th scope="col" class="num-h">账本数</th><th scope="col" class="num-h">记账数</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody><tr v-for="user in rows" :key="user.id"><td><button class="row-link num api-user-id" type="button" @click="openUser(user.id)">{{ user.id }}</button></td><td><div class="user-cell"><span class="avatar avatar-sm" aria-hidden="true">{{ initial(user) }}</span><span class="api-user-name">{{ name(user) }}</span></div></td><td class="num">{{ time(user.createdAt) }}</td><td class="num-cell tnum">{{ user.ledgerCount }}</td><td class="num-cell tnum">{{ user.transactionCount }}</td><td class="op-cell"><button :id="`api-user-detail-${user.id}`" class="btn btn-text btn-sm" type="button" @click="openUser(user.id)">查看详情</button></td></tr></tbody></table></div>
      <TableState v-if="loading" state="loading" title="正在查询用户" description="通过管理员只读接口读取，不加载演示集合。" />
      <TableState v-else-if="listError" state="error" title="用户查询未完成" :description="listError" @retry="loadList" />
      <TableState v-else-if="!rows.length" :state="hasFilters ? 'noresult' : 'empty'" :title="hasFilters ? '未找到符合条件的用户' : '暂无可查询用户'" :description="hasFilters ? '请调整筛选条件，或清空筛选后重试。' : '接口返回空列表；已软删除用户不在查询范围。'" @reset="resetFilters" />
      <TablePagination v-if="total !== null" :page="page" :page-size="size" :total="total" :disabled="loading || Boolean(listError)" @change="changePage" />
      <p class="table-footnote">窄屏可横向滚动查看完整表格。仅计入未删除账本及其未删除流水，不代表全部历史记录。日期筛选包含结束日，所有资料时间均为 UTC；头像使用昵称占位，不加载外链。</p>
    </div>
    <AppDialog :model-value="Boolean(selectedId)" title="用户详情" variant="drawer" @update:model-value="closeUser">
      <TableState v-if="detailLoading" state="loading" title="正在读取用户详情" description="重新核验管理员会话并读取当前资料。" />
      <TableState v-else-if="detailError" state="error" title="无法读取用户详情" :description="detailError" @retry="loadDetail" />
      <div v-else-if="detail" class="api-user-detail">
        <div class="detail-user-head"><span class="avatar avatar-lg" aria-hidden="true">{{ initial(detail) }}</span><div><h3>{{ name(detail) }}</h3><span class="tag tag-gray">只读基本资料</span></div></div>
        <section class="d-section"><h3 class="d-section-title">基本资料</h3><dl class="desc-list"><dt>用户 ID</dt><dd class="num">{{ detail.id }}</dd><dt>昵称</dt><dd>{{ name(detail) }}</dd><dt>注册时间（UTC）</dt><dd>{{ time(detail.createdAt) }}</dd><dt>资料更新时间（UTC）</dt><dd>{{ time(detail.updatedAt) }}</dd><dt>未删除账本数</dt><dd>{{ detail.ledgerCount }}</dd><dt>有效记账数</dt><dd>{{ detail.transactionCount }}</dd></dl></section>
        <div class="api-user-related"><RouterLink class="btn btn-sm" :to="{ name: 'business-data', query: { tab: 'ledgers', user: detail.id } }">查看用户账本</RouterLink><RouterLink class="btn btn-sm" :to="{ name: 'business-data', query: { tab: 'records', user: detail.id } }">查看用户流水</RouterLink><RouterLink class="btn btn-sm" :to="{ name: 'business-data', query: { tab: 'budgets', user: detail.id } }">查看用户预算</RouterLink></div>
        <p class="detail-note">不返回 OpenID、UnionID、财务金额、预算金额和备注；不读取最近登录记录，不推断封禁状态。用户查询尚未接入业务访问审计，不能用登录审计替代。</p>
      </div>
    </AppDialog>
  </section>
</template>

<style scoped>
.api-user-id { max-width: 190px; text-align: left; white-space: normal; overflow-wrap: anywhere; }
.api-user-name { max-width: 180px; white-space: normal; overflow-wrap: anywhere; }
.api-users .avatar, .api-user-detail .avatar { flex-shrink: 0; background: var(--primary-light); color: var(--primary); }
.api-user-detail dd, .api-user-detail h3 { overflow-wrap: anywhere; }
.api-user-detail .desc-list { grid-template-columns: minmax(90px, 135px) minmax(0, 1fr); }
.api-users .filter-chips { overflow-wrap: anywhere; }
.api-user-related { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
@media (max-width: 768px) {
  .api-users .btn, .api-users .row-link { min-height: 44px; }
}
</style>
