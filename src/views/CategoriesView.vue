<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TableState from '../components/TableState.vue'
import TablePagination from '../components/TablePagination.vue'
import { pageNumber, pageSizeNumber, queryText } from '../data/business'
import { categoryIcons, loadDemoCategories, validateCategory, type CategoryData, type CategoryDraft, type SystemCategory } from '../data/categories'

const route = useRoute()
const router = useRouter()
const data = ref<CategoryData | null>(null)
const loading = ref(false)
const loadError = ref(false)
const notice = ref('')
const changed = ref(false)
const tab = computed(() => route.query.tab === 'custom' ? 'custom' : 'system')
const filters = computed(() => ({ name: queryText(route.query.name), type: ['支出', '收入'].includes(queryText(route.query.type)) ? queryText(route.query.type) : '', status: tab.value === 'system' && ['enabled', 'disabled'].includes(queryText(route.query.status)) ? queryText(route.query.status) : '', user: tab.value === 'custom' ? queryText(route.query.user).toUpperCase() : '' }))
const draft = reactive({ name: '', type: '', status: '', user: '' })
const pageSize = computed(() => pageSizeNumber(route.query.size))
const systemRows = computed(() => (data.value?.system || []).filter(row => (!filters.value.name || row.name.toLowerCase().includes(filters.value.name.toLowerCase())) && (!filters.value.type || row.type === filters.value.type) && (!filters.value.status || row.enabled === (filters.value.status === 'enabled'))).slice().sort((a, b) => a.type.localeCompare(b.type, 'zh-CN') || a.order - b.order || a.id.localeCompare(b.id)))
const customRows = computed(() => (data.value?.custom || []).filter(row => (!filters.value.name || row.name.toLowerCase().includes(filters.value.name.toLowerCase())) && (!filters.value.type || row.type === filters.value.type) && (!filters.value.user || row.userId.includes(filters.value.user))))
const total = computed(() => tab.value === 'system' ? systemRows.value.length : customRows.value.length)
const page = computed(() => Math.min(pageNumber(route.query.page), Math.max(1, Math.ceil(total.value / pageSize.value))))
const start = computed(() => (page.value - 1) * pageSize.value)
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
const dialog = ref<'edit' | 'toggle' | 'restore' | null>(null)
const selectedId = ref('')
const selected = computed(() => data.value?.system.find(row => row.id === selectedId.value))
const editor = reactive<CategoryDraft>({ name: '', type: '支出', icon: 'i-bowl', order: 1 })
const errors = ref<Partial<Record<keyof CategoryDraft, string>>>({})
const dialogTitle = computed(() => dialog.value === 'restore' ? '恢复初始分类样例' : dialog.value === 'toggle' ? `${selected.value?.enabled ? '停用' : '启用'}系统分类（演示）` : selectedId.value ? '编辑系统分类（演示）' : '新增系统分类（演示）')
let controller: AbortController | undefined

async function load() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  loadError.value = false
  try { data.value = await loadDemoCategories(request.signal); changed.value = false } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    loadError.value = true
  } finally { if (!request.signal.aborted) loading.value = false }
}

function queryFor(values: typeof draft, nextPage = 1, size = pageSize.value) {
  const query: Record<string, string> = { tab: tab.value, page: String(nextPage), size: String(size) }
  for (const [key, value] of Object.entries(values)) if (value.trim()) query[key] = key === 'user' ? value.trim().toUpperCase() : value.trim()
  return query
}
function submitFilters() { notice.value = ''; return router.push({ name: 'categories', query: queryFor(draft) }) }
function resetFilters() { Object.assign(draft, { name: '', type: '', status: '', user: '' }); return submitFilters() }
function changePage(value: number, size: number) { return router.push({ name: 'categories', query: queryFor(filters.value, value, size) }) }
function changeTab(value: 'system' | 'custom') { if (value !== tab.value) return router.push({ name: 'categories', query: { tab: value, size: String(pageSize.value) } }) }
async function closeAfterMutation(openerId: string) {
  dialog.value = null
  await nextTick()
  if (!document.getElementById(openerId)) document.getElementById('category-add')?.focus()
}

