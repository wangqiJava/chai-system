<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import TableState from '../components/TableState.vue'
import { AdminSystemError, fetchAdminSystemStatus, type AdminSystemStatus } from '../api/admin-system-status'

const route = useRoute()
const router = useRouter()
const data = ref<AdminSystemStatus | null>(null)
const loading = ref(false)
const loadError = ref('')
const responseMs = ref<number | null>(null)
const services = computed(() => data.value ? [
  { name: 'API 服务', icon: 'i-server', purpose: '当前后端管理员状态接口', ...data.value.checks.api, latencyMs: responseMs.value, metric: '本次请求往返耗时' },
  { name: 'MySQL', icon: 'i-database', purpose: '业务数据库连通性', ...data.value.checks.database, metric: '数据库探测耗时' },
  { name: 'Redis', icon: 'i-database', purpose: '会话存储连通性', ...data.value.checks.redis, metric: 'Redis 探测耗时' },
] : [])
const statusLabel = (status: string) => status === 'up' ? '正常' : status === 'timeout' ? '探测超时' : '异常'
const formatUptime = (seconds: number) => { const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60); return `${days ? `${days} 天 ` : ''}${String(hours).padStart(2, '0')} 小时 ${String(minutes).padStart(2, '0')} 分钟` }
const checkedAt = computed(() => data.value ? new Date(data.value.checkedAt).toLocaleString('zh-CN', { hour12: false }) : '')
let controller: AbortController | undefined
let generation = 0
let disposed = false

async function load() {
  const current = ++generation
  controller?.abort()
  controller = new AbortController()
  data.value = null
  responseMs.value = null
  loadError.value = ''
  loading.value = true
  const started = performance.now()
  try {
    const result = await fetchAdminSystemStatus(controller.signal)
    if (disposed || current !== generation) return
    data.value = result
    responseMs.value = Math.max(0, Math.round(performance.now() - started))
  } catch (error) {
    if (disposed || current !== generation || error instanceof AdminSystemError && error.kind === 'cancelled') return
    loadError.value = error instanceof AdminSystemError ? error.message : '系统状态查询失败，请重试。'
    if (error instanceof AdminSystemError && error.status === 401) await router.replace({ name: 'login', query: { redirect: route.fullPath, reason: 'expired' } }).catch(() => { loadError.value = '会话已失效，请刷新页面重新登录。' })
  } finally { if (!disposed && current === generation) loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => { disposed = true; ++generation; controller?.abort() })
</script>

<template>
  <section class="business-page system-page" aria-labelledby="api-system-title" :aria-busy="loading">
    <div class="page-head"><div><h1 id="api-system-title" class="page-title">系统状态</h1><p class="page-desc">查询当前后端 API、MySQL、Redis 连通性及运行信息。</p></div><button class="btn" type="button" :disabled="loading" @click="load"><AppIcon name="i-refresh" size="sm" />{{ loading ? '正在检查…' : '刷新状态' }}</button></div>
    <div v-if="loading" class="card"><TableState state="loading" title="正在检查服务状态" description="正在请求管理员状态接口并探测依赖服务。" /></div>
    <div v-else-if="loadError" class="card"><TableState state="error" title="未取得服务状态" :description="loadError" @retry="load" /></div>
    <template v-else-if="data">
      <div class="banner ops-notice" :class="data.status === 'ok' ? 'banner-info' : 'banner-warn'" role="status"><AppIcon :name="data.status === 'ok' ? 'i-shield' : 'i-danger'" /><div><b>{{ data.status === 'ok' ? '本次连通性检查通过。' : '本次检测发现依赖异常或超时。' }}</b> 最近探测：{{ checkedAt }}（服务端时间，本机时区）。</div></div>
      <div class="ops-service-grid"><section v-for="service in services" :key="service.name" class="card ops-service-card" :aria-label="service.name"><div class="ops-service-head"><span class="cat-icon"><AppIcon :name="service.icon" /></span><div class="ops-service-name"><h2>{{ service.name }}</h2><p>{{ service.purpose }}</p></div><span class="tag" :class="service.status === 'up' ? 'tag-green' : service.status === 'timeout' ? 'tag-orange' : 'tag-red'">{{ statusLabel(service.status) }}</span></div><p class="ops-prose">{{ service.message }}</p><dl class="desc-list ops-service-details"><dt>{{ service.metric }}</dt><dd class="num">{{ service.latencyMs }} ms</dd><dt>最近探测</dt><dd>{{ checkedAt }}</dd></dl></section></div>
      <section class="card"><div class="card-head"><h2 class="card-title">运行信息</h2><span class="tag tag-gray">只读</span></div><div class="card-body"><dl class="desc-list"><dt>Node.js 版本</dt><dd class="num">{{ data.runtime.nodeVersion }}</dd><dt>进程运行时长</dt><dd>{{ formatUptime(data.runtime.uptimeSeconds) }}</dd><dt>服务端检查耗时</dt><dd class="num">{{ data.durationMs }} ms</dd></dl></div></section>
      <section class="card"><div class="card-head"><h2 class="card-title">检查说明</h2><RouterLink class="detail-link" to="/audit-logs">查看操作日志</RouterLink></div><div class="card-body"><p class="ops-prose">状态来自当前连接的后端，刷新会重新检查。API 耗时包含网络往返和依赖探测，MySQL / Redis 耗时来自服务端单项探测；运行版本和时长来自当前后端进程。</p><p class="detail-note">连通性结果不能代替业务、备份恢复或生产发布验收。认证依赖不可用时，页面会显示无法取得快照；刷新失败会清除旧结果。</p></div></section>
    </template>
  </section>
</template>
