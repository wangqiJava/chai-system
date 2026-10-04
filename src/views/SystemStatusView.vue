<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import TableState from '../components/TableState.vue'
import { loadDemoOperations, type OperationsData } from '../data/operations'
import { version } from '../../package.json'

const data = ref<OperationsData | null>(null)
const loading = ref(false)
const loadError = ref(false)
const refreshedAt = ref('')
let controller: AbortController | undefined
async function load() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  loadError.value = false
  try { data.value = await loadDemoOperations(request.signal); refreshedAt.value = new Date().toLocaleString('zh-CN', { hour12: false }) } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    loadError.value = true
  } finally { if (!request.signal.aborted) loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="business-page system-page" aria-labelledby="system-title">
    <div class="page-head"><div><h1 id="system-title" class="page-title">系统状态</h1><p class="page-desc">只读展示服务状态口径与待核验信息，不执行远程探测或运维操作。</p></div><button class="btn" type="button" :disabled="loading" @click="load"><AppIcon name="i-refresh" size="sm" />{{ loading ? '加载演示状态…' : '模拟刷新' }}</button></div>
    <div class="banner banner-info ops-notice"><AppIcon name="i-info" /><div><b>未接入生产监测。</b>“正常（模拟）”只用于展示界面，不能据此判断线上可用性、性能、备份或发布状态。</div></div>
    <p class="ops-refresh-note" role="status">{{ loading ? '正在重新加载本地样例，未发送健康检查请求。' : loadError ? '本地样例加载失败；不能据此判断真实服务异常。' : refreshedAt ? `本地刷新完成：${refreshedAt}（本机时间，非服务探测时间）。` : '尚未加载演示状态。' }}</p>
    <div v-if="loading || loadError" class="card"><TableState :state="loading ? 'loading' : 'error'" @retry="load" /></div>
    <template v-else-if="data">
      <div v-if="data.services.length" class="ops-service-grid"><section v-for="service in data.services" :key="service.name" class="card ops-service-card" :class="{ 'ops-service-unverified': service.status !== 'ok' }" :aria-label="service.name"><div class="ops-service-head"><span class="cat-icon"><AppIcon :name="service.icon" /></span><div class="ops-service-name"><h2>{{ service.name }}</h2><p>{{ service.purpose }}</p></div><span class="status" :class="service.status"><i aria-hidden="true"></i>{{ service.label }}</span></div><p class="ops-prose">{{ service.description }}</p><dl class="desc-list ops-service-details"><dt>最近真实探测</dt><dd>未执行</dd><template v-if="service.latency"><dt>响应耗时样例</dt><dd class="num">{{ service.latency }}</dd></template><dt>展示依据</dt><dd>{{ service.status === 'ok' ? data.snapshot : '等待授权接入或人工核验' }}</dd></dl></section></div>
      <div v-else class="card ops-notice"><TableState state="empty" title="暂无服务状态样例" description="演示集合为空，不代表真实服务不存在或停止运行。" /></div>
      <section class="card ops-version-card" aria-labelledby="versions-title"><div class="card-head"><h2 id="versions-title" class="card-title">版本信息</h2><span class="tag tag-orange">仅前端版本可确认</span></div><div class="card-body"><dl class="desc-list"><dt>本地管理前端</dt><dd class="num">v{{ version }}（package.json · 演示模式）</dd><dt>后端当前版本</dt><dd>未知 · 未连接服务器核验</dd><dt>小程序线上版本</dt><dd>未知 · 未读取微信发布记录</dd><dt>生产发布记录</dt><dd>未接入</dd></dl><p class="detail-note">本地构建成功不等于生产部署完成。历史记录或截图不能替代本次线上核验。</p></div></section>
      <section class="card ops-definition-card" aria-labelledby="status-definition-title"><div class="card-head"><h2 id="status-definition-title" class="card-title">状态口径与操作边界</h2><RouterLink class="detail-link" to="/audit-logs">查看日志示例</RouterLink></div><div class="card-body ops-prose"><ul class="ops-guidance-list"><li><b>正常 / 异常：</b>接入后应由真实探针结果判定，本页未执行探针。</li><li><b>未接入：</b>管理前端没有对应监测能力，不代表服务未部署。</li><li><b>未知：</b>尚无本次可验证的状态或版本依据。</li><li><b>只读边界：</b>不提供重启服务、数据库操作或配置修改；这些操作须走单独确认的运维流程。</li></ul></div></section>
    </template>
  </section>
</template>
