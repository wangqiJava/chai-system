<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { adminSession, adminCheckedAt } from '../state/admin-session'
import { AdminOverviewError, fetchAdminOverview, fetchAdminOverviewTrend, type AdminOverview, type AdminOverviewTrend } from '../api/admin-overview'

const route = useRoute()
const isHome = computed(() => route.name === 'dashboard')
const title = computed(() => String(route.meta.title || '管理工作台'))
const modules = ['用户管理', '业务数据查询', '分类管理', '操作日志', '系统状态', '用户反馈']
const localTime = (value: string | number) => new Date(value).toLocaleString('zh-CN', { hour12: false })
const overview = ref<AdminOverview | null>(null)
const overviewLoading = ref(false)
const overviewError = ref('')
let overviewController: AbortController | undefined
let overviewDisposed = false
const trendRange = ref<7 | 30>(7)
const trend = ref<AdminOverviewTrend | null>(null)
const trendLoading = ref(false)
const trendError = ref('')
let trendController: AbortController | undefined
let trendDisposed = false
const trendMetrics = [
  { key: 'users', label: '新增用户' },
  { key: 'ledgers', label: '新建账本' },
  { key: 'transactions', label: '新增流水' },
  { key: 'budgets', label: '新增预算' },
  { key: 'categories', label: '新增分类' },
] as const
type TrendMetricKey = typeof trendMetrics[number]['key']
const formatNumber = new Intl.NumberFormat('zh-CN')

async function loadOverview() {
  overviewController?.abort()
  overviewController = new AbortController()
  overviewLoading.value = true
  overviewError.value = ''
  try { overview.value = await fetchAdminOverview(overviewController.signal) }
  catch (error) { if (error instanceof AdminOverviewError && error.kind === 'cancelled') return; overviewError.value = error instanceof AdminOverviewError ? error.message : '业务概览查询失败，请重试。' }
  finally { if (!overviewDisposed) overviewLoading.value = false }
}

async function loadTrend(days = trendRange.value) {
  trendController?.abort()
  trendController = new AbortController()
  trendLoading.value = true
  trendError.value = ''
  try { trend.value = await fetchAdminOverviewTrend(days, trendController.signal) }
  catch (error) { if (error instanceof AdminOverviewError && error.kind === 'cancelled') return; trendError.value = error instanceof AdminOverviewError ? error.message : '业务趋势查询失败，请重试。' }
  finally { if (!trendDisposed) trendLoading.value = false }
}

function changeTrendRange(days: 7 | 30) { trendRange.value = days; void loadTrend(days) }
function metricTotal(key: TrendMetricKey) { return trend.value?.series.reduce((total, point) => total + point[key], 0) || 0 }
function metricMax(key: TrendMetricKey) { return Math.max(1, ...(trend.value?.series || []).map(point => point[key])) }
function barHeight(key: TrendMetricKey, value: number) { return value ? Math.max(8, Math.round(value / metricMax(key) * 100)) : 2 }
function dateLabel(value: string) { return value.slice(5) }

onMounted(() => { if (isHome.value) { void loadOverview(); void loadTrend() } })
onBeforeUnmount(() => { overviewDisposed = true; overviewController?.abort(); trendDisposed = true; trendController?.abort() })
</script>

