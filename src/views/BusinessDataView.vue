<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TableState from '../components/TableState.vue'
import TablePagination from '../components/TablePagination.vue'
import { categories, dateRangeError, loadDemoBusiness, money, pageNumber, pageSizeNumber, queryText, type BusinessData, type BusinessTab } from '../data/business'

const route = useRoute()
const router = useRouter()
const data = ref<BusinessData | null>(null)
const loading = ref(false)
const loadError = ref('')
const formError = ref('')
const draft = reactive({ user: '', keyword: '', ledger: '', type: '', category: '', from: '', to: '', month: '' })
const tabs: { key: BusinessTab; label: string }[] = [{ key: 'ledgers', label: '账本' }, { key: 'records', label: '记账记录' }, { key: 'budgets', label: '预算' }]
const tab = computed<BusinessTab>(() => route.query.tab === 'records' || route.query.tab === 'budgets' ? route.query.tab : 'ledgers')
const filters = computed(() => ({
  user: queryText(route.query.user).toUpperCase(),
  keyword: tab.value === 'ledgers' ? queryText(route.query.keyword) : '',
  ledger: tab.value !== 'ledgers' ? queryText(route.query.ledger).toUpperCase() : '',
  type: tab.value === 'records' ? queryText(route.query.type) : '',
  category: tab.value === 'records' ? queryText(route.query.category) : '',
  from: tab.value === 'records' ? queryText(route.query.from) : '',
  to: tab.value === 'records' ? queryText(route.query.to) : '',
  month: tab.value === 'budgets' ? queryText(route.query.month) : '',
}))
const pageSize = computed(() => pageSizeNumber(route.query.size))
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
const appliedError = computed(() => validate(filters.value))
const ledgers = computed(() => (data.value?.ledgers || []).filter(ledger => (!filters.value.user || ledger.userId.includes(filters.value.user)) && (!filters.value.keyword || `${ledger.name} ${ledger.id}`.toLowerCase().includes(filters.value.keyword.toLowerCase()))))
const records = computed(() => appliedError.value ? [] : (data.value?.records || []).filter(record => {
  const f = filters.value
  return (!f.user || record.userId.includes(f.user)) && (!f.ledger || record.ledgerId === f.ledger) && (!f.type || record.type === f.type) && (!f.category || record.category === f.category) && (!f.from || record.date >= f.from) && (!f.to || record.date <= f.to)
}))
const budgets = computed(() => appliedError.value ? [] : (data.value?.budgets || []).filter(budget => (!filters.value.user || budget.userId.includes(filters.value.user)) && (!filters.value.ledger || budget.ledgerId === filters.value.ledger) && (!filters.value.month || budget.month === filters.value.month)))
const total = computed(() => tab.value === 'ledgers' ? ledgers.value.length : tab.value === 'records' ? records.value.length : budgets.value.length)
const page = computed(() => Math.min(pageNumber(route.query.page), Math.max(1, Math.ceil(total.value / pageSize.value))))
const offset = computed(() => (page.value - 1) * pageSize.value)
const ledgerRows = computed(() => ledgers.value.slice(offset.value, offset.value + pageSize.value))
const recordRows = computed(() => records.value.slice(offset.value, offset.value + pageSize.value))
const budgetRows = computed(() => budgets.value.slice(offset.value, offset.value + pageSize.value))
const revealed = ref(new Set<string>())
const pending = ref<{ kind: 'records' | 'budgets'; id: string; version: number } | null>(null)
const purpose = ref('')
const reason = ref('')
const authError = ref('')
const announcement = ref('')
let version = 0
let controller: AbortController | undefined

function userName(id: string) { return data.value?.users.find(user => user.id === id)?.name || id }
function ledgerName(id: string) { return data.value?.ledgers.find(ledger => ledger.id === id)?.name || id }
function keyFor(kind: string, id: string) { return `${kind}:${id}` }
function isShown(kind: string, id: string) { return revealed.value.has(keyFor(kind, id)) }
function validate(value: typeof draft) {
  if (tab.value === 'records') {
    if (value.type && !['收入', '支出'].includes(value.type)) return '不支持该收支类型，请重新选择'
    return dateRangeError(value.from, value.to)
  }
  if (tab.value === 'budgets' && value.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month)) return '请选择有效的预算月份'
  return ''
}