function openEditor(row?: SystemCategory) {
  selectedId.value = row?.id || ''
  const type = row?.type || (filters.value.type === '收入' ? '收入' : '支出')
  const nextOrder = Math.min(99, Math.max(0, ...(data.value?.system || []).filter(item => item.type === type).map(item => item.order)) + 1)
  Object.assign(editor, row ? { name: row.name, type: row.type, icon: row.icon, order: row.order } : { name: '', type, icon: 'i-bowl', order: nextOrder })
  errors.value = {}
  dialog.value = 'edit'
}
async function saveCategory() {
  if (!data.value || (selectedId.value && !selected.value)) return
  if (selected.value) editor.type = selected.value.type
  errors.value = validateCategory(editor, data.value.system, selectedId.value)
  if (Object.keys(errors.value).length) {
    await nextTick()
    document.getElementById(`category-${Object.keys(errors.value)[0]}`)?.focus()
    return
  }
  const fields = { name: editor.name.trim().normalize('NFC'), icon: editor.icon, order: editor.order, updated: '本次演示修改（未保存到后端）' }
  if (selected.value) Object.assign(selected.value, fields)
  else data.value.system.push({ id: `demo-${crypto.randomUUID()}`, type: editor.type, refs: 0, enabled: true, ...fields })
  notice.value = `已在本页内存中${selectedId.value ? '修改' : '新增'}「${fields.name}」。未写入后端或审计；如未显示，请检查筛选和分页。`
  changed.value = true
  await closeAfterMutation(selectedId.value ? `edit-${selectedId.value}` : 'category-add')
}
function openToggle(row: SystemCategory) { selectedId.value = row.id; dialog.value = 'toggle' }
function confirmToggle() {
  if (!selected.value) return
  selected.value.enabled = !selected.value.enabled
  selected.value.updated = '本次演示修改（未保存到后端）'
  notice.value = `已模拟${selected.value.enabled ? '启用' : '停用'}「${selected.value.name}」。历史引用不变；未影响真实用户或生成审计。`
  changed.value = true
  void closeAfterMutation(`toggle-${selectedId.value}`)
}
async function restore() { dialog.value = null; notice.value = ''; await load(); if (!loadError.value) notice.value = '已重新加载初始分类样例。未请求后端。' }

