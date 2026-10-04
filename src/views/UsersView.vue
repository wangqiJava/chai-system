<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TableState from '../components/TableState.vue'
import TablePagination from '../components/TablePagination.vue'
import { avatarColor, dateRangeError, loadDemoBusiness, pageNumber, pageSizeNumber, queryText, type BusinessData } from '../data/business'

const route = useRoute()
const router = useRouter()
const data = ref<BusinessData | null>(null)
const loading = ref(false)
const loadError = ref('')
const formError = ref('')
const draft = reactive({ user: '', name: '', from: '', to: '' })
let controller: AbortController | undefined
const filters = computed(() => ({ user: queryText(route.query.user).toUpperCase(), name: queryText(route.query.name), from: queryText(route.query.from), to: queryText(route.query.to) }))
const pageSize = computed(() => pageSizeNumber(route.query.size))
const appliedError = computed(() => dateRangeError(filters.value.from, filters.value.to))
const filtered = computed(() => {
  if (appliedError.value) return []
  const f = filters.value
  return (data.value?.users || []).filter(user => (!f.user || user.id.includes(f.user)) && (!f.name || user.name.toLowerCase().includes(f.name.toLowerCase())) && (!f.from || user.registeredAt.slice(0, 10) >= f.from) && (!f.to || user.registeredAt.slice(0, 10) <= f.to))
})
const page = computed(() => Math.min(pageNumber(route.query.page), Math.max(1, Math.ceil(filtered.value.length / pageSize.value))))
const rows = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
const selectedId = computed(() => queryText(route.query.uid).toUpperCase())
const selectedUser = computed(() => data.value?.users.find(user => user.id === selectedId.value))
const selectedLedgers = computed(() => ledgersFor(selectedId.value))
const selectedBudgets = computed(() => (data.value?.budgets || []).filter(budget => budget.userId === selectedId.value && !budget.category))
const recentRecords = computed(() => (data.value?.records || []).filter(record => record.userId === selectedId.value).slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 3))

function ledgersFor(userId: string) { return (data.value?.ledgers || []).filter(ledger => ledger.userId === userId) }
function historicalCount(userId: string) { return ledgersFor(userId).reduce((sum, ledger) => sum + ledger.historicalCount, 0).toLocaleString('zh-CN') }
function ledgerName(id: string) { return data.value?.ledgers.find(ledger => ledger.id === id)?.name || id }
function categoryBudgetCount(ledger: string, month: string) { return (data.value?.budgets || []).filter(budget => budget.ledgerId === ledger && budget.month === month && budget.category).length }

async function load() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  loadError.value = ''
  try { data.value = await loadDemoBusiness(request.signal) } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    loadError.value = '用户演示数据加载失败，请重试。'
  } finally { if (!request.signal.aborted) loading.value = false }
}

function queryFor(values: typeof draft, nextPage = 1, size = pageSize.value) {
  const query: Record<string, string> = { page: String(nextPage), size: String(size) }
  for (const [key, value] of Object.entries(values)) if (value.trim()) query[key] = key === 'user' ? value.trim().toUpperCase() : value.trim()
  return query
}

async function navigate(query: Record<string, string>) {
  const destination = { name: 'users', query }
  if (router.resolve(destination).fullPath === route.fullPath) await load()
  else await router.push(destination)
}

async function submitFilters() {
  formError.value = dateRangeError(draft.from, draft.to)
  if (formError.value) { await nextTick(); document.getElementById('users-from')?.focus(); return }
  await navigate(queryFor(draft))
}

function resetFilters() {
  Object.assign(draft, { user: '', name: '', from: '', to: '' })
  formError.value = ''
  return navigate({ page: '1', size: String(pageSize.value) })
}
function changePage(value: number, size: number) { return navigate(queryFor(filters.value, value, size)) }
function openUser(id: string) { return router.push({ name: 'users', query: { ...route.query, uid: id } }) }
function closeUser() { const query = { ...route.query }; delete query.uid; return router.replace({ name: 'users', query }) }