function hideAll() { version++; revealed.value = new Set(); pending.value = null; purpose.value = ''; reason.value = ''; authError.value = ''; announcement.value = '' }
function visibilityChanged() { if (document.hidden) hideAll() }
function restoredPage(event: PageTransitionEvent) { if (event.persisted) hideAll() }

async function load() {
  hideAll()
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  loadError.value = ''
  try { data.value = await loadDemoBusiness(request.signal) } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    loadError.value = '业务演示数据加载失败，请重试。'
  } finally { if (!request.signal.aborted) loading.value = false }
}

function queryFor(values: typeof draft, nextPage = 1, size = pageSize.value) {
  const query: Record<string, string> = { tab: tab.value, page: String(nextPage), size: String(size) }
  const allowed = tab.value === 'ledgers' ? ['user', 'keyword'] : tab.value === 'records' ? ['user', 'ledger', 'type', 'category', 'from', 'to'] : ['user', 'ledger', 'month']
  for (const field of allowed) {
    const value = values[field as keyof typeof values].trim()
    if (value) query[field] = field === 'user' || field === 'ledger' ? value.toUpperCase() : value
  }
  return query
}

async function navigate(query: Record<string, string>) {
  hideAll()
  const destination = { name: 'business-data', query }
  if (router.resolve(destination).fullPath === route.fullPath) await load()
  else await router.push(destination)
}

async function submitFilters() {
  hideAll()
  formError.value = validate(draft)
  if (formError.value) { await nextTick(); document.getElementById(tab.value === 'budgets' ? 'business-month' : 'business-from')?.focus(); return }
  await navigate(queryFor(draft))
}
function resetFilters() {
  Object.assign(draft, { user: '', keyword: '', ledger: '', type: '', category: '', from: '', to: '', month: '' })
  formError.value = ''
  return navigate({ tab: tab.value, page: '1', size: String(pageSize.value) })
}
function changePage(value: number, size: number) { return navigate(queryFor(filters.value, value, size)) }
async function switchTab(value: BusinessTab) {
  if (value === tab.value) return
  const query: Record<string, string> = { tab: value, page: '1', size: String(pageSize.value) }
  if (filters.value.user) query.user = filters.value.user
  if (value !== 'ledgers' && filters.value.ledger) query.ledger = filters.value.ledger
  await navigate(query)
}
async function tabKey(event: KeyboardEvent, index: number) {
  let target = index
  if (event.key === 'ArrowRight') target = (index + 1) % tabs.length
  else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = tabs.length - 1
  else return
  event.preventDefault()
  await switchTab(tabs[target].key)
  await nextTick()
  document.getElementById(`business-tab-${tabs[target].key}`)?.focus()
}

function visibleTarget(kind: 'records' | 'budgets', id: string) {
  return !loading.value && !loadError.value && kind === tab.value && (kind === 'records' ? recordRows.value.some(row => row.id === id) : budgetRows.value.some(row => row.id === id))
}
function askReveal(kind: 'records' | 'budgets', id: string) {
  if (!visibleTarget(kind, id)) return
  if (isShown(kind, id)) { revealed.value.delete(keyFor(kind, id)); announcement.value = '已重新隐藏所选数据'; return }
  pending.value = { kind, id, version }
  purpose.value = ''; reason.value = ''; authError.value = ''
}
const targetDescription = computed(() => {
  const target = pending.value
  if (!target) return ''
  if (target.kind === 'records') {
    const record = data.value?.records.find(item => item.id === target.id)
    return record ? `${record.id} · ${userName(record.userId)}（${record.userId}）· ${ledgerName(record.ledgerId)} · ${record.date} · ${record.category}` : ''
  }
  const budget = data.value?.budgets.find(item => item.id === target.id)
  return budget ? `${userName(budget.userId)}（${budget.userId}）· ${ledgerName(budget.ledgerId)} · ${budget.month} · ${budget.category ? `${budget.category}分类预算` : '总预算'}` : ''
})
async function confirmReveal() {
  const target = pending.value
  if (!target || target.version !== version || !visibleTarget(target.kind, target.id)) { hideAll(); return }
  if (!purpose.value || (purpose.value === 'other' && !reason.value.trim())) {
    authError.value = purpose.value ? '请填写本次查看的用途说明' : '请选择本次查看用途'
    await nextTick(); document.getElementById(purpose.value ? 'reveal-reason' : 'reveal-purpose')?.focus(); return
  }
  revealed.value.add(keyFor(target.kind, target.id))
  pending.value = null; purpose.value = ''; reason.value = ''; authError.value = ''
  announcement.value = '已显示所选一条数据（演示），未执行真实鉴权或写入审计日志。'
}
function cancelReveal() { pending.value = null; purpose.value = ''; reason.value = ''; authError.value = '' }

