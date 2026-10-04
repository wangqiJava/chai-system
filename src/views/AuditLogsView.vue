<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TableState from '../components/TableState.vue'
import TablePagination from '../components/TablePagination.vue'
import { dateRangeError, pageNumber, pageSizeNumber, queryText } from '../data/business'
import { auditTypes, loadDemoOperations, type OperationsData } from '../data/operations'

const route = useRoute()
const router = useRouter()
const data = ref<OperationsData | null>(null)
const loading = ref(false)
const loadError = ref(false)
const formError = ref('')
const copyStatus = ref('')
const copying = ref(false)
const requestField = ref<HTMLInputElement | null>(null)
const draft = reactive({ from: '', to: '', admin: '', type: '', result: '', request: '' })
const filters = computed(() => ({ from: queryText(route.query.from), to: queryText(route.query.to), admin: queryText(route.query.admin), type: auditTypes.includes(queryText(route.query.type)) ? queryText(route.query.type) : '', result: ['成功', '失败'].includes(queryText(route.query.result)) ? queryText(route.query.result) : '', request: queryText(route.query.request) }))
const appliedError = computed(() => dateRangeError(filters.value.from, filters.value.to))
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
const filtered = computed(() => {
  if (appliedError.value) return []
  const f = filters.value
  return (data.value?.logs || []).filter(row => (!f.from || row.time.slice(0, 10) >= f.from) && (!f.to || row.time.slice(0, 10) <= f.to) && (!f.admin || row.admin.includes(f.admin)) && (!f.type || row.type === f.type) && (!f.result || row.result === f.result) && (!f.request || row.requestId.toLowerCase().includes(f.request.toLowerCase())))
})
const pageSize = computed(() => pageSizeNumber(route.query.size))
const page = computed(() => Math.min(pageNumber(route.query.page), Math.max(1, Math.ceil(filtered.value.length / pageSize.value))))
const rows = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const selectedId = computed(() => queryText(route.query.id))
const selected = computed(() => data.value?.logs.find(row => row.requestId === selectedId.value))
let controller: AbortController | undefined