<template>
  <section v-if="adminSession" class="api-workspace business-page" aria-labelledby="api-workspace-title">
    <div class="page-head"><div><h1 id="api-workspace-title" class="page-title">{{ title }}</h1><p class="page-desc">{{ isHome ? '管理员身份已由认证接口确认。此处不加载演示业务数据。' : '已通过管理员身份校验，但此模块尚未接入真实业务接口。' }}</p></div><span class="tag tag-green">真实认证模式</span></div>
    <div class="banner banner-info ops-notice"><AppIcon name="i-shield" /><div><b>用户、账本、流水、预算、系统分类和业务访问审计已接入。</b>流水金额、备注和预算金额按管理员只读权限展示；账本余额和收支汇总不返回；系统状态仅提供实时连通性检查，不提供运维写操作。</div></div>
    <section class="card api-identity-card" aria-labelledby="api-identity-title"><div class="card-head"><h2 id="api-identity-title" class="card-title">当前管理员</h2><span class="tag tag-green">身份已验证</span></div><div class="card-body"><dl class="desc-list"><dt>显示名称</dt><dd>{{ adminSession.admin.displayName }}</dd><dt>管理员账号</dt><dd class="num">{{ adminSession.admin.username }}</dd><dt>角色</dt><dd>管理员</dd><dt>最近身份校验</dt><dd>{{ localTime(adminCheckedAt) }}（本机显示时间）</dd><dt>会话到期</dt><dd>{{ localTime(adminSession.expiresAt) }}（服务端时限，本机时区）</dd></dl><p class="detail-note">登录凭据仅由浏览器通过 HttpOnly Cookie 携带，本页面不读取或展示令牌。</p></div></section>
    <section v-if="isHome" class="card api-overview-card" aria-labelledby="api-overview-title"><div class="card-head"><h2 id="api-overview-title" class="card-title">实时业务规模</h2><span class="tag" :class="overview ? 'tag-green' : overviewError ? 'tag-red' : 'tag-gray'">{{ overview ? `已检查 · ${localTime(overview.checkedAt)}` : overviewError ? '读取失败' : '正在检查' }}</span><button class="btn btn-sm" type="button" :disabled="overviewLoading" :aria-label="overviewLoading ? '正在刷新业务规模' : '刷新业务规模'" @click="loadOverview"><AppIcon name="i-refresh" size="sm" />{{ overviewLoading ? '刷新中…' : '刷新' }}</button></div><div class="card-body"><p v-if="overviewLoading" class="detail-note">正在读取当前数据库中的可见数量…</p><p v-else-if="overviewError" class="field-error" role="alert">{{ overviewError }} <button class="btn btn-sm" type="button" @click="loadOverview">重试</button></p><dl v-else-if="overview" class="desc-list api-overview-list"><div class="api-overview-item"><dt>用户</dt><dd class="num">{{ overview.counts.users }}</dd></div><div class="api-overview-item"><dt>账本</dt><dd class="num">{{ overview.counts.ledgers }}</dd></div><div class="api-overview-item"><dt>流水</dt><dd class="num">{{ overview.counts.transactions }}</dd></div><div class="api-overview-item"><dt>预算</dt><dd class="num">{{ overview.counts.budgets }}</dd></div><div class="api-overview-item"><dt>分类</dt><dd class="num">{{ overview.counts.categories }}</dd></div></dl></div></section>
    <section v-if="isHome" class="card api-trend-card" aria-labelledby="api-trend-title"><div class="card-head"><div><h2 id="api-trend-title" class="card-title">新增趋势</h2><p class="card-sub">按 UTC 自然日统计当前可见数据</p></div><div class="seg" role="group" aria-label="趋势时间范围"><button v-for="days in ([7, 30] as const)" :key="days" class="seg-btn" :class="{ active: trendRange === days }" :aria-pressed="trendRange === days" type="button" @click="changeTrendRange(days)">最近 {{ days }} 天</button></div></div><div class="card-body"><p v-if="trendLoading" class="detail-note">正在读取趋势数据…</p><p v-else-if="trendError" class="field-error" role="alert">{{ trendError }} <button class="btn btn-sm" type="button" @click="loadTrend()">重试</button></p><template v-else-if="trend"><div class="api-trend-grid"><section v-for="metric in trendMetrics" :key="metric.key" class="api-trend-metric" :aria-labelledby="`api-trend-${metric.key}`"><div class="api-trend-metric-head"><span :id="`api-trend-${metric.key}`">{{ metric.label }}</span><strong class="num">{{ formatNumber.format(metricTotal(metric.key)) }}</strong></div><div class="api-trend-bars" role="img" :aria-label="`${metric.label}，${trend.days}天合计${formatNumber.format(metricTotal(metric.key))}`"><span v-for="point in trend.series" :key="point.date" class="api-trend-bar" :style="{ height: `${barHeight(metric.key, point[metric.key])}%` }" :title="`${point.date}：${formatNumber.format(point[metric.key])}`"></span></div><div class="api-trend-axis"><span>{{ dateLabel(trend.startDate) }}</span><span>{{ dateLabel(trend.endDate) }}</span></div></section></div><p class="detail-note">柱形高度表示每日数量相对变化；不展示金额或个人收支汇总。</p></template></div></section>
    <section class="card api-integration-card" aria-labelledby="api-integration-title"><div class="card-head"><h2 id="api-integration-title" class="card-title">{{ isHome ? '业务接入进度' : `${title} · 外部渠道` }}</h2><span class="tag tag-orange">不展示样例代替实数</span></div><div class="card-body"><template v-if="isHome"><ul class="api-module-list"><li v-for="name in modules" :key="name"><RouterLink v-if="['用户管理', '业务数据查询', '分类管理', '系统状态', '用户反馈'].includes(name)" :to="name === '用户管理' ? '/users' : name === '业务数据查询' ? '/business-data' : name === '分类管理' ? '/categories' : name === '系统状态' ? '/system-status' : '/feedback'">{{ name }}</RouterLink><span v-else>{{ name }}</span><span class="tag" :class="name === '用户管理' || name === '系统状态' || name === '操作日志' ? 'tag-green' : name === '业务数据查询' ? 'tag-green' : name === '分类管理' ? 'tag-orange' : name === '用户反馈' ? 'tag-blue' : 'tag-gray'">{{ name === '用户管理' ? '已接入 · 只读' : name === '业务数据查询' ? '已接入 · 只读' : name === '分类管理' ? '部分可管理' : name === '系统状态' ? '实时连通性 · 只读' : name === '操作日志' ? '已接入 · 只读' : '微信外部渠道' }}</span></li></ul><p class="detail-note">用户、账本、流水和预算基础信息可只读查询；系统分类支持安全管理，用户自建分类只读；系统状态提供 API、MySQL、Redis 连通性快照；用户反馈由微信后台处理。</p></template><div v-else class="api-pending-module"><AppIcon name="i-lock" /><h3>此模块暂不可操作</h3><p>未加载演示集合，也未发送该模块的业务请求。请在接口接入完成后使用。</p><RouterLink class="btn btn-primary" to="/dashboard">返回管理工作台</RouterLink></div></div></section>
  </section>