watch(draft, hideAll, { deep: true, flush: 'sync' })
watch(() => route.fullPath, () => {
  Object.assign(draft, filters.value)
  if (dateRangeError(draft.from, '')) draft.from = ''
  if (dateRangeError('', draft.to)) draft.to = ''
  if (draft.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.month)) draft.month = ''
  formError.value = appliedError.value
  void load()
}, { immediate: true })
onMounted(() => { document.addEventListener('visibilitychange', visibilityChanged); window.addEventListener('pageshow', restoredPage) })
onBeforeUnmount(() => { controller?.abort(); hideAll(); document.removeEventListener('visibilitychange', visibilityChanged); window.removeEventListener('pageshow', restoredPage) })
</script>

<template>
  <section class="business-page" aria-labelledby="business-title">
    <div class="page-head"><div><h1 id="business-title" class="page-title">业务数据查询</h1><p class="page-desc">只读查询账本、记账记录与预算。当前仅使用演示样例，未接入管理接口。</p></div><button class="btn" type="button" :disabled="loading" @click="load"><AppIcon name="i-refresh" />刷新演示数据</button></div>
    <p class="sr-only" role="status">{{ announcement }}</p>
    <div class="card table-card">
      <div class="tabs" role="tablist" aria-label="业务数据类型"><button v-for="(item, index) in tabs" :id="`business-tab-${item.key}`" :key="item.key" class="tab-item business-tab" :class="{ active: tab === item.key }" role="tab" type="button" :aria-selected="tab === item.key" :aria-controls="`business-panel-${item.key}`" :tabindex="tab === item.key ? 0 : -1" @click="switchTab(item.key)" @keydown="tabKey($event, index)">{{ item.label }}</button></div>
      <div :id="`business-panel-${tab}`" role="tabpanel" :aria-labelledby="`business-tab-${tab}`" :aria-busy="loading">
        <div v-if="tab !== 'ledgers'" class="banner banner-warn sensitive-notice"><AppIcon name="i-eyeoff" /><span>金额{{ tab === 'records' ? '与备注' : '' }}默认隐藏。演示授权仅对当前一条生效；筛选、翻页、切换、刷新或离开页面后重新隐藏。</span></div>
        <form class="filter-bar" aria-label="业务数据筛选" @submit.prevent="submitFilters">
          <div v-if="tab === 'ledgers'" class="field query-field wide-field"><label class="field-label" for="ledger-keyword">账本名称 / ID</label><input id="ledger-keyword" v-model="draft.keyword" class="input" placeholder="搜索账本名称或 ID" maxlength="100"></div>
          <div class="field query-field"><label class="field-label" for="business-user">用户 ID</label><input id="business-user" v-model="draft.user" class="input num" placeholder="如 U10231" maxlength="100"></div>
          <div v-if="tab !== 'ledgers'" class="field query-field wide-field"><label class="field-label" for="business-ledger">账本</label><select id="business-ledger" v-model="draft.ledger" class="select"><option value="">全部账本</option><option v-if="draft.ledger && !data?.ledgers.some(item => item.id === draft.ledger)" :value="draft.ledger">{{ draft.ledger }}（无匹配样例）</option><option v-for="ledger in data?.ledgers || []" :key="ledger.id" :value="ledger.id">{{ ledger.name }}（{{ ledger.id }} · {{ ledger.userId }}）</option></select></div>
          <template v-if="tab === 'records'">
            <div class="field query-field short-field"><label class="field-label" for="business-type">收支类型</label><select id="business-type" v-model="draft.type" class="select"><option value="">全部</option><option>支出</option><option>收入</option></select></div>
            <div class="field query-field short-field"><label class="field-label" for="business-category">分类</label><select id="business-category" v-model="draft.category" class="select"><option value="">全部</option><option v-if="draft.category && !categories.includes(draft.category)">{{ draft.category }}</option><option v-for="category in categories" :key="category">{{ category }}</option></select></div>
            <div class="field"><span class="field-label">记账日期</span><div class="date-group"><label class="sr-only" for="business-from">记账开始日期</label><input id="business-from" v-model="draft.from" class="input" type="date" aria-describedby="business-filter-error"><span>至</span><label class="sr-only" for="business-to">记账结束日期</label><input id="business-to" v-model="draft.to" class="input" type="date" aria-describedby="business-filter-error"></div></div>
          </template>
          <div v-if="tab === 'budgets'" class="field query-field"><label class="field-label" for="business-month">月份</label><input id="business-month" v-model="draft.month" class="input" type="month" aria-describedby="business-filter-error"></div>
          <div class="filter-actions"><button class="btn btn-primary" type="submit" :disabled="loading"><AppIcon name="i-search" size="sm" />查询</button><button class="btn" type="button" @click="resetFilters">重置</button></div>
        </form>
        <p v-show="formError" id="business-filter-error" class="field-error filter-error" role="alert">{{ formError }}</p>
        <div class="table-toolbar"><span v-if="loading" class="note">正在加载业务样例…</span><span v-else class="note">共 {{ total }} {{ tab === 'ledgers' ? '本账本' : tab === 'records' ? '条记录' : '条预算' }} · 演示子集</span><span v-if="hasFilters" class="tag tag-blue">已应用筛选</span></div>
        <div v-if="hasFilters" class="filter-chips"><span v-if="filters.user">用户：{{ filters.user }}</span><span v-if="filters.keyword">账本关键词：{{ filters.keyword }}</span><span v-if="filters.ledger">账本：{{ filters.ledger }}</span><span v-if="filters.type">{{ filters.type }}</span><span v-if="filters.category">分类：{{ filters.category }}</span><span v-if="filters.from || filters.to">日期：{{ filters.from || '不限' }} 至 {{ filters.to || '不限' }}</span><span v-if="filters.month">月份：{{ filters.month }}</span></div>
        <div class="table-wrap">
          <table v-if="tab === 'ledgers'" class="tbl business-table"><thead><tr><th scope="col">账本 ID</th><th scope="col">名称</th><th scope="col">所属用户</th><th scope="col">默认账本</th><th scope="col" class="num-h">历史记录数</th><th scope="col">创建时间</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody v-if="!loading && !loadError"><tr v-for="ledger in ledgerRows" :key="ledger.id"><td class="num">{{ ledger.id }}</td><td>{{ ledger.name }}</td><td><RouterLink :to="{ name: 'users', query: { uid: ledger.userId } }">{{ userName(ledger.userId) }}</RouterLink><div class="cell-sub num">{{ ledger.userId }}</div></td><td><span v-if="ledger.isDefault" class="tag tag-blue">默认</span><span v-else class="text-3">—</span></td><td class="num-cell tnum">{{ ledger.historicalCount }}</td><td class="num">{{ ledger.createdAt }}</td><td class="op-cell"><RouterLink :to="{ name: 'business-data', query: { tab: 'records', user: ledger.userId, ledger: ledger.id } }">查看记录</RouterLink></td></tr></tbody></table>
          <table v-else-if="tab === 'records'" class="tbl business-table records-table"><thead><tr><th scope="col">记录 ID</th><th scope="col">所属用户</th><th scope="col">账本</th><th scope="col">收支类型</th><th scope="col">分类</th><th scope="col" class="num-h">金额（元）</th><th scope="col">备注</th><th scope="col">记账日期</th><th scope="col">创建时间</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody v-if="!loading && !loadError"><tr v-for="record in recordRows" :key="record.id"><td class="num">{{ record.id }}</td><td><RouterLink :to="{ name: 'users', query: { uid: record.userId } }">{{ userName(record.userId) }}</RouterLink><div class="cell-sub num">{{ record.userId }}</div></td><td>{{ ledgerName(record.ledgerId) }}<div class="cell-sub num">{{ record.ledgerId }}</div></td><td><span class="tag" :class="record.type === '支出' ? 'tag-red' : 'tag-green'">{{ record.type }}</span></td><td>{{ record.category }}</td><td class="amt-cell"><span v-if="isShown('records', record.id)" class="amt" :class="record.type === '支出' ? 'exp' : 'inc'">{{ record.type === '支出' ? '-' : '+' }}{{ money(record.amount) }}</span><span v-else class="amt masked" aria-label="记账金额已隐藏">•••••</span></td><td class="record-note"><span v-if="!record.note">—</span><span v-else-if="isShown('records', record.id)">{{ record.note }}</span><span v-else class="amt masked" aria-label="备注已隐藏">•••••</span></td><td class="num">{{ record.date }}</td><td class="num">{{ record.createdAt }}</td><td class="op-cell"><button :id="`reveal-records-${record.id}`" class="btn btn-text btn-sm" type="button" @click="askReveal('records', record.id)">{{ isShown('records', record.id) ? '重新隐藏' : '授权查看' }}</button></td></tr></tbody></table>
          <table v-else class="tbl business-table"><thead><tr><th scope="col">所属用户</th><th scope="col">账本</th><th scope="col">月份</th><th scope="col">预算类型</th><th scope="col" class="num-h">预算金额（元）</th><th scope="col">创建时间</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody v-if="!loading && !loadError"><tr v-for="budget in budgetRows" :key="budget.id"><td><RouterLink :to="{ name: 'users', query: { uid: budget.userId } }">{{ userName(budget.userId) }}</RouterLink><div class="cell-sub num">{{ budget.userId }}</div></td><td>{{ ledgerName(budget.ledgerId) }}<div class="cell-sub num">{{ budget.ledgerId }}</div></td><td class="num">{{ budget.month }}</td><td><span class="tag" :class="budget.category ? 'tag-gray' : 'tag-blue'">{{ budget.category ? `分类预算 · ${budget.category}` : '总预算' }}</span></td><td class="amt-cell"><span v-if="isShown('budgets', budget.id)" class="amt">{{ money(budget.amount) }}</span><span v-else class="amt masked" aria-label="预算金额已隐藏">•••••</span></td><td class="num">{{ budget.createdAt }}</td><td class="op-cell"><button :id="`reveal-budgets-${budget.id}`" class="btn btn-text btn-sm" type="button" @click="askReveal('budgets', budget.id)">{{ isShown('budgets', budget.id) ? '重新隐藏' : '授权查看' }}</button></td></tr></tbody></table>
        </div>
        <TableState v-if="loading" state="loading" /><TableState v-else-if="loadError" state="error" :description="loadError" @retry="load" /><TableState v-else-if="!total" :state="hasFilters ? 'noresult' : 'empty'" @reset="resetFilters" />
        <TablePagination :page="page" :page-size="pageSize" :total="total" :disabled="loading || Boolean(loadError)" @change="changePage" />
        <p class="table-footnote">{{ tab === 'ledgers' ? '历史记录数为演示汇总；流水查询只展示有限样例，不用于与全量历史汇总对账。' : '前端遮蔽仅用于演示。真实环境须在返回明文前完成服务端鉴权和审计，不可依赖隐藏按钮或前端状态。' }}</p>
      </div>
    </div>

    <AppDialog :model-value="Boolean(pending)" title="授权查看敏感信息" @update:model-value="cancelReveal">
      <p class="reveal-target">即将查看：<b>{{ targetDescription }}</b></p>
      <div class="field"><label class="field-label" for="reveal-purpose">查看用途<span class="req">*</span></label><select id="reveal-purpose" v-model="purpose" class="select" data-dialog-autofocus required aria-describedby="reveal-error" @change="authError = ''"><option value="">请选择本次查看用途</option><option value="feedback">排查用户反馈问题</option><option value="reconcile">数据核对</option><option value="audit">安全审计</option><option value="other">其他（请说明用途）</option></select></div>
      <div v-if="purpose === 'other'" class="field reveal-reason-field"><label class="field-label" for="reveal-reason">用途说明<span class="req">*</span></label><textarea id="reveal-reason" v-model="reason" class="input" rows="3" maxlength="200" placeholder="说明核查必要性，不填写个人敏感信息" aria-describedby="reveal-error" required></textarea></div>
      <p v-show="authError" id="reveal-error" class="field-error" role="alert">{{ authError }}</p>
      <div class="confirm-scope"><b>展示范围</b><br>仅显示所选的一条流水或预算，可随时重新隐藏。筛选、翻页、切换或刷新后清除显示状态。<br><br>当前是本地交互演示，不执行真实权限审批，也不写入审计日志；用途内容不会持久化。</div>
      <template #footer><button class="btn" type="button" @click="cancelReveal">取消</button><button class="btn btn-primary" type="button" @click="confirmReveal">确认授权查看</button></template>
    </AppDialog>
  </section>
</template>