async function load() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  loadError.value = false
  try { data.value = await loadDemoOperations(request.signal) } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    loadError.value = true
  } finally { if (!request.signal.aborted) loading.value = false }
}
function queryFor(values: typeof draft, nextPage = 1, size = pageSize.value) {
  const query: Record<string, string> = { page: String(nextPage), size: String(size) }
  for (const [key, value] of Object.entries(values)) if (value.trim()) query[key] = value.trim()
  return query
}
async function submitFilters() {
  formError.value = dateRangeError(draft.from, draft.to)
  if (formError.value) { await nextTick(); document.getElementById('logs-from')?.focus(); return }
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
    if (selectedId.value === id) copyStatus.value = '已复制演示请求 ID；它不对应真实服务端请求。'
  } catch {
    if (selectedId.value === id) { copyStatus.value = '无法访问剪贴板。已选中请求 ID，请手动复制。'; requestField.value?.focus(); requestField.value?.select() }
  } finally { copying.value = false }
}
watch(() => route.fullPath, () => {
  Object.assign(draft, filters.value)
  if (dateRangeError(draft.from, '')) draft.from = ''
  if (dateRangeError('', draft.to)) draft.to = ''
  formError.value = appliedError.value
  copyStatus.value = ''
}, { immediate: true })
onMounted(load)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="business-page audit-page" aria-labelledby="logs-title">
    <div class="page-head"><div><h1 id="logs-title" class="page-title">操作日志</h1><p class="page-desc">核查操作类型、对象与结果。此处为固定示例，不是生产审计记录。</p></div><button class="btn" type="button" :disabled="loading" @click="load"><AppIcon name="i-refresh" size="sm" />重新加载样例</button></div>
    <div class="banner banner-info ops-notice"><AppIcon name="i-shield" /><div>本地登录、分类修改和敏感数据演示查看<b>不会生成审计日志</b>。摘要不含密码、令牌、密钥、金额或备注原文。</div></div>
    <div class="card query-card">
      <form class="filter-bar" aria-label="日志筛选" @submit.prevent="submitFilters">
        <div class="field"><span class="field-label">操作日期</span><div class="date-group"><label class="sr-only" for="logs-from">操作开始日期</label><input id="logs-from" v-model="draft.from" class="input" type="date" :aria-invalid="Boolean(formError)" aria-describedby="logs-filter-error"><span>至</span><label class="sr-only" for="logs-to">操作结束日期</label><input id="logs-to" v-model="draft.to" class="input" type="date" :aria-invalid="Boolean(formError)" aria-describedby="logs-filter-error"></div></div>
        <div class="field query-field short-field"><label class="field-label" for="logs-admin">管理员</label><input id="logs-admin" v-model="draft.admin" class="input" placeholder="搜索姓名" maxlength="100"></div>
        <div class="field query-field"><label class="field-label" for="logs-type">操作类型</label><select id="logs-type" v-model="draft.type" class="select"><option value="">全部类型</option><option v-for="type in auditTypes" :key="type">{{ type }}</option></select></div>
        <div class="field query-field short-field"><label class="field-label" for="logs-result">结果</label><select id="logs-result" v-model="draft.result" class="select"><option value="">全部结果</option><option>成功</option><option>失败</option></select></div>
        <div class="field query-field wide-field"><label class="field-label" for="logs-request">请求 ID</label><input id="logs-request" v-model="draft.request" class="input num" placeholder="搜索演示请求 ID" maxlength="100"></div>
        <div class="filter-actions"><button class="btn btn-primary" type="submit" :disabled="loading"><AppIcon name="i-search" size="sm" />查询</button><button class="btn" type="button" @click="resetFilters">重置</button></div>
      </form>
      <p v-show="formError" id="logs-filter-error" class="field-error filter-error" role="alert">{{ formError }}</p>
      <div v-if="hasFilters" class="filter-chips" aria-label="已应用筛选"><span v-if="filters.from || filters.to">日期：{{ filters.from || '不限' }} 至 {{ filters.to || '不限' }}</span><span v-if="filters.admin">管理员：{{ filters.admin }}</span><span v-if="filters.type">类型：{{ filters.type }}</span><span v-if="filters.result">结果：{{ filters.result }}</span><span v-if="filters.request">请求 ID：{{ filters.request }}</span></div>
    </div>
    <div class="card table-card" :aria-busy="loading">
      <div class="table-toolbar"><h2 class="card-title">操作记录 <span class="tag tag-orange">固定示例</span></h2><span class="text-3">只读 · 不提供删除或导出</span></div>
      <TableState v-if="loading" state="loading" /><TableState v-else-if="loadError" state="error" @retry="load" /><TableState v-else-if="appliedError" state="noresult" title="日期筛选无效" :description="appliedError" @reset="resetFilters" /><TableState v-else-if="!rows.length" :state="hasFilters ? 'noresult' : 'empty'" @reset="resetFilters" />
      <div v-else class="table-wrap"><table class="tbl audit-table"><caption class="sr-only">按时间倒序排列的操作日志演示样例</caption><thead><tr><th scope="col">操作时间</th><th scope="col">管理员</th><th scope="col">类型</th><th scope="col">操作对象</th><th scope="col">结果</th><th scope="col">操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.requestId"><td class="num">{{ row.time }}</td><td>{{ row.admin }}</td><td><span class="tag" :class="row.type === '敏感数据查看' ? 'tag-orange' : 'tag-blue'">{{ row.type }}</span></td><td class="audit-target">{{ row.target }}</td><td><span class="tag" :class="row.result === '成功' ? 'tag-green' : 'tag-red'">{{ row.result }}</span></td><td><button :id="`log-${row.requestId}`" class="row-link" type="button" :aria-label="`查看 ${row.time} ${row.admin} 日志详情`" @click="openLog(row.requestId)">查看详情</button></td></tr></tbody></table></div>
      <TablePagination v-if="!loading && !loadError" :page="page" :page-size="pageSize" :total="filtered.length" @change="changePage" /><p class="table-footnote">刷新只重新加载相同样例，不获取新日志。真实留存、不可篡改存储和服务端审计尚未接入。</p>
    </div>
    <AppDialog :model-value="Boolean(selectedId)" title="操作日志详情（示例）" variant="drawer" @update:model-value="value => { if (!value) closeLog() }">
      <TableState v-if="loading" state="loading" /><TableState v-else-if="loadError" state="error" @retry="load" />
      <template v-else-if="selected"><section class="d-section"><h3 class="d-section-title">操作信息</h3><dl class="desc-list"><dt>操作时间</dt><dd class="num">{{ selected.time }}</dd><dt>管理员</dt><dd>{{ selected.admin }}</dd><dt>操作类型</dt><dd>{{ selected.type }}</dd><dt>操作对象</dt><dd>{{ selected.target }}</dd><dt>结果</dt><dd><span class="tag" :class="selected.result === '成功' ? 'tag-green' : 'tag-red'">{{ selected.result }}</span></dd></dl></section><section class="d-section"><h3 class="d-section-title">最小化摘要</h3><p class="ops-prose">{{ selected.summary }}</p></section><section class="d-section"><label class="field-label" for="log-request-id">演示请求 ID</label><div class="ops-copy-row"><input id="log-request-id" ref="requestField" class="input num" :value="selected.requestId" readonly><button class="btn" type="button" :disabled="copying" @click="copyRequestId">{{ copying ? '复制中…' : '复制 ID' }}</button></div><p class="detail-note" role="status">{{ copyStatus || '仅用于演示排查入口，不对应真实服务端请求。' }}</p></section><div class="banner banner-info"><AppIcon name="i-shield" /><div>日志样例只含最小化摘要，不提供查看密码、令牌、密钥或个人财务原文的入口。</div></div></template>
      <TableState v-else state="empty" title="未找到该日志" description="请求 ID 不在演示子集中，请关闭后重新查询。" />
      <template #footer><button class="btn" type="button" @click="closeLog">关闭详情</button></template>
    </AppDialog>
  </section>
</template>
