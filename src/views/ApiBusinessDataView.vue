<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TableState from '../components/TableState.vue'
import TablePagination from '../components/TablePagination.vue'
import { isUserDate, isUserId } from '../api/admin-users'
import { AdminBusinessError, fetchAdminBudget, fetchAdminBudgets, fetchAdminLedger, fetchAdminLedgers, fetchAdminTransaction, fetchAdminTransactions, type AdminBudget, type AdminLedger, type AdminTransaction } from '../api/admin-business'

type Tab = 'ledgers' | 'records' | 'budgets'
type Filters = { user: string; keyword: string; ledger: string; type: string; category: string; from: string; to: string; month: string }
const route = useRoute(), router = useRouter()
const tabs: { key: Tab; label: string }[] = [{ key: 'ledgers', label: '账本' }, { key: 'records', label: '记账记录' }, { key: 'budgets', label: '预算' }]
const blank = (): Filters => ({ user: '', keyword: '', ledger: '', type: '', category: '', from: '', to: '', month: '' })
const one = (key: string, fallback = '') => typeof route.query[key] === 'string' ? String(route.query[key]) : fallback
const tab = computed<Tab>(() => tabs.some(item => item.key === one('tab', 'ledgers')) ? one('tab', 'ledgers') as Tab : 'ledgers')
const filters = computed<Filters>(() => ({ user: one('user').trim().toLowerCase(), keyword: tab.value === 'ledgers' ? one('keyword').trim() : '', ledger: tab.value !== 'ledgers' ? one('ledger').trim().toLowerCase() : '', type: tab.value === 'records' ? one('type') : '', category: tab.value !== 'ledgers' ? one('category').trim().toLowerCase() : '', from: tab.value === 'records' ? one('from') : '', to: tab.value === 'records' ? one('to') : '', month: tab.value === 'budgets' ? one('month') : '' }))
const page = computed(() => Number(one('page', '1'))), size = computed(() => Number(one('size', '10')))
const selectedId = computed(() => one(tab.value === 'ledgers' ? 'lid' : tab.value === 'records' ? 'rid' : 'bid').toLowerCase())
const draft = reactive<Filters>(blank())
const ledgerRows = ref<AdminLedger[]>([]), recordRows = ref<AdminTransaction[]>([]), budgetRows = ref<AdminBudget[]>([])
const ledgerDetail = ref<AdminLedger | null>(null), recordDetail = ref<AdminTransaction | null>(null), budgetDetail = ref<AdminBudget | null>(null)
const total = ref<number | null>(null), loading = ref(false), listError = ref(''), formError = ref('')
const detailLoading = ref(false), detailError = ref('')
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
let listController: AbortController | undefined, detailController: AbortController | undefined
let listGeneration = 0, detailGeneration = 0, disposed = false

