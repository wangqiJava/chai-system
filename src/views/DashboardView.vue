<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { loadDemoDashboard, type DashboardData, type TrendRange } from '../data/dashboard'

const dashboard = ref<DashboardData | null>(null)
const range = ref<TrendRange>(7)
const loading = ref(false)
const loadError = ref('')
const announcement = ref('')
const chartBox = ref<HTMLElement | null>(null)
const chartWidth = ref(340)
const hovered = ref<{ kind: 'users' | 'records'; index: number } | null>(null)
const charts = [
  { key: 'users', title: '新增用户', unit: '人 / 日', maximum: 100 },
  { key: 'records', title: '记账笔数', unit: '笔 / 日', maximum: 2500 },
] as const
const fractions = [0, .25, .5, .75, 1]
const number = new Intl.NumberFormat('zh-CN')
let controller: AbortController | undefined
let observer: ResizeObserver | undefined

const trend = computed(() => dashboard.value?.trend.slice(-range.value) || [])
const trendPeriod = computed(() => trend.value.length ? `${trend.value[0].date} 至 ${trend.value[trend.value.length - 1].date}` : '')
const plotWidth = computed(() => Math.max(chartWidth.value - 58, 180))
const barWidth = computed(() => Math.min(30, plotWidth.value / Math.max(trend.value.length, 1) * .58))
const linePoints = computed(() => trend.value.map((point, index) => `${pointX(index, 'users')},${pointY(point.users, 100)}`).join(' '))
const areaPoints = computed(() => `38,196 ${linePoints.value} ${chartWidth.value - 20},196`)

function pointX(index: number, kind: 'users' | 'records') {
  if (kind === 'records') return 38 + (index + .5) * plotWidth.value / Math.max(trend.value.length, 1)
  return 38 + index * plotWidth.value / Math.max(trend.value.length - 1, 1)
}

function pointY(value: number, maximum: number) {
  return 196 - value / maximum * 184
}

function showDate(index: number) {
  return range.value === 7 || index === 0 || index === trend.value.length - 1 || index % 5 === 0
}

function inspectPoint(kind: 'users' | 'records', index: number) {
  hovered.value = { kind, index }
}

function movePoint(kind: 'users' | 'records', step: number) {
  const current = hovered.value?.kind === kind ? hovered.value.index : trend.value.length - 1
  hovered.value = { kind, index: Math.max(0, Math.min(trend.value.length - 1, current + step)) }
}

function pointDescription(kind: 'users' | 'records') {
  const index = hovered.value?.kind === kind ? hovered.value.index : -1
  const point = trend.value[index]
  if (!point) return '悬停或聚焦图表后按左右方向键查看明细'
  return `${point.date} · ${number.format(point[kind])} ${kind === 'users' ? '人' : '笔'}`
}

function setRange(value: TrendRange) {
  range.value = value
  hovered.value = null
}

function observeChart() {
  observer?.disconnect()
  if (!chartBox.value) return
  chartWidth.value = Math.max(238, Math.round(chartBox.value.clientWidth))
  observer = new ResizeObserver(([entry]) => {
    if (entry) chartWidth.value = Math.max(238, Math.round(entry.contentRect.width))
  })
  observer.observe(chartBox.value)
}

