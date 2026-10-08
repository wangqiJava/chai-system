<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TableState from '../components/TableState.vue'
import TablePagination from '../components/TablePagination.vue'
import { dateRangeError, pageNumber, pageSizeNumber, queryText } from '../data/business'
import { auditTypes } from '../data/operations'
import { AdminAuditError, fetchAdminAudit, type AdminAuditLog, type AuditResult, type AuditType } from '../api/admin-audit'

const route = useRoute()
const router = useRouter()
const draft = reactive({ from: '', to: '', admin: '', type: '', result: '', request: '' })
const filters = computed(() => ({ from: queryText(route.query.from), to: queryText(route.query.to), admin: queryText(route.query.admin), type: auditTypes.includes(queryText(route.query.type)) ? queryText(route.query.type) as AuditType : '', result: ['成功', '失败', '限流'].includes(queryText(route.query.result)) ? queryText(route.query.result) as AuditResult : '', request: queryText(route.query.request) }))
const page = computed(() => pageNumber(route.query.page))
const pageSize = computed(() => pageSizeNumber(route.query.size))
const rows = ref<AdminAuditLog[]>([])
const total = ref<number | null>(null)
const loading = ref(false)
const listError = ref('')
const formError = ref('')
const selectedId = computed(() => queryText(route.query.id))
const selected = computed(() => rows.value.find(row => row.requestId === selectedId.value))
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
const appliedError = computed(() => dateRangeError(filters.value.from, filters.value.to))
const copyStatus = ref('')
const copying = ref(false)
const requestField = ref<HTMLInputElement | null>(null)
let controller: AbortController | undefined
let generation = 0
let disposed = false

function queryError() {
  if (['from', 'to', 'admin', 'type', 'result', 'request', 'id', 'page', 'size'].some(key => Array.isArray(route.query[key]))) return '地址中包含重复参数，请重置筛选。'
  if (!['5', '10', '20'].includes(queryText(route.query.size || '10')) || page.value > 10000) return '分页参数无效，请重置筛选。'
  if (route.query.type && !auditTypes.includes(queryText(route.query.type))) return '操作类型无效，请重新选择。'
  if (route.query.result && !['成功', '失败', '限流'].includes(queryText(route.query.result))) return '日志结果无效，请重新选择。'
  return appliedError.value
}
async function unauthenticated() {
  rows.value = []
  total.value = null
  controller?.abort()
  await router.replace({ name: 'login', query: { redirect: route.fullPath, reason: 'expired' } }).catch(() => { listError.value = '会话已失效，请刷新页面重新登录。' })
}
async function load() {
  const current = ++generation
  controller?.abort()
  rows.value = []
  total.value = null
  listError.value = queryError()
  loading.value = false
  if (listError.value) return
  controller = new AbortController()
  loading.value = true
  try {
    const result = await fetchAdminAudit({ ...filters.value, page: page.value, size: pageSize.value }, controller.signal)
    if (disposed || current !== generation) return
    rows.value = result.items
    total.value = result.total
    if (result.page !== page.value) await router.replace({ name: 'audit-logs', query: { ...route.query, page: String(result.page) } })
  } catch (error) {
    if (disposed || current !== generation || error instanceof AdminAuditError && error.kind === 'cancelled') return
    if (error instanceof AdminAuditError && error.status === 401) { await unauthenticated(); return }
    listError.value = error instanceof AdminAuditError ? error.message : '操作日志查询失败，请重试。'
  } finally { if (!disposed && current === generation) loading.value = false }
}
function queryFor(values: typeof draft, nextPage = 1, size = pageSize.value) {
  const query: Record<string, string> = { page: String(nextPage), size: String(size) }
  for (const [key, value] of Object.entries(values)) if (value.trim()) query[key] = value.trim()
  return query
}
async function submitFilters() {
  formError.value = dateRangeError(draft.from, draft.to)
  if (formError.value) { await nextTick(); document.getElementById('api-logs-from')?.focus(); return }
  await router.push({ name: 'audit-logs', query: queryFor(draft) })
}
function resetFilters() { Object.assign(draft, { from: '', to: '', admin: '', type: '', result: '', request: '' }); formError.value = ''; return router.push({ name: 'audit-logs', query: { page: '1', size: String(pageSize.value) } }) }
function changePage(value: number, size: number) { return router.push({ name: 'audit-logs', query: queryFor(filters.value, value, size) }) }
function openLog(id: string) { return router.push({ name: 'audit-logs', query: { ...route.query, id } }) }
function closeLog() { const query = { ...route.query }; delete query.id; return router.replace({ name: 'audit-logs', query }) }
async function copyRequestId() {
  const id = selected.value?.requestId
  if (!id || copying.value) return
  copying.value = true
  copyStatus.value = ''
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(id)
    copyStatus.value = '已复制真实服务端请求 ID。'
  } catch {
    copyStatus.value = '无法访问剪贴板。已选中请求 ID，请手动复制。'
    requestField.value?.focus()
    requestField.value?.select()
  } finally { copying.value = false }
}
watch(() => route.fullPath, () => {
  Object.assign(draft, filters.value)
  formError.value = appliedError.value
  copyStatus.value = ''
  void load()
}, { immediate: true })
onBeforeUnmount(() => { disposed = true; ++generation; controller?.abort() })
</script>