function validate(values: Filters) {
  for (const [key, label] of [['user', '用户'], ['ledger', '账本'], ['category', '分类']] as const) if (values[key].trim() && !isUserId(values[key].trim())) return `${label} ID 须为完整 UUID。`
  if (Array.from(values.keyword.trim()).length > 64 || Array.from(values.keyword).some(char => { const code = char.codePointAt(0)!; return code < 32 || (code >= 127 && code <= 159) })) return '账本关键词最多 64 个字符，不能包含控制字符。'
  if (values.type && !['INCOME', 'EXPENSE'].includes(values.type)) return '收支类型无效。'
  if (values.from && !isUserDate(values.from) || values.to && !isUserDate(values.to)) return '请输入有效的记账日期。'
  if (values.from && values.to && values.from > values.to) return '开始日期不能晚于结束日期。'
  if (values.month && !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(values.month)) return '预算月份须为 YYYY-MM。'
  return ''
}
function queryError() {
  if (['tab', 'user', 'keyword', 'ledger', 'type', 'category', 'from', 'to', 'month', 'page', 'size', 'lid', 'rid', 'bid'].some(key => Array.isArray(route.query[key]))) return '地址包含重复参数，请重置筛选。'
  if (!tabs.some(item => item.key === one('tab', 'ledgers'))) return '查询标签无效，请重置筛选。'
  if (!/^[1-9][0-9]{0,4}$/.test(one('page', '1')) || page.value > 10000 || !['5', '10', '20'].includes(one('size', '10'))) return '分页参数无效，请重置筛选。'
  if (['lid', 'rid', 'bid'].filter(key => route.query[key]).length > 1) return '不能同时指定多种详情，请重新选择记录。'
  return validate(filters.value)
}
async function unauthenticated() {
  ledgerRows.value = []; recordRows.value = []; budgetRows.value = []; ledgerDetail.value = null; recordDetail.value = null; budgetDetail.value = null; total.value = null
  listController?.abort(); detailController?.abort()
  await router.replace({ name: 'login', query: { redirect: route.fullPath, reason: 'expired' } }).catch(() => { listError.value = '会话已失效，请刷新页面重新登录。' })
}
async function loadList() {
  const generation = ++listGeneration
  listController?.abort(); ledgerRows.value = []; recordRows.value = []; budgetRows.value = []; total.value = null; loading.value = false
  listError.value = queryError()
  if (listError.value) return
  listController = new AbortController(); loading.value = true
  try {
    const f = filters.value
    const result = tab.value === 'ledgers' ? await fetchAdminLedgers({ user: f.user, keyword: f.keyword, page: page.value, size: size.value }, listController.signal) : tab.value === 'records' ? await fetchAdminTransactions({ user: f.user, ledger: f.ledger, category: f.category, type: f.type as 'INCOME' | 'EXPENSE' | undefined, from: f.from, to: f.to, page: page.value, size: size.value }, listController.signal) : await fetchAdminBudgets({ user: f.user, ledger: f.ledger, category: f.category, month: f.month, page: page.value, size: size.value }, listController.signal)
    if (disposed || generation !== listGeneration) return
    if (tab.value === 'ledgers') ledgerRows.value = result.items as AdminLedger[]
    else if (tab.value === 'records') recordRows.value = result.items as AdminTransaction[]
    else budgetRows.value = result.items as AdminBudget[]
    total.value = result.total
    if (result.page !== page.value) await router.replace({ name: 'business-data', query: { ...route.query, page: String(result.page) } })
  } catch (error) {
    if (disposed || generation !== listGeneration || error instanceof AdminBusinessError && error.kind === 'cancelled') return
    if (error instanceof AdminBusinessError && error.status === 401) { await unauthenticated(); return }
    listError.value = error instanceof AdminBusinessError ? error.message : '业务查询失败，请重试。'
  } finally { if (!disposed && generation === listGeneration) loading.value = false }
}
async function loadDetail() {
  const generation = ++detailGeneration
  detailController?.abort(); ledgerDetail.value = null; recordDetail.value = null; budgetDetail.value = null; detailError.value = ''; detailLoading.value = false
  if (!selectedId.value) return
  detailError.value = queryError() || (!isUserId(selectedId.value) ? '详情 ID 无效，请关闭后重新选择。' : '')
  if (detailError.value) return
  detailController = new AbortController(); detailLoading.value = true
  try {
    const result = tab.value === 'ledgers' ? await fetchAdminLedger(selectedId.value, detailController.signal) : tab.value === 'records' ? await fetchAdminTransaction(selectedId.value, detailController.signal) : await fetchAdminBudget(selectedId.value, detailController.signal)
    if (disposed || generation !== detailGeneration) return
    if (filters.value.user && result.userId.toLowerCase() !== filters.value.user || tab.value !== 'ledgers' && filters.value.ledger && (result as AdminTransaction | AdminBudget).ledgerId.toLowerCase() !== filters.value.ledger) throw new AdminBusinessError('http', 404)
    if (tab.value === 'ledgers') ledgerDetail.value = result as AdminLedger
    else if (tab.value === 'records') recordDetail.value = result as AdminTransaction
    else budgetDetail.value = result as AdminBudget
  } catch (error) {
    if (disposed || generation !== detailGeneration || error instanceof AdminBusinessError && error.kind === 'cancelled') return
    if (error instanceof AdminBusinessError && error.status === 401) { await unauthenticated(); return }
    detailError.value = error instanceof AdminBusinessError ? error.message : '业务详情读取失败，请重试。'
  } finally { if (!disposed && generation === detailGeneration) detailLoading.value = false }
}
function buildQuery(values: Filters, nextTab: Tab = tab.value, nextPage = 1, nextSize = size.value) {
  const query: Record<string, string> = { tab: nextTab, page: String(nextPage), size: String([5, 10, 20].includes(nextSize) ? nextSize : 10) }
  const keys: (keyof Filters)[] = nextTab === 'ledgers' ? ['user', 'keyword'] : nextTab === 'records' ? ['user', 'ledger', 'type', 'category', 'from', 'to'] : ['user', 'ledger', 'category', 'month']
  for (const key of keys) if (values[key].trim()) query[key] = ['user', 'ledger', 'category'].includes(key) ? values[key].trim().toLowerCase() : values[key].trim()
  return query
}
async function navigate(query: Record<string, string>) { const to = { name: 'business-data', query }; if (router.resolve(to).fullPath === route.fullPath) await loadList(); else await router.push(to) }
async function submitFilters() { formError.value = validate(draft); if (!formError.value) await navigate(buildQuery(draft)) }
async function resetFilters() { Object.assign(draft, blank()); formError.value = ''; await navigate(buildQuery(draft)) }
function changePage(value: number, nextSize: number) { return navigate(buildQuery(filters.value, tab.value, value, nextSize)) }
async function switchTab(value: Tab) { await navigate(buildQuery({ ...blank(), user: filters.value.user }, value)); await nextTick(); document.getElementById(`api-biz-tab-${value}`)?.focus() }
async function tabKey(event: KeyboardEvent, index: number) { const key = event.key; if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return; event.preventDefault(); await switchTab(tabs[key === 'Home' ? 0 : key === 'End' ? 2 : (index + (key === 'ArrowRight' ? 1 : 2)) % 3].key) }
function openDetail(id: string) { return router.push({ name: 'business-data', query: { ...route.query, [tab.value === 'ledgers' ? 'lid' : tab.value === 'records' ? 'rid' : 'bid']: id } }) }
async function closeDetail() { const id = selectedId.value; const query = { ...route.query }; delete query.lid; delete query.rid; delete query.bid; await router.replace({ name: 'business-data', query }); await loadList(); await nextTick(); (document.getElementById(`api-biz-detail-${id}`) || document.getElementById('api-biz-user'))?.focus() }
function viewRecords(row: AdminLedger) { return navigate(buildQuery({ ...blank(), user: row.userId, ledger: row.id }, 'records')) }
const userLink = (id: string) => ({ name: 'users', query: { user: id, uid: id } })
const ledgerLink = (row: AdminTransaction) => ({ name: 'business-data', query: { tab: 'ledgers', user: row.userId, lid: row.ledgerId } })
const budgetLedgerLink = (row: AdminBudget) => ({ name: 'business-data', query: { tab: 'ledgers', user: row.userId, lid: row.ledgerId } })
const time = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'UTC', hour12: false })
const typeLabel = (value: string) => value === 'INCOME' ? '收入' : value === 'EXPENSE' ? '支出' : value
const categoryLabel = (row: AdminTransaction) => row.categoryStatus === 'deleted' ? '已删除分类' : `${row.categoryName || '未命名分类'}${row.categoryStatus === 'inactive' ? '（已停用）' : ''}`
const budgetCategoryLabel = (row: AdminBudget) => row.categoryStatus === 'total' ? '总预算' : row.categoryStatus === 'deleted' ? '已删除分类' : `${row.categoryName || '未命名分类'}${row.categoryStatus === 'inactive' ? '（已停用）' : ''}`
const budgetOver = (row: AdminBudget) => row.remaining.startsWith('-')

