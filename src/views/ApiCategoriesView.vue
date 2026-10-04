<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TableState from '../components/TableState.vue'
import TablePagination from '../components/TablePagination.vue'
import { isUserId } from '../api/admin-users'
import { AdminCategoryError, createAdminCategory, fetchAdminCategories, type AdminCategory, updateAdminCategory } from '../api/admin-category'

type Tab = 'system' | 'custom'
type FilterDraft = { name: string; type: string; status: string; user: string }
const route = useRoute(), router = useRouter()
const tab = computed<Tab>(() => route.query.tab === 'custom' ? 'custom' : 'system')
const one = (key: string, fallback = '') => typeof route.query[key] === 'string' ? String(route.query[key]) : fallback
const filters = computed<FilterDraft>(() => ({ name: one('name').trim(), type: ['INCOME', 'EXPENSE'].includes(one('type')) ? one('type') : '', status: tab.value === 'system' && ['active', 'inactive'].includes(one('status')) ? one('status') : '', user: tab.value === 'custom' ? one('user').trim().toLowerCase() : '' }))
const draft = reactive<FilterDraft>({ name: '', type: '', status: '', user: '' })
const page = computed(() => Number(one('page', '1'))), size = computed(() => Number(one('size', '10')))
const rows = ref<AdminCategory[]>([]), total = ref<number | null>(null), loading = ref(false), listError = ref(''), formError = ref(''), notice = ref('')
const dialog = ref<'edit' | 'toggle' | null>(null), selectedId = ref(''), selected = computed(() => rows.value.find(row => row.id === selectedId.value) || null)
const editor = reactive({ name: '', type: 'EXPENSE' as 'INCOME' | 'EXPENSE', icon: 'i-tag', sort: 1, isActive: true })
const errors = reactive({ name: '', icon: '', sort: '' })
let listController: AbortController | undefined, writeController: AbortController | undefined
let generation = 0, disposed = false

const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
const dialogTitle = computed(() => dialog.value === 'toggle' ? `${selected.value?.isActive ? '停用' : '启用'}系统分类` : selectedId.value ? '编辑系统分类' : '新增系统分类')
const typeLabel = (value: AdminCategory['type']) => value === 'INCOME' ? '收入' : '支出'
const statusLabel = (value: boolean) => value ? '启用' : '停用'
const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'UTC', hour12: false })
const userLink = (id: string) => ({ name: 'users', query: { user: id, uid: id } })
const ledgerLink = (row: AdminCategory) => row.ledgerId ? ({ name: 'business-data', query: { tab: 'ledgers', user: row.userId || undefined, lid: row.ledgerId } }) : null