watch(() => JSON.stringify([route.query.user, route.query.name, route.query.from, route.query.to, route.query.page, route.query.size]), () => {
  Object.assign(draft, filters.value)
  if (dateRangeError(draft.from, '')) draft.from = ''
  if (dateRangeError('', draft.to)) draft.to = ''
  formError.value = appliedError.value
  void load()
}, { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="business-page" aria-labelledby="users-title">
    <div class="page-head"><div><h1 id="users-title" class="page-title">用户管理</h1><p class="page-desc">查询用户基本信息与关联账本。当前为固定演示子集，个人财务明细默认隐藏。</p></div></div>
    <div class="card query-card">
      <form class="filter-bar" aria-label="用户筛选" @submit.prevent="submitFilters">
        <div class="field query-field"><label class="field-label" for="users-id">用户 ID</label><input id="users-id" v-model="draft.user" class="input num" maxlength="100" placeholder="如 U10231"></div>
        <div class="field query-field wide-field"><label class="field-label" for="users-name">昵称</label><input id="users-name" v-model="draft.name" class="input" maxlength="100" placeholder="搜索昵称关键词"></div>
        <div class="field"><span class="field-label">注册时间</span><div class="date-group"><label class="sr-only" for="users-from">注册开始日期</label><input id="users-from" v-model="draft.from" class="input" type="date" aria-describedby="users-filter-error"><span>至</span><label class="sr-only" for="users-to">注册结束日期</label><input id="users-to" v-model="draft.to" class="input" type="date" aria-describedby="users-filter-error"></div></div>
        <div class="filter-actions"><button class="btn btn-primary" type="submit" :disabled="loading"><AppIcon name="i-search" size="sm" />查询</button><button class="btn" type="button" @click="resetFilters">重置</button></div>
      </form>
      <p v-show="formError" id="users-filter-error" class="field-error filter-error" role="alert">{{ formError }}</p>
    </div>
    <div class="card table-card" :aria-busy="loading">
      <div class="table-toolbar"><span v-if="loading" class="note">正在加载用户样例…</span><span v-else class="note">共 {{ filtered.length }} 位用户 · 演示数据子集</span><span v-if="hasFilters" class="tag tag-blue">已应用筛选</span></div>
      <div v-if="hasFilters" class="filter-chips"><span v-if="filters.user">用户 ID：{{ filters.user }}</span><span v-if="filters.name">昵称：{{ filters.name }}</span><span v-if="filters.from || filters.to">注册时间：{{ filters.from || '不限' }} 至 {{ filters.to || '不限' }}</span></div>
      <div class="table-wrap"><table class="tbl users-table"><thead><tr><th scope="col">用户 ID</th><th scope="col">头像 / 昵称</th><th scope="col">注册时间</th><th scope="col" class="num-h">账本数</th><th scope="col" class="num-h">历史记账数</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody v-if="!loading && !loadError"><tr v-for="user in rows" :key="user.id"><td><button :id="`user-id-${user.id}`" class="row-link num" type="button" @click="openUser(user.id)">{{ user.id }}</button></td><td><div class="user-cell"><span class="avatar avatar-sm" :style="{ background: avatarColor(user.id) }" aria-hidden="true">{{ user.name.slice(0, 1) }}</span>{{ user.name }}</div></td><td class="num">{{ user.registeredAt }}</td><td class="num-cell tnum">{{ ledgersFor(user.id).length }}</td><td class="num-cell tnum">{{ historicalCount(user.id) }}</td><td class="op-cell"><button :id="`user-detail-${user.id}`" class="btn btn-text btn-sm" type="button" @click="openUser(user.id)">查看详情</button></td></tr></tbody></table></div>
      <TableState v-if="loading" state="loading" /><TableState v-else-if="loadError" state="error" :description="loadError" @retry="load" /><TableState v-else-if="!filtered.length" :state="hasFilters ? 'noresult' : 'empty'" @reset="resetFilters" />
      <TablePagination :page="page" :page-size="pageSize" :total="filtered.length" :disabled="loading || Boolean(loadError)" @change="changePage" />
      <p class="table-footnote">历史记账数来自演示账本汇总；明细页仅提供部分样例，不代表全部历史记录。</p>
    </div>

    <AppDialog :model-value="Boolean(selectedId)" title="用户详情" variant="drawer" @update:model-value="closeUser">
      <TableState v-if="loading" state="loading" /><TableState v-else-if="loadError" state="error" @retry="load" />
      <template v-else-if="selectedUser">
        <div class="detail-user-head"><span class="avatar avatar-lg" :style="{ background: avatarColor(selectedUser.id) }" aria-hidden="true">{{ selectedUser.name.slice(0, 1) }}</span><div><h3>{{ selectedUser.name }}</h3><span class="num text-3">{{ selectedUser.id }}</span><span class="tag tag-gray">演示用户</span></div></div>
        <section class="d-section"><h3 class="d-section-title">基本资料</h3><dl class="desc-list"><dt>用户 ID</dt><dd class="num">{{ selectedUser.id }}</dd><dt>昵称</dt><dd>{{ selectedUser.name }}</dd><dt>注册时间</dt><dd class="num">{{ selectedUser.registeredAt }}</dd><dt>最近记账</dt><dd class="num">{{ selectedUser.lastRecordedAt }}</dd><dt>OpenID</dt><dd class="num">{{ selectedUser.maskedOpenId }}</dd></dl><p class="detail-note">OpenID 已脱敏。不提供完整标识复制或个人信息导出。</p></section>
        <section class="d-section"><h3 class="d-section-title">数据概况</h3><div class="mini-stats"><div class="mini-stat"><b>{{ selectedLedgers.length }}</b><span>账本数</span></div><div class="mini-stat"><b>{{ historicalCount(selectedUser.id) }}</b><span>历史记账数</span></div><div class="mini-stat"><b>{{ selectedBudgets.length }}</b><span>月预算样例</span></div></div></section>
        <section class="d-section"><h3 class="d-section-title">关联账本</h3><div v-for="ledger in selectedLedgers" :key="ledger.id" class="ledger-row"><div class="info"><div class="name">{{ ledger.name }}<span v-if="ledger.isDefault" class="tag tag-blue">默认</span></div><div class="meta">{{ ledger.id }} · {{ ledger.historicalCount }} 条历史记录</div></div><RouterLink class="detail-link" :to="{ name: 'business-data', query: { tab: 'records', user: selectedUser.id, ledger: ledger.id } }">查看记录</RouterLink></div><p v-if="!selectedLedgers.length" class="detail-note">当前演示子集没有关联账本。</p></section>
        <section class="d-section"><h3 class="d-section-title">预算设置概况</h3><div v-for="budget in selectedBudgets" :key="budget.id" class="ledger-row budget-detail-row"><div class="info"><div class="name">{{ ledgerName(budget.ledgerId) }} · {{ budget.month }}</div><div class="meta">总预算 · {{ categoryBudgetCount(budget.ledgerId, budget.month) }} 项分类预算样例</div></div><span class="amt masked" aria-label="预算金额已隐藏">•••••</span><RouterLink class="detail-link" :to="{ name: 'business-data', query: { tab: 'budgets', user: selectedUser.id, ledger: budget.ledgerId, month: budget.month } }">查看预算</RouterLink></div><p class="detail-note">{{ selectedBudgets.length ? '预算金额默认隐藏，请进入预算页按条演示授权查看。' : '当前演示子集没有该用户的预算样例。' }}</p></section>
        <section class="d-section"><h3 class="d-section-title">最近记账样例</h3><div v-for="record in recentRecords" :key="record.id" class="detail-record"><span class="num text-3">{{ record.date }}</span><span class="tag" :class="record.type === '支出' ? 'tag-red' : 'tag-green'">{{ record.type }}</span><span>{{ record.category }}</span><span class="amt masked" aria-label="记账金额已隐藏">•••••</span></div><p class="detail-note">{{ recentRecords.length ? '仅显示演示子集中的最近记录，金额与备注须在记录页按条查看。' : '当前子集没有该用户的流水样例，不代表没有历史记录。' }}</p></section>
      </template>
      <TableState v-else state="empty" title="未找到该用户" description="此用户 ID 不在演示子集中，请关闭后重新查询。" />
      <template #footer><RouterLink v-if="selectedUser && !loading && !loadError" class="btn" :to="{ name: 'business-data', query: { tab: 'records', user: selectedUser.id } }"><AppIcon name="i-book" />查看该用户记账记录</RouterLink><button v-else class="btn" type="button" @click="closeUser">关闭详情</button></template>
    </AppDialog>
  </section>
</template>