watch(() => JSON.stringify(['tab', 'user', 'keyword', 'ledger', 'type', 'category', 'from', 'to', 'month', 'page', 'size'].map(key => route.query[key])), () => { Object.assign(draft, filters.value); formError.value = ''; void loadList() }, { immediate: true })
watch(() => JSON.stringify([route.query.tab, route.query.lid, route.query.rid, route.query.bid, route.query.user, route.query.ledger]), () => { void loadDetail() }, { immediate: true })
onBeforeUnmount(() => { disposed = true; ++listGeneration; ++detailGeneration; listController?.abort(); detailController?.abort(); ledgerRows.value = []; recordRows.value = []; budgetRows.value = []; ledgerDetail.value = null; recordDetail.value = null; budgetDetail.value = null })
</script>

<template>
  <section class="business-page api-business" aria-labelledby="api-biz-title">
    <div class="page-head"><div><h1 id="api-biz-title" class="page-title">业务数据查询</h1><p class="page-desc">只读查询账本、流水和预算基础信息；不提供任何业务修改操作。</p></div><span class="tag tag-green">真实接口 · 只读</span></div>
    <div class="card table-card">
      <div class="tabs" role="tablist" aria-label="业务数据类型"><button v-for="(item, index) in tabs" :id="`api-biz-tab-${item.key}`" :key="item.key" class="tab-item business-tab" :class="{ active: tab === item.key }" role="tab" type="button" :aria-selected="tab === item.key" :aria-controls="`api-biz-panel-${item.key}`" :tabindex="tab === item.key ? 0 : -1" @click="switchTab(item.key)" @keydown="tabKey($event, index)">{{ item.label }}</button></div>
      <div :id="`api-biz-panel-${tab}`" role="tabpanel" :aria-labelledby="`api-biz-tab-${tab}`" :aria-busy="loading">
          <div class="banner banner-warn sensitive-notice"><AppIcon name="i-eyeoff" /><span>流水金额和备注按管理员只读权限展示；账本余额和收支汇总不在接口响应中。本页没有解锁或导出功能，访问行为按敏感数据查看审计记录。</span></div>
          <form class="filter-bar" aria-label="业务数据筛选" @submit.prevent="submitFilters">
            <div class="field query-field"><label class="field-label" for="api-biz-user">用户 ID</label><input id="api-biz-user" v-model="draft.user" class="input num" maxlength="36" placeholder="完整 UUID" aria-describedby="api-biz-filter-error"></div>
            <div v-if="tab === 'ledgers'" class="field query-field wide-field"><label class="field-label" for="api-biz-keyword">账本名称</label><input id="api-biz-keyword" v-model="draft.keyword" class="input" maxlength="128" placeholder="名称关键词" aria-describedby="api-biz-filter-error"></div>
            <template v-else-if="tab === 'records'">
              <div class="field query-field"><label class="field-label" for="api-biz-ledger">账本 ID</label><input id="api-biz-ledger" v-model="draft.ledger" class="input num" maxlength="36" placeholder="完整 UUID" aria-describedby="api-biz-filter-error"></div>
              <div class="field query-field short-field"><label class="field-label" for="api-biz-type">收支类型</label><select id="api-biz-type" v-model="draft.type" class="select"><option value="">全部</option><option value="EXPENSE">支出</option><option value="INCOME">收入</option></select></div>
              <div class="field query-field"><label class="field-label" for="api-biz-category">分类 ID</label><input id="api-biz-category" v-model="draft.category" class="input num" maxlength="36" placeholder="完整 UUID" aria-describedby="api-biz-filter-error"></div>
              <div class="field"><span class="field-label">记账日期</span><div class="date-group"><label class="sr-only" for="api-biz-from">记账开始日期</label><input id="api-biz-from" v-model="draft.from" class="input" type="date" aria-describedby="api-biz-filter-error"><span>至</span><label class="sr-only" for="api-biz-to">记账结束日期</label><input id="api-biz-to" v-model="draft.to" class="input" type="date" aria-describedby="api-biz-filter-error"></div></div>
            </template>
            <template v-else>
              <div class="field query-field"><label class="field-label" for="api-biz-budget-ledger">账本 ID</label><input id="api-biz-budget-ledger" v-model="draft.ledger" class="input num" maxlength="36" placeholder="完整 UUID" aria-describedby="api-biz-filter-error"></div>
              <div class="field query-field"><label class="field-label" for="api-biz-budget-category">分类 ID</label><input id="api-biz-budget-category" v-model="draft.category" class="input num" maxlength="36" placeholder="可选 UUID" aria-describedby="api-biz-filter-error"></div>
              <div class="field query-field short-field"><label class="field-label" for="api-biz-month">预算月份</label><input id="api-biz-month" v-model="draft.month" class="input num" type="month" aria-describedby="api-biz-filter-error"></div>
            </template>
            <div class="filter-actions"><button class="btn btn-primary" type="submit" :disabled="loading"><AppIcon name="i-search" size="sm" />查询</button><button class="btn" type="button" @click="resetFilters">重置</button></div>
          </form>
          <p v-show="formError" id="api-biz-filter-error" class="field-error filter-error" role="alert">{{ formError }}</p>
          <div v-if="hasFilters" class="filter-chips" aria-label="已应用筛选"><span v-if="filters.user">用户 ID：{{ filters.user }}</span><span v-if="filters.keyword">账本名称：{{ filters.keyword }}</span><span v-if="filters.ledger">账本 ID：{{ filters.ledger }}</span><span v-if="filters.type">收支类型：{{ typeLabel(filters.type) }}</span><span v-if="filters.category">分类 ID：{{ filters.category }}</span><span v-if="filters.from || filters.to">记账日期：{{ filters.from || '不限' }} 至 {{ filters.to || '不限' }}</span><span v-if="filters.month">预算月份：{{ filters.month }}</span><button class="btn btn-text btn-sm filter-clear" type="button" @click="resetFilters">清除筛选</button></div>
          <div class="table-toolbar"><span class="note">{{ loading ? '正在查询…' : total === null ? '查询尚未完成' : `共 ${total} ${tab === 'ledgers' ? '本账本' : tab === 'records' ? '条记录' : '条预算'}` }}</span><span v-if="hasFilters" class="tag tag-blue">已应用筛选</span><button class="btn btn-sm" type="button" :disabled="loading" @click="loadList">刷新列表</button></div>
          <div v-if="!loading && !listError && total" class="table-wrap" role="region" aria-label="业务列表，可横向滚动查看全部列" tabindex="0">
            <table v-if="tab === 'ledgers'" class="tbl business-table api-ledgers-table"><thead><tr><th scope="col">账本 ID</th><th scope="col">所属用户</th><th scope="col">账本名称</th><th scope="col">默认账本</th><th scope="col">创建时间（UTC）</th><th scope="col" class="num-h">有效记账数</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody><tr v-for="row in ledgerRows" :key="row.id"><td><button class="row-link num biz-id" type="button" @click="openDetail(row.id)">{{ row.id }}</button></td><td><RouterLink :to="userLink(row.userId)" class="biz-name">{{ row.userNickname || '未设置昵称' }}</RouterLink><div class="num text-3 biz-id">{{ row.userId }}</div></td><td class="biz-name">{{ row.name || '未命名账本' }}</td><td>{{ row.isDefault ? '是' : '否' }}</td><td class="num">{{ time(row.createdAt) }}</td><td class="num-cell">{{ row.transactionCount }}</td><td class="op-cell"><button :id="`api-biz-detail-${row.id}`" class="btn btn-text btn-sm" type="button" @click="openDetail(row.id)">查看详情</button><button class="btn btn-text btn-sm" type="button" @click="viewRecords(row)">查看流水</button></td></tr></tbody></table>
            <table v-else-if="tab === 'records'" class="tbl business-table api-records-table"><thead><tr><th scope="col">记录 ID</th><th scope="col">所属用户</th><th scope="col">账本</th><th scope="col">收支类型</th><th scope="col">分类</th><th scope="col">金额</th><th scope="col">备注</th><th scope="col">记账日期</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody><tr v-for="row in recordRows" :key="row.id"><td><button class="row-link num biz-id" type="button" @click="openDetail(row.id)">{{ row.id }}</button></td><td><RouterLink :to="userLink(row.userId)" class="biz-name">{{ row.userNickname || '未设置昵称' }}</RouterLink></td><td><RouterLink :to="ledgerLink(row)" class="biz-name">{{ row.ledgerName || '未命名账本' }}</RouterLink></td><td><span class="tag" :class="row.type === 'INCOME' ? 'tag-green' : 'tag-orange'">{{ row.type === 'INCOME' ? '收入' : '支出' }}</span></td><td class="biz-name">{{ categoryLabel(row) }}</td><td class="money-cell num">¥ {{ row.amount }}</td><td class="remark-cell">{{ row.remark || '无备注' }}</td><td class="num">{{ row.date }}</td><td class="op-cell"><button :id="`api-biz-detail-${row.id}`" class="btn btn-text btn-sm" type="button" @click="openDetail(row.id)">查看详情</button></td></tr></tbody></table>
            <table v-else class="tbl business-table api-budget-table"><thead><tr><th scope="col">预算 ID</th><th scope="col">所属用户</th><th scope="col">账本</th><th scope="col">预算月份</th><th scope="col">预算范围</th><th scope="col">预算金额</th><th scope="col">已用</th><th scope="col">剩余</th><th scope="col">分类状态</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody><tr v-for="row in budgetRows" :key="row.id"><td><button class="row-link num biz-id" type="button" @click="openDetail(row.id)">{{ row.id }}</button></td><td><RouterLink :to="userLink(row.userId)" class="biz-name">{{ row.userNickname || '未设置昵称' }}</RouterLink></td><td><RouterLink :to="budgetLedgerLink(row)" class="biz-name">{{ row.ledgerName || '未命名账本' }}</RouterLink></td><td class="num">{{ row.month }}</td><td class="biz-name">{{ budgetCategoryLabel(row) }}</td><td class="money-cell num">¥ {{ row.amount }}</td><td class="money-cell num">¥ {{ row.spent }}</td><td class="money-cell num" :class="{ 'budget-over': budgetOver(row) }">¥ {{ row.remaining }}</td><td><span class="tag" :class="row.categoryStatus === 'active' ? 'tag-green' : row.categoryStatus === 'deleted' ? 'tag-red' : 'tag-gray'">{{ row.categoryStatus === 'total' ? '总预算' : row.categoryStatus === 'active' ? '启用' : row.categoryStatus === 'inactive' ? '停用' : '已删除' }}</span></td><td class="op-cell"><button :id="`api-biz-detail-${row.id}`" class="btn btn-text btn-sm" type="button" @click="openDetail(row.id)">查看详情</button></td></tr></tbody></table>
          </div>
          <TableState v-if="loading" state="loading" title="正在读取业务数据" description="仅通过管理员只读接口查询，不加载演示集合。" />
          <TableState v-else-if="listError" state="error" title="业务查询未完成" :description="listError" @retry="loadList" />
          <TableState v-else-if="!total" :state="hasFilters ? 'noresult' : 'empty'" :title="hasFilters ? '未找到符合条件的结果' : '暂无可查询数据'" description="仅展示未删除用户及未删除账本下的可查询记录。可调整筛选后重试。" @reset="resetFilters" />
          <TablePagination v-if="total !== null" :page="page" :page-size="size" :total="total" :disabled="loading || Boolean(listError)" @change="changePage" />
          <p class="table-footnote">宽表支持横向滚动。预算月份采用 YYYY-MM；创建及更新时间按 UTC 展示。预算金额、已用、剩余以及流水金额和备注均为服务端只读结果，账本余额与收支汇总仍不展示。</p>
      </div>
    </div>
    <AppDialog :model-value="Boolean(selectedId)" :title="tab === 'ledgers' ? '账本详情' : tab === 'records' ? '流水基础信息' : '预算基础信息'" variant="drawer" @update:model-value="closeDetail">
      <TableState v-if="detailLoading" state="loading" title="正在读取详情" description="重新核验管理员会话，仅读取当前基础资料。" />
      <TableState v-else-if="detailError" state="error" title="无法读取业务详情" :description="detailError" @retry="loadDetail" />
      <div v-else-if="ledgerDetail" class="biz-detail"><h3>{{ ledgerDetail.name || '未命名账本' }}</h3><dl class="desc-list"><dt>账本 ID</dt><dd class="num">{{ ledgerDetail.id }}</dd><dt>所属用户</dt><dd><RouterLink :to="userLink(ledgerDetail.userId)">{{ ledgerDetail.userNickname || '未设置昵称' }}</RouterLink></dd><dt>用户 ID</dt><dd class="num">{{ ledgerDetail.userId }}</dd><dt>默认账本</dt><dd>{{ ledgerDetail.isDefault ? '是' : '否' }}</dd><dt>有效记账数</dt><dd>{{ ledgerDetail.transactionCount }}</dd><dt>创建时间（UTC）</dt><dd>{{ time(ledgerDetail.createdAt) }}</dd><dt>更新时间（UTC）</dt><dd>{{ time(ledgerDetail.updatedAt) }}</dd></dl><button class="btn btn-primary" type="button" @click="viewRecords(ledgerDetail)">查看该账本流水</button></div>
      <div v-else-if="recordDetail" class="biz-detail"><dl class="desc-list"><dt>记录 ID</dt><dd class="num">{{ recordDetail.id }}</dd><dt>所属用户</dt><dd><RouterLink :to="userLink(recordDetail.userId)">{{ recordDetail.userNickname || '未设置昵称' }}</RouterLink></dd><dt>用户 ID</dt><dd class="num">{{ recordDetail.userId }}</dd><dt>账本</dt><dd><RouterLink :to="ledgerLink(recordDetail)">{{ recordDetail.ledgerName || '未命名账本' }}</RouterLink></dd><dt>账本 ID</dt><dd class="num">{{ recordDetail.ledgerId }}</dd><dt>收支类型</dt><dd>{{ recordDetail.type === 'INCOME' ? '收入' : '支出' }}</dd><dt>分类</dt><dd>{{ categoryLabel(recordDetail) }}</dd><dt>分类 ID</dt><dd class="num">{{ recordDetail.categoryId }}</dd><dt>金额</dt><dd class="money-cell num">¥ {{ recordDetail.amount }}</dd><dt>备注</dt><dd class="remark-cell">{{ recordDetail.remark || '无备注' }}</dd><dt>记账日期</dt><dd>{{ recordDetail.date }}</dd><dt>创建时间（UTC）</dt><dd>{{ time(recordDetail.createdAt) }}</dd><dt>更新时间（UTC）</dt><dd>{{ time(recordDetail.updatedAt) }}</dd></dl></div>
      <div v-else-if="budgetDetail" class="biz-detail"><dl class="desc-list"><dt>预算 ID</dt><dd class="num">{{ budgetDetail.id }}</dd><dt>所属用户</dt><dd><RouterLink :to="userLink(budgetDetail.userId)">{{ budgetDetail.userNickname || '未设置昵称' }}</RouterLink></dd><dt>用户 ID</dt><dd class="num">{{ budgetDetail.userId }}</dd><dt>账本</dt><dd><RouterLink :to="budgetLedgerLink(budgetDetail)">{{ budgetDetail.ledgerName || '未命名账本' }}</RouterLink></dd><dt>账本 ID</dt><dd class="num">{{ budgetDetail.ledgerId }}</dd><dt>预算月份</dt><dd class="num">{{ budgetDetail.month }}</dd><dt>预算范围</dt><dd>{{ budgetCategoryLabel(budgetDetail) }}</dd><dt>分类 ID</dt><dd class="num">{{ budgetDetail.categoryId || '总预算' }}</dd><dt>分类状态</dt><dd>{{ budgetDetail.categoryStatus === 'total' ? '总预算' : budgetDetail.categoryStatus === 'active' ? '启用' : budgetDetail.categoryStatus === 'inactive' ? '停用' : '已删除' }}</dd><dt>预算金额</dt><dd class="num">¥ {{ budgetDetail.amount }}</dd><dt>已用</dt><dd class="num">¥ {{ budgetDetail.spent }}</dd><dt>剩余</dt><dd class="num" :class="{ 'budget-over': budgetOver(budgetDetail) }">¥ {{ budgetDetail.remaining }}</dd><dt>创建时间（UTC）</dt><dd>{{ time(budgetDetail.createdAt) }}</dd><dt>更新时间（UTC）</dt><dd>{{ time(budgetDetail.updatedAt) }}</dd></dl></div>
      <p v-if="ledgerDetail || recordDetail || budgetDetail" class="detail-note">预算金额、已用、剩余以及流水金额和备注仅按服务端只读结果展示；账本余额与收支汇总仍不提供。没有敏感数据解锁、导出或业务修改。</p>
    </AppDialog>
  </section>
</template>

<style scoped>
.api-business .page-head > .tag { flex-shrink: 0; }
.api-business .table-wrap { max-width: 100%; }
.api-ledgers-table { min-width: 1100px; }
.api-records-table { min-width: 1160px; }
.api-budget-table { min-width: 1320px; }
.money-cell { white-space: nowrap; }
.remark-cell { max-width: 240px; white-space: pre-wrap; overflow-wrap: anywhere; }
.budget-over { color: var(--danger, #c2410c); font-weight: 600; }
.biz-id { max-width: 180px; white-space: normal; overflow-wrap: anywhere; text-align: left; }
.biz-name { max-width: 200px; white-space: normal; overflow-wrap: anywhere; }
.biz-detail h3, .biz-detail dd { overflow-wrap: anywhere; }
.biz-detail .desc-list { grid-template-columns: minmax(90px, 130px) minmax(0, 1fr); margin: 20px 0; }
.api-business .filter-chips { align-items: center; }
.api-business .filter-clear { margin-left: auto; }
@media (max-width: 768px) { .api-business .btn, .api-business .row-link, .api-business .tab-item { min-height: 44px; } .biz-detail .btn { min-height: 44px; } }
</style>