function queryError() {
  if (['tab', 'name', 'type', 'status', 'user', 'page', 'size'].some(key => Array.isArray(route.query[key]))) return '地址包含重复参数，请重置筛选。'
  if (route.query.tab && !['system', 'custom'].includes(one('tab'))) return '分类标签无效，请重置筛选。'
  if (!/^[1-9][0-9]{0,4}$/.test(one('page', '1')) || page.value > 10000 || !['5', '10', '20'].includes(one('size', '10'))) return '分页参数无效，请重置筛选。'
  if (filters.value.user && !isUserId(filters.value.user)) return '用户 ID 须为完整 UUID。'
  if (Array.from(filters.value.name).length > 64 || Array.from(filters.value.name).some(char => { const code = char.codePointAt(0)!; return code < 32 || (code >= 127 && code <= 159) })) return '分类名称关键词最多 64 个字符，不能包含控制字符。'
  return ''
}
function buildQuery(values: FilterDraft, nextTab = tab.value, nextPage = 1, nextSize = size.value) {
  const query: Record<string, string> = { tab: nextTab, page: String(nextPage), size: String([5, 10, 20].includes(nextSize) ? nextSize : 10) }
  for (const [key, value] of Object.entries(values)) if (value.trim() && (nextTab === 'custom' || key !== 'status' || value === '')) query[key] = value.trim().toLowerCase()
  if (nextTab !== 'system') delete query.status
  return query
}
async function unauthenticated() { await router.replace({ name: 'login', query: { redirect: route.fullPath, reason: 'expired' } }).catch(() => { listError.value = '会话已失效，请刷新页面重新登录。' }) }
async function loadList() {
  const current = ++generation; listController?.abort(); rows.value = []; total.value = null; listError.value = queryError(); notice.value = ''
  if (listError.value) return
  const controller = new AbortController(); listController = controller; loading.value = true
  try {
    const f = filters.value; const result = await fetchAdminCategories({ scope: tab.value, user: f.user, keyword: f.name, type: f.type as 'INCOME' | 'EXPENSE' | undefined, status: f.status as 'active' | 'inactive' | undefined, page: page.value, size: size.value }, controller.signal)
    if (disposed || current !== generation) return
    rows.value = result.items; total.value = result.total
    if (result.page !== page.value) await router.replace({ name: 'categories', query: { ...route.query, page: String(result.page) } })
  } catch (error) {
    if (disposed || current !== generation || error instanceof AdminCategoryError && error.kind === 'cancelled') return
    if (error instanceof AdminCategoryError && error.status === 401) { await unauthenticated(); return }
    listError.value = error instanceof AdminCategoryError ? error.message : '分类查询失败，请重试。'
  } finally { if (!disposed && current === generation) loading.value = false }
}
function submitFilters() { formError.value = ''; return router.push({ name: 'categories', query: buildQuery(draft) }) }
function resetFilters() { Object.assign(draft, { name: '', type: '', status: '', user: '' }); return submitFilters() }
function changePage(value: number, nextSize: number) { return router.push({ name: 'categories', query: buildQuery(filters.value, tab.value, value, nextSize) }) }
function changeTab(value: Tab) { if (value !== tab.value) return router.push({ name: 'categories', query: buildQuery({ name: '', type: '', status: '', user: '' }, value) }) }
function openEditor(row?: AdminCategory) {
  if (row && !row.isSystem) return
  selectedId.value = row?.id || ''; Object.assign(editor, row ? { name: row.name, type: row.type, icon: row.icon || 'i-tag', sort: row.sort, isActive: row.isActive } : { name: '', type: filters.value.type === 'INCOME' ? 'INCOME' : 'EXPENSE', icon: 'i-tag', sort: 1, isActive: true }); Object.assign(errors, { name: '', icon: '', sort: '' }); dialog.value = 'edit'
}
function validateEditor() {
  Object.assign(errors, { name: '', icon: '', sort: '' }); const name = editor.name.trim().normalize('NFC')
  if (Array.from(name).length < 2 || Array.from(name).length > 64 || /[\u0000-\u001f\u007f]/.test(name)) errors.name = '名称须为 2–64 个字符，不能包含控制字符。'
  if (Array.from(editor.icon).length > 128 || /[\u0000-\u001f\u007f]/.test(editor.icon)) errors.icon = '图标标识无效。'
  if (!Number.isInteger(editor.sort) || editor.sort < 1 || editor.sort > 99) errors.sort = '排序须为 1–99 的整数。'
  return !Object.values(errors).some(Boolean)
}
async function saveCategory() {
  if (!validateEditor()) return
  writeController?.abort(); writeController = new AbortController(); formError.value = ''
  try {
    const input = { name: editor.name.trim().normalize('NFC'), icon: editor.icon.trim(), type: editor.type, sort: editor.sort }
    if (selectedId.value) await updateAdminCategory(selectedId.value, input, writeController.signal)
    else await createAdminCategory(input, writeController.signal)
    dialog.value = null; notice.value = selectedId.value ? '系统分类已更新。' : '系统分类已创建。'; await loadList(); await nextTick(); (document.getElementById(selectedId.value ? `category-edit-${selectedId.value}` : 'category-add') || document.getElementById('category-add'))?.focus()
  } catch (error) { if (error instanceof AdminCategoryError && error.kind === 'cancelled') return; if (error instanceof AdminCategoryError && error.status === 401) { await unauthenticated(); return }; formError.value = error instanceof AdminCategoryError ? error.message : '分类保存失败，请重试。' }
}
function openToggle(row: AdminCategory) { if (!row.isSystem) return; selectedId.value = row.id; dialog.value = 'toggle' }
async function confirmToggle() {
  if (!selected.value) return
  writeController?.abort(); writeController = new AbortController()
  try { await updateAdminCategory(selected.value.id, { isActive: !selected.value.isActive }, writeController.signal); const name = selected.value.name; const next = !selected.value.isActive; dialog.value = null; notice.value = `系统分类「${name}」已${next ? '启用' : '停用'}。`; await loadList(); await nextTick(); document.getElementById(`category-toggle-${selected.value.id}`)?.focus() }
  catch (error) { if (error instanceof AdminCategoryError && error.kind === 'cancelled') return; if (error instanceof AdminCategoryError && error.status === 401) { await unauthenticated(); return }; formError.value = error instanceof AdminCategoryError ? error.message : '分类状态更新失败，请重试。' }
}
function closeDialog() { dialog.value = null; formError.value = '' }
watch(() => route.fullPath, () => { Object.assign(draft, filters.value); formError.value = ''; dialog.value = null; void loadList() }, { immediate: true })
onBeforeUnmount(() => { disposed = true; ++generation; listController?.abort(); writeController?.abort() })
</script>