<template>
  <section class="business-page audit-page" aria-labelledby="api-logs-title">
    <div class="page-head"><div><h1 id="api-logs-title" class="page-title">操作日志</h1><p class="page-desc">核查真实管理员访问、查询和分类变更记录。</p></div><button class="btn" type="button" :disabled="loading" @click="load"><AppIcon name="i-refresh" size="sm" />重新加载</button></div>
    <div class="banner banner-info ops-notice"><AppIcon name="i-shield" /><div>日志仅保留最小化摘要，不提供密码、令牌、密钥、金额或备注原文。日志为只读，不能删除或导出。</div></div>
    <div class="card query-card">
      <form class="filter-bar" aria-label="日志筛选" @submit.prevent="submitFilters">
        <div class="field"><span class="field-label">操作日期</span><div class="date-group"><label class="sr-only" for="api-logs-from">操作开始日期</label><input id="api-logs-from" v-model="draft.from" class="input" type="date" :aria-invalid="Boolean(formError)" aria-describedby="api-logs-filter-error"><span>至</span><label class="sr-only" for="api-logs-to">操作结束日期</label><input id="api-logs-to" v-model="draft.to" class="input" type="date" :aria-invalid="Boolean(formError)" aria-describedby="api-logs-filter-error"></div></div>
        <div class="field query-field short-field"><label class="field-label" for="api-logs-admin">管理员</label><input id="api-logs-admin" v-model="draft.admin" class="input" placeholder="搜索姓名" maxlength="64"></div>
        <div class="field query-field"><label class="field-label" for="api-logs-type">操作类型</label><select id="api-logs-type" v-model="draft.type" class="select"><option value="">全部类型</option><option v-for="type in auditTypes" :key="type">{{ type }}</option></select></div>
        <div class="field query-field short-field"><label class="field-label" for="api-logs-result">结果</label><select id="api-logs-result" v-model="draft.result" class="select"><option value="">全部结果</option><option>成功</option><option>失败</option><option>限流</option></select></div>
        <div class="field query-field wide-field"><label class="field-label" for="api-logs-request">请求 ID</label><input id="api-logs-request" v-model="draft.request" class="input num" placeholder="搜索请求 ID" maxlength="100"></div>
        <div class="filter-actions"><button class="btn btn-primary" type="submit" :disabled="loading"><AppIcon name="i-search" size="sm" />查询</button><button class="btn" type="button" @click="resetFilters">重置</button></div>
      </form>
      <p v-show="formError" id="api-logs-filter-error" class="field-error filter-error" role="alert">{{ formError }}</p>
      <div v-if="hasFilters" class="filter-chips" aria-label="已应用筛选"><span v-if="filters.from || filters.to">日期：{{ filters.from || '不限' }} 至 {{ filters.to || '不限' }}</span><span v-if="filters.admin">管理员：{{ filters.admin }}</span><span v-if="filters.type">类型：{{ filters.type }}</span><span v-if="filters.result">结果：{{ filters.result }}</span><span v-if="filters.request">请求 ID：{{ filters.request }}</span><button class="btn btn-text btn-sm filter-clear" type="button" @click="resetFilters">清除筛选</button></div>
    </div>
    <div class="card table-card" :aria-busy="loading">
      <div class="table-toolbar"><h2 class="card-title">操作记录 <span class="tag tag-green">真实接口</span></h2><span class="text-3">只读 · 不提供删除或导出</span></div>
      <TableState v-if="loading" state="loading" /><TableState v-else-if="listError" state="error" :description="listError" @retry="load" /><TableState v-else-if="!rows.length" :state="hasFilters ? 'noresult' : 'empty'" @reset="resetFilters" />
      <div v-else class="table-wrap"><table class="tbl audit-table"><caption class="sr-only">按时间倒序排列的真实操作日志</caption><thead><tr><th scope="col">操作时间</th><th scope="col">管理员</th><th scope="col">类型</th><th scope="col">操作对象</th><th scope="col">结果</th><th scope="col">操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.requestId"><td class="num">{{ row.time }}</td><td>{{ row.admin }}</td><td><span class="tag" :class="row.type === '敏感数据查看' ? 'tag-orange' : row.type === '分类管理' ? 'tag-purple' : 'tag-blue'">{{ row.type }}</span></td><td class="audit-target">{{ row.target }}</td><td><span class="tag" :class="row.result === '成功' ? 'tag-green' : row.result === '限流' ? 'tag-orange' : 'tag-red'">{{ row.result }}</span></td><td><button :id="`api-log-${row.requestId}`" class="row-link" type="button" :aria-label="`查看 ${row.time} ${row.admin} 日志详情`" @click="openLog(row.requestId)">查看详情</button></td></tr></tbody></table></div>
      <TablePagination v-if="!loading && !listError" :page="page" :page-size="pageSize" :total="total || 0" @change="changePage" /><p class="table-footnote">日志来自服务端管理员审计表；业务访问审计不包含财务原文。</p>
    </div>
    <AppDialog :model-value="Boolean(selectedId)" title="操作日志详情" variant="drawer" @update:model-value="value => { if (!value) closeLog() }">
      <template v-if="selected"><section class="d-section"><h3 class="d-section-title">操作信息</h3><dl class="desc-list"><dt>操作时间</dt><dd class="num">{{ selected.time }}</dd><dt>管理员</dt><dd>{{ selected.admin }}</dd><dt>操作类型</dt><dd>{{ selected.type }}</dd><dt>操作对象</dt><dd>{{ selected.target }}</dd><dt>结果</dt><dd><span class="tag" :class="selected.result === '成功' ? 'tag-green' : selected.result === '限流' ? 'tag-orange' : 'tag-red'">{{ selected.result }}</span></dd></dl></section><section class="d-section"><h3 class="d-section-title">最小化摘要</h3><p class="ops-prose">{{ selected.summary }}</p></section><section class="d-section"><label class="field-label" for="api-log-request-id">真实请求 ID</label><div class="ops-copy-row"><input id="api-log-request-id" ref="requestField" class="input num" :value="selected.requestId" readonly><button class="btn" type="button" :disabled="copying" @click="copyRequestId">{{ copying ? '复制中…' : '复制 ID' }}</button></div><p class="detail-note" role="status">{{ copyStatus || '可使用此请求 ID 与服务端日志交叉核对。' }}</p></section><div class="banner banner-info"><AppIcon name="i-shield" /><div>该审计记录不提供查看密码、令牌、密钥或个人财务原文的入口。</div></div></template>
      <TableState v-else state="empty" title="未找到该日志" description="请求 ID 不在当前页，请关闭后重新查询。" />
      <template #footer><button class="btn" type="button" @click="closeLog">关闭详情</button></template>
    </AppDialog>
  </section>
</template>

<style scoped>
.audit-page .filter-chips { align-items: center; }
.audit-page .filter-clear { margin-left: auto; }
</style>