async function refresh() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  announcement.value = ''
  controller?.abort()
  const request = new AbortController()
  controller = request
  try {
    dashboard.value = await loadDemoDashboard(request.signal)
    announcement.value = '演示数据已载入，未请求后端或执行服务检查。'
    await nextTick()
    observeChart()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    loadError.value = '演示数据载入失败，请重试。'
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

onMounted(refresh)
onBeforeUnmount(() => { controller?.abort(); observer?.disconnect() })
</script>

<template>
  <section class="dashboard-page" aria-labelledby="dashboard-title">
    <div class="page-head">
      <div>
        <h1 id="dashboard-title" class="page-title">数据概览</h1>
        <p class="page-desc">小程序使用情况 · 固定演示快照<span v-if="dashboard">：{{ dashboard.snapshot }}</span>，不代表生产数据。</p>
      </div>
      <button class="btn" type="button" :disabled="loading" :aria-busy="loading" @click="refresh"><span v-if="loading" class="spin dark-spin" aria-hidden="true"></span><AppIcon v-else name="i-refresh" />{{ loading ? '刷新中…' : '刷新演示数据' }}</button>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
    <div v-if="loadError" class="banner banner-danger load-error" role="alert"><AppIcon name="i-danger" /><span>{{ loadError }}</span><button class="btn btn-sm" type="button" :disabled="loading" @click="refresh">重试</button></div>

    <template v-if="dashboard">
      <div class="metric-grid" :aria-busy="loading">
        <article v-for="(metric, index) in dashboard.metrics" :key="metric.label" class="card metric-card" :aria-labelledby="`metric-${index}`">
          <h2 :id="`metric-${index}`" class="metric-label"><AppIcon :name="metric.icon" size="sm" />{{ metric.label }}</h2>
          <div class="metric-value tnum">{{ number.format(metric.value) }}<span class="unit">{{ metric.unit }}</span></div>
          <div class="metric-foot"><span>{{ metric.period }}</span><span v-if="metric.delta" class="delta" :class="metric.delta.direction"><AppIcon :name="metric.delta.direction === 'up' ? 'i-up' : 'i-down'" />{{ metric.delta.text }}</span></div>
        </article>
      </div>

      <div class="ov-grid">
        <div class="ov-col">
          <section class="card" aria-labelledby="trend-title">
            <div class="card-head">
              <div><h2 id="trend-title" class="card-title">使用趋势</h2><p class="card-sub">统计周期：{{ trendPeriod }}<br class="compact-break">（09-30 截至 10:00）</p></div>
              <div class="spacer"></div>
              <div class="seg" role="group" aria-label="趋势时间范围"><button v-for="value in ([7, 30] as const)" :key="value" class="seg-btn" :class="{ active: range === value }" :aria-pressed="range === value" type="button" @click="setRange(value)">最近 {{ value }} 天</button></div>
            </div>
            <div class="card-body">
              <div ref="chartBox" class="chart-measure" aria-hidden="true"></div>
              <div class="trend-duo">
                <section v-for="chart in charts" :key="chart.key" class="trend-chart" :aria-labelledby="`${chart.key}-title`">
                  <h3 :id="`${chart.key}-title`" class="chart-title">{{ chart.title }}</h3>
                  <p class="chart-unit">单位：{{ chart.unit }}</p>
                  <div class="chart-box dashboard-chart">
                    <svg :viewBox="`0 0 ${chartWidth} 220`" role="img" tabindex="0" :aria-label="`${chart.title}${chart.key === 'users' ? '折线图' : '柱状图'}，${range}天演示数据`" :aria-describedby="`${chart.key}-description`" @focus="inspectPoint(chart.key, trend.length - 1)" @blur="hovered = null" @keydown.left.prevent="movePoint(chart.key, -1)" @keydown.right.prevent="movePoint(chart.key, 1)" @mouseleave="hovered = null">
                      <defs v-if="chart.key === 'users'"><linearGradient id="users-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#007AFF" stop-opacity=".12" /><stop offset="100%" stop-color="#007AFF" stop-opacity="0" /></linearGradient></defs>
                      <g v-for="fraction in fractions" :key="fraction" aria-hidden="true">
                        <line x1="38" :x2="chartWidth - 20" :y1="196 - fraction * 184" :y2="196 - fraction * 184" stroke="#F2F3F5" />
                        <text x="30" :y="200 - fraction * 184" text-anchor="end">{{ number.format(chart.maximum * fraction) }}</text>
                      </g>
                      <template v-if="chart.key === 'users'">
                        <polygon :points="areaPoints" fill="url(#users-area)" />
                        <polyline :points="linePoints" fill="none" stroke="#007AFF" stroke-width="1.8" />
                        <circle v-for="(point, index) in trend" :key="point.date" :cx="pointX(index, chart.key)" :cy="pointY(point.users, chart.maximum)" :r="hovered?.kind === chart.key && hovered.index === index ? 4 : 2.8" fill="white" stroke="#007AFF" stroke-width="1.5" @mouseenter="inspectPoint(chart.key, index)"><title>{{ point.date }}：{{ point.users }} 人</title></circle>
                      </template>
                      <template v-else><rect v-for="(point, index) in trend" :key="point.date" :x="pointX(index, chart.key) - barWidth / 2" :y="pointY(point.records, chart.maximum)" :width="barWidth" :height="196 - pointY(point.records, chart.maximum)" rx="2" :fill="hovered?.kind === chart.key && hovered.index === index ? '#0062CC' : '#3091FF'" @mouseenter="inspectPoint(chart.key, index)"><title>{{ point.date }}：{{ number.format(point.records) }} 笔</title></rect></template>
                      <template v-for="(point, index) in trend" :key="`date-${point.date}`"><text v-if="showDate(index)" :x="pointX(index, chart.key)" y="216" text-anchor="middle" aria-hidden="true">{{ point.date.slice(5) }}</text></template>
                    </svg>
                  </div>
                  <p :id="`${chart.key}-description`" class="chart-inspect" role="status">{{ pointDescription(chart.key) }}</p>
                </section>
              </div>
              <div class="banner banner-info chart-note"><AppIcon name="i-info" /><div>活跃、留存及预算使用率指标<b>待接入</b>。本页不汇总用户个人收支金额。</div></div>
              <details class="trend-data"><summary>查看趋势数据表（{{ range }} 天）</summary><div class="table-wrap"><table class="tbl"><caption class="sr-only">{{ trendPeriod }} 演示趋势数据</caption><thead><tr><th scope="col">日期</th><th scope="col" class="num-h">新增用户（人）</th><th scope="col" class="num-h">记账笔数（笔）</th></tr></thead><tbody><tr v-for="point in trend" :key="point.date"><td class="num">{{ point.date }}</td><td class="num-cell tnum">{{ point.users }}</td><td class="num-cell tnum">{{ number.format(point.records) }}</td></tr></tbody></table></div></details>
            </div>
          </section>
        </div>

        <div class="ov-col">
          <section class="card" aria-labelledby="services-title">
            <div class="card-head"><h2 id="services-title" class="card-title">服务状态摘要</h2><span class="tag tag-orange">模拟数据</span></div>
            <div class="card-body service-list">
              <div v-for="service in dashboard.services" :key="service.name" class="svc-row"><span class="status" :class="service.status"><i aria-hidden="true"></i>{{ service.label }}</span><div class="service-copy"><span class="name">{{ service.name }}</span><span class="meta">{{ service.detail }}</span></div></div>
              <p class="section-note">未执行健康检查；生产状态须另行核验。<br><RouterLink class="detail-link" to="/system-status">查看状态详情与核验边界</RouterLink></p>
            </div>
          </section>
          <section class="card" aria-labelledby="activities-title">
            <div class="card-head"><h2 id="activities-title" class="card-title">最近管理员操作</h2><span class="tag tag-orange">示例记录</span></div>
            <div class="card-body activity-list">
              <div v-for="activity in dashboard.activities" :key="activity.time" class="op-row"><time class="t">{{ activity.time }}</time><span>{{ activity.operator }}</span><span class="activity-action" :title="activity.action">{{ activity.action }}</span><span class="tag" :class="activity.result === '成功' ? 'tag-green' : 'tag-red'">{{ activity.result }}</span></div>
              <p class="section-note">固定演示记录，不会随本地操作生成审计日志。<br><RouterLink class="detail-link" to="/audit-logs">查看操作日志示例</RouterLink></p>
            </div>
          </section>
        </div>
      </div>
    </template>
    <div v-else-if="loading" class="dashboard-skeleton" role="status" aria-label="正在加载演示概览"><div class="metric-grid"><div v-for="n in 4" :key="n" class="card metric-card"><span class="sk md"></span><span class="sk lg skeleton-value"></span></div></div><div class="card skeleton-chart"><span class="sk lg"></span></div></div>
  </section>
</template>