<template>
  <section class="business-page api-categories" aria-labelledby="api-categories-title">
    <div class="page-head"><div><h1 id="api-categories-title" class="page-title">分类管理</h1><p class="page-desc">真实管理系统预置分类；用户自建分类仅供核查，不提供删除或批量操作。</p></div><button id="category-add" class="btn btn-primary" type="button" :disabled="loading" @click="openEditor()"><AppIcon name="i-plus" size="sm" />新增系统分类</button></div>
    <div class="banner banner-info ops-notice"><AppIcon name="i-shield" /><div>系统分类支持名称、图标、排序和启停；历史流水引用只读保留。用户自建分类只展示归属和引用数。</div></div>
    <p v-if="notice" class="ops-feedback" role="status">{{ notice }}</p>
    <div class="card query-card">
      <div class="ops-tabs" role="group" aria-label="分类来源"><button class="ops-tab" type="button" :aria-pressed="tab === 'system'" @click="changeTab('system')">系统预置</button><button class="ops-tab" type="button" :aria-pressed="tab === 'custom'" @click="changeTab('custom')">用户自建 <span class="tag tag-gray">只读</span></button></div>
      <form class="filter-bar" aria-label="分类筛选" @submit.prevent="submitFilters"><div class="field query-field wide-field"><label class="field-label" for="api-category-name">分类名称</label><input id="api-category-name" v-model="draft.name" class="input" maxlength="64" placeholder="搜索名称关键词"></div><div class="field query-field short-field"><label class="field-label" for="api-category-type">收支类型</label><select id="api-category-type" v-model="draft.type" class="select"><option value="">全部类型</option><option value="EXPENSE">支出</option><option value="INCOME">收入</option></select></div><div v-if="tab === 'system'" class="field query-field short-field"><label class="field-label" for="api-category-status">状态</label><select id="api-category-status" v-model="draft.status" class="select"><option value="">全部状态</option><option value="active">启用</option><option value="inactive">停用</option></select></div><div v-else class="field query-field"><label class="field-label" for="api-category-user">所属用户 ID</label><input id="api-category-user" v-model="draft.user" class="input num" maxlength="36" placeholder="完整 UUID"></div><div class="filter-actions"><button class="btn btn-primary" type="submit" :disabled="loading"><AppIcon name="i-search" size="sm" />查询</button><button class="btn" type="button" @click="resetFilters">重置</button></div></form>
      <p v-show="formError && !dialog" class="field-error filter-error" role="alert">{{ formError }}</p>
      <div v-if="hasFilters" class="filter-chips" aria-label="已应用筛选"><span v-if="filters.name">名称：{{ filters.name }}</span><span v-if="filters.type">类型：{{ typeLabel(filters.type as 'INCOME' | 'EXPENSE') }}</span><span v-if="filters.status">状态：{{ filters.status === 'active' ? '启用' : '停用' }}</span><span v-if="filters.user">用户：{{ filters.user }}</span></div>
    </div>
    <div class="card table-card" :aria-busy="loading"><div class="table-toolbar"><h2 class="card-title">{{ tab === 'system' ? '系统预置分类' : '用户自建分类' }} <span class="tag tag-green">真实接口</span></h2><span class="text-3">{{ tab === 'system' ? '可编辑 · 无删除' : '只读核查' }}</span></div><TableState v-if="loading" state="loading" title="正在读取分类" description="仅通过管理员接口查询，不加载演示集合。" /><TableState v-else-if="listError" state="error" title="分类查询未完成" :description="listError" @retry="loadList" /><TableState v-else-if="!total" :state="hasFilters ? 'noresult' : 'empty'" :title="hasFilters ? '未找到符合条件的分类' : '暂无可查询分类'" description="当前结果不使用演示样例或零值替代真实响应。" @reset="resetFilters" /><div v-else class="table-wrap" role="region" aria-label="分类列表，可横向滚动查看" tabindex="0"><table class="tbl api-category-table"><thead><tr><th scope="col">分类 ID</th><th scope="col">分类名称</th><th scope="col">类型</th><th scope="col">所属用户</th><th scope="col">账本</th><th scope="col">排序</th><th scope="col">状态</th><th scope="col">有效引用</th><th scope="col" class="op-cell">操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td class="num cat-id">{{ row.id }}</td><td class="cat-name">{{ row.name }}</td><td><span class="tag" :class="row.type === 'INCOME' ? 'tag-green' : 'tag-orange'">{{ typeLabel(row.type) }}</span></td><td><RouterLink v-if="row.userId" :to="userLink(row.userId)" class="cat-name">{{ row.userNickname || '未设置昵称' }}</RouterLink><span v-else>系统预置</span></td><td><RouterLink v-if="ledgerLink(row)" :to="ledgerLink(row)!" class="cat-name">{{ row.ledgerName || '未命名账本' }}</RouterLink><span v-else>通用</span></td><td class="num">{{ row.sort }}</td><td><span class="tag" :class="row.isActive ? 'tag-green' : 'tag-gray'">{{ statusLabel(row.isActive) }}</span></td><td class="num-cell">{{ row.transactionCount }}</td><td class="op-cell"><template v-if="row.isSystem"><button :id="`category-edit-${row.id}`" class="btn btn-text btn-sm" type="button" @click="openEditor(row)">编辑</button><button :id="`category-toggle-${row.id}`" class="btn btn-text btn-sm" type="button" @click="openToggle(row)">{{ row.isActive ? '停用' : '启用' }}</button></template><span v-else class="text-3">只读</span></td></tr></tbody></table></div><TablePagination v-if="total !== null" :page="page" :page-size="size" :total="total" :disabled="loading || Boolean(listError)" @change="changePage" /><p class="table-footnote">系统分类排序按类型、排序号和 ID 稳定排列；停用不删除历史引用。管理员不提供分类删除和批量操作。</p></div>
    <AppDialog :model-value="dialog !== null" :title="dialogTitle" @update:model-value="value => { if (!value) closeDialog() }"><form v-if="dialog === 'edit'" id="api-category-editor" class="category-editor" novalidate @submit.prevent="saveCategory"><p class="detail-note">仅管理系统预置分类；用户自建分类保持只读。历史流水引用不会被修改。</p><div class="field"><label class="field-label" for="api-category-editor-name">分类名称 <span aria-hidden="true">*</span></label><input id="api-category-editor-name" v-model="editor.name" class="input" data-dialog-autofocus maxlength="64" required :aria-invalid="Boolean(errors.name)"><p v-if="errors.name" class="field-error" role="alert">{{ errors.name }}</p></div><div class="field"><label class="field-label" for="api-category-editor-type">收支类型</label><select id="api-category-editor-type" v-model="editor.type" class="select" :disabled="Boolean(selectedId)"><option value="EXPENSE">支出</option><option value="INCOME">收入</option></select></div><div class="field"><label class="field-label" for="api-category-editor-icon">图标标识</label><input id="api-category-editor-icon" v-model="editor.icon" class="input" maxlength="128"><p v-if="errors.icon" class="field-error" role="alert">{{ errors.icon }}</p></div><div class="field"><label class="field-label" for="api-category-editor-sort">排序</label><input id="api-category-editor-sort" v-model.number="editor.sort" class="input num" type="number" min="1" max="99" step="1"><p :class="errors.sort ? 'field-error' : 'detail-note'" :role="errors.sort ? 'alert' : undefined">{{ errors.sort || '数值越小越靠前；允许同序号。' }}</p></div><p v-show="formError" class="field-error" role="alert">{{ formError }}</p></form><div v-else-if="dialog === 'toggle' && selected"><p class="ops-confirm-lead">确定{{ selected.isActive ? '停用' : '启用' }}「{{ selected.name }}」？</p><dl class="desc-list"><dt>收支类型</dt><dd>{{ typeLabel(selected.type) }}</dd><dt>有效引用</dt><dd>{{ selected.transactionCount }} 条</dd></dl><div class="banner banner-info"><AppIcon name="i-info" /><div>停用只影响后续可选项，不修改历史流水；本次不提供删除。</div></div><p v-show="formError" class="field-error" role="alert">{{ formError }}</p></div><template #footer><button class="btn" type="button" @click="closeDialog">取消</button><button v-if="dialog === 'edit'" class="btn btn-primary" type="submit" form="api-category-editor">保存</button><button v-else class="btn btn-primary" type="button" @click="confirmToggle">确认{{ selected?.isActive ? '停用' : '启用' }}</button></template></AppDialog>
  </section>
</template>

<style scoped>
.api-categories .page-head > .btn { flex-shrink: 0; }
.api-categories .table-wrap { max-width: 100%; }
.api-category-table { min-width: 1180px; }
.cat-id, .cat-name { max-width: 190px; white-space: normal; overflow-wrap: anywhere; }
.api-categories .category-editor { display: grid; gap: 16px; }
@media (max-width: 768px) { .api-categories .btn, .api-categories .row-link { min-height: 44px; } }
</style>