</template>

<style scoped>
.api-overview-list { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.api-overview-card { margin-bottom: 20px; }
.api-overview-card .card-head { flex-wrap: wrap; gap: 10px; }
.api-overview-card .card-head .btn { margin-left: auto; }
.api-overview-item { min-width: 0; padding: 14px 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--fill-1); }
.api-overview-item dt, .api-overview-item dd { margin: 0; }
.api-overview-item dt { color: var(--text-3); }
.api-overview-item dd { margin-top: 8px; color: var(--text-1); font-size: 22px; font-weight: 600; line-height: 1.2; }
.api-trend-card { margin-bottom: 20px; }
.api-trend-card .card-head { flex-wrap: wrap; gap: 10px; }
.api-trend-card .card-sub { margin-top: 4px; }
.api-trend-card .seg { margin-left: auto; }
.api-trend-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.api-trend-metric { min-width: 0; padding: 14px; border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--fill-1); }
.api-trend-metric-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.api-trend-metric-head span { color: var(--text-3); font-size: 13px; }
.api-trend-metric-head strong { color: var(--text-1); font-size: 18px; }
.api-trend-bars { display: flex; align-items: flex-end; gap: 3px; height: 88px; margin-top: 14px; padding-bottom: 1px; border-bottom: 1px solid var(--border); }
.api-trend-bar { flex: 1; min-width: 2px; min-height: 2px; border-radius: 3px 3px 0 0; background: var(--primary); opacity: .78; }
.api-trend-bar:hover { background: var(--primary-hover); opacity: 1; }
.api-trend-axis { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; color: var(--text-3); font-size: 11px; }
@media (max-width: 900px) { .api-overview-list { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 900px) { .api-trend-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 600px) { .api-overview-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .api-trend-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .api-trend-card .seg { margin-left: 0; } }
</style>