watch(() => route.fullPath, () => { Object.assign(draft, filters.value); dialog.value = null }, { immediate: true })
onMounted(load)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="business-page categories-page" aria-labelledby="categories-title">
    <div class="page-head"><div><h1 id="categories-title" class="page-title">分类管理</h1><p class="page-desc">维护系统预置分类，用户自建分类仅供核查。演示数据与真实业务隔离。</p></div><button class="btn" type="button" :disabled="loading" @click="dialog = 'restore'"><AppIcon name="i-refresh" size="sm" />恢复样例</button></div>
    <div class="banner banner-info ops-notice"><AppIcon name="i-info" /><div>新增、编辑和启停只保留在<b>本页内存</b>，刷新或离开页面后恢复。不会影响业务查询、真实用户或操作日志。<span v-if="changed"> 当前存在本地演示修改。</span></div></div>
    <p v-if="notice" class="ops-feedback" role="status">{{ notice }}</p>
    <div class="card query-card">
      <div class="ops-tabs" role="group" aria-label="分类来源"><button class="ops-tab" type="button" :aria-pressed="tab === 'system'" @click="changeTab('system')">系统预置</button><button class="ops-tab" type="button" :aria-pressed="tab === 'custom'" @click="changeTab('custom')">用户自建 <span class="tag tag-gray">只读</span></button></div>
      <form class="filter-bar" aria-label="分类筛选" @submit.prevent="submitFilters">
        <div class="field query-field wide-field"><label class="field-label" for="category-search">分类名称</label><input id="category-search" v-model="draft.name" class="input" placeholder="搜索名称关键词" maxlength="100"></div>
        <div class="field query-field short-field"><label class="field-label" for="category-filter-type">收支类型</label><select id="category-filter-type" v-model="draft.type" class="select"><option value="">全部类型</option><option>支出</option><option>收入</option></select></div>
        <div v-if="tab === 'system'" class="field query-field short-field"><label class="field-label" for="category-filter-status">状态</label><select id="category-filter-status" v-model="draft.status" class="select"><option value="">全部状态</option><option value="enabled">启用</option><option value="disabled">停用</option></select></div>
        <div v-else class="field query-field"><label class="field-label" for="category-user">所属用户 ID</label><input id="category-user" v-model="draft.user" class="input num" placeholder="如 U10231" maxlength="100"></div>
        <div class="filter-actions"><button class="btn btn-primary" type="submit" :disabled="loading"><AppIcon name="i-search" size="sm" />查询</button><button class="btn" type="button" @click="resetFilters">重置</button></div>
      </form>
      <div v-if="hasFilters" class="filter-chips" aria-label="已应用筛选"><span v-if="filters.name">名称：{{ filters.name }}</span><span v-if="filters.type">类型：{{ filters.type }}</span><span v-if="filters.status">状态：{{ filters.status === 'enabled' ? '启用' : '停用' }}</span><span v-if="filters.user">用户：{{ filters.user }}</span></div>
    </div>
    <div class="card table-card" :aria-busy="loading">
      <div class="table-toolbar"><h2 class="card-title">{{ tab === 'system' ? '系统预置分类' : '用户自建分类' }}<span class="tag tag-orange">演示子集</span></h2><button v-if="tab === 'system'" id="category-add" class="btn btn-primary btn-sm" type="button" :disabled="loading || loadError || !data" @click="openEditor()"><AppIcon name="i-plus" size="sm" />新增分类</button><span v-else class="text-3">不提供编辑、停用或删除</span></div>
      <TableState v-if="loading" state="loading" /><TableState v-else-if="loadError" state="error" @retry="load" /><TableState v-else-if="!total" :state="hasFilters ? 'noresult' : 'empty'" @reset="resetFilters" />
      <div v-else class="table-wrap">
        <table v-if="tab === 'system'" class="tbl categories-table"><caption class="sr-only">系统预置分类演示列表</caption><thead><tr><th scope="col">分类名称</th><th scope="col">类型</th><th scope="col">排序</th><th scope="col" class="num-h">历史引用（条）</th><th scope="col">状态</th><th scope="col">更新说明 / 时间</th><th scope="col">操作</th></tr></thead><tbody><tr v-for="row in systemRows.slice(start, start + pageSize)" :key="row.id"><td><span class="category-name"><span class="cat-icon"><AppIcon :name="row.icon" /></span>{{ row.name }}</span></td><td><span class="tag" :class="row.type === '支出' ? 'tag-red' : 'tag-green'">{{ row.type }}</span></td><td class="tnum">{{ row.order }}</td><td class="num-cell tnum">{{ row.refs.toLocaleString('zh-CN') }}</td><td><span class="tag" :class="row.enabled ? 'tag-green' : 'tag-gray'">{{ row.enabled ? '启用' : '停用' }}</span></td><td class="category-updated">{{ row.updated }}</td><td><div class="ops-row-actions"><button :id="`edit-${row.id}`" class="row-link" type="button" :aria-label="`编辑${row.name}`" @click="openEditor(row)">编辑</button><button :id="`toggle-${row.id}`" class="row-link" type="button" :aria-label="`${row.enabled ? '停用' : '启用'}${row.name}`" @click="openToggle(row)">{{ row.enabled ? '停用' : '启用' }}</button></div></td></tr></tbody></table>
        <table v-else class="tbl categories-table"><caption class="sr-only">用户自建分类只读演示列表</caption><thead><tr><th scope="col">分类名称</th><th scope="col">类型</th><th scope="col">所属用户</th><th scope="col" class="num-h">历史引用（条）</th><th scope="col">创建时间</th><th scope="col">权限</th></tr></thead><tbody><tr v-for="row in customRows.slice(start, start + pageSize)" :key="row.id"><td>{{ row.name }}</td><td><span class="tag" :class="row.type === '支出' ? 'tag-red' : 'tag-green'">{{ row.type }}</span></td><td><RouterLink class="detail-link num" :to="{ name: 'users', query: { user: row.userId, uid: row.userId } }">{{ row.userId }}</RouterLink></td><td class="num-cell tnum">{{ row.refs }}</td><td class="num">{{ row.created }}</td><td><span class="tag tag-gray">只读</span></td></tr></tbody></table>
      </div>
      <TablePagination v-if="!loading && !loadError" :page="page" :page-size="pageSize" :total="total" @change="changePage" />
      <p class="table-footnote">{{ tab === 'system' ? '同类型按序号升序排列；相同序号按分类 ID 排列。停用不删除历史引用，不提供删除操作。' : '用户自建分类由用户维护；此处仅展示核查所需的演示样例。' }}</p>
    </div>
    <AppDialog :model-value="dialog !== null" :title="dialogTitle" @update:model-value="value => { if (!value) dialog = null }">
      <form v-if="dialog === 'edit'" id="category-editor" class="category-editor" novalidate @submit.prevent="saveCategory">
        <p class="detail-note">{{ selected ? `历史引用 ${selected.refs.toLocaleString('zh-CN')} 条。类型和状态不在此修改，启停须单独确认。` : '新增默认启用，历史引用为 0；仅新增到本页演示集合。' }}</p>
        <div class="field"><label class="field-label" for="category-name">分类名称 <span aria-hidden="true">*</span></label><input id="category-name" v-model="editor.name" class="input" data-dialog-autofocus required :aria-invalid="Boolean(errors.name)" aria-describedby="category-name-error" placeholder="2–6 个字符，同类型不可重名"><p v-if="errors.name" id="category-name-error" class="field-error" role="alert">{{ errors.name }}</p></div>
        <div class="field"><label class="field-label" for="category-type">收支类型</label><select id="category-type" v-model="editor.type" class="select" :disabled="Boolean(selectedId)" :aria-invalid="Boolean(errors.type)"><option>支出</option><option>收入</option></select><p v-if="errors.type" class="field-error" role="alert">{{ errors.type }}</p></div>
        <fieldset id="category-icon" class="category-icon-field" tabindex="-1"><legend class="field-label">分类图标</legend><div class="category-icon-options"><label v-for="[icon, label] in categoryIcons" :key="icon" class="category-icon-option" :class="{ selected: editor.icon === icon }"><input v-model="editor.icon" type="radio" name="category-icon" :value="icon" :aria-label="`${label}图标`"><AppIcon :name="icon" /><span>{{ label }}</span></label></div><p v-if="errors.icon" class="field-error" role="alert">{{ errors.icon }}</p></fieldset>
        <div class="field"><label class="field-label" for="category-order">排序</label><input id="category-order" v-model.number="editor.order" class="input" type="number" min="1" max="99" step="1" :aria-invalid="Boolean(errors.order)" aria-describedby="category-order-note"><p id="category-order-note" :class="errors.order ? 'field-error' : 'detail-note'" :role="errors.order ? 'alert' : undefined">{{ errors.order || '1–99 的整数，数值越小越靠前；允许同序号。' }}</p></div>
      </form>
      <template v-else-if="dialog === 'toggle' && selected"><p class="ops-confirm-lead">确定{{ selected.enabled ? '停用' : '启用' }}「{{ selected.name }}」？</p><dl class="desc-list"><dt>收支类型</dt><dd>{{ selected.type }}</dd><dt>历史引用</dt><dd class="tnum">{{ selected.refs.toLocaleString('zh-CN') }} 条，保留不变</dd></dl><div class="banner banner-info"><AppIcon name="i-info" /><div>{{ selected.enabled ? '真实接入后，停用应只影响新记录可选项，不修改历史记录。' : '真实接入后，启用将恢复为新记录的可选分类。' }}本次仅改变页面演示状态，不生成审计。</div></div></template>
      <p v-else-if="dialog === 'restore'" class="ops-confirm-lead">将恢复初始分类样例，放弃本页所有演示修改。筛选条件保持不变，不影响真实数据。</p>
      <template #footer><button class="btn" type="button" :data-dialog-autofocus="dialog !== 'edit' ? '' : undefined" @click="dialog = null">取消</button><button v-if="dialog === 'edit'" class="btn btn-primary" type="submit" form="category-editor">保存演示修改</button><button v-else-if="dialog === 'toggle'" class="btn" :class="selected?.enabled ? 'btn-danger' : 'btn-primary'" type="button" @click="confirmToggle">确认{{ selected?.enabled ? '停用' : '启用' }}（演示）</button><button v-else class="btn btn-primary" type="button" @click="restore">确认恢复样例</button></template>
    </AppDialog>
  </section>
</template>
