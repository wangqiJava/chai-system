<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { adminSession, adminCheckedAt } from '../state/admin-session'

const route = useRoute()
const isHome = computed(() => route.name === 'dashboard')
const title = computed(() => String(route.meta.title || '管理工作台'))
const modules = ['用户管理', '业务数据查询', '分类管理', '操作日志', '系统状态', '用户反馈']
const localTime = (value: string | number) => new Date(value).toLocaleString('zh-CN', { hour12: false })
</script>

<template>
  <section v-if="adminSession" class="api-workspace business-page" aria-labelledby="api-workspace-title">
    <div class="page-head"><div><h1 id="api-workspace-title" class="page-title">{{ title }}</h1><p class="page-desc">{{ isHome ? '管理员身份已由认证接口确认。此处不加载演示业务数据。' : '已通过管理员身份校验，但此模块尚未接入真实业务接口。' }}</p></div><span class="tag tag-green">真实认证模式</span></div>
    <div class="banner banner-info ops-notice"><AppIcon name="i-shield" /><div><b>用户、账本、流水、预算和系统分类管理已接入。</b>金额、预算金额、备注、余额和收支汇总不返回；业务访问审计仍待接入，不使用演示日志代替真实审计。</div></div>
    <section class="card api-identity-card" aria-labelledby="api-identity-title"><div class="card-head"><h2 id="api-identity-title" class="card-title">当前管理员</h2><span class="tag tag-green">身份已验证</span></div><div class="card-body"><dl class="desc-list"><dt>显示名称</dt><dd>{{ adminSession.admin.displayName }}</dd><dt>管理员账号</dt><dd class="num">{{ adminSession.admin.username }}</dd><dt>角色</dt><dd>管理员</dd><dt>最近身份校验</dt><dd>{{ localTime(adminCheckedAt) }}（本机显示时间）</dd><dt>会话到期</dt><dd>{{ localTime(adminSession.expiresAt) }}（服务端时限，本机时区）</dd></dl><p class="detail-note">登录凭据仅由浏览器通过 HttpOnly Cookie 携带，本页面不读取或展示令牌。</p></div></section>
    <section class="card api-integration-card" aria-labelledby="api-integration-title"><div class="card-head"><h2 id="api-integration-title" class="card-title">{{ isHome ? '业务接入进度' : `${title} · 接口待接入` }}</h2><span class="tag tag-orange">不展示样例代替实数</span></div><div class="card-body"><template v-if="isHome"><ul class="api-module-list"><li v-for="name in modules" :key="name"><RouterLink v-if="name === '用户管理' || name === '业务数据查询' || name === '分类管理'" :to="name === '用户管理' ? '/users' : name === '业务数据查询' ? '/business-data' : '/categories'">{{ name }}</RouterLink><span v-else>{{ name }}</span><span class="tag" :class="name === '用户管理' || name === '分类管理' ? 'tag-green' : name === '业务数据查询' ? 'tag-orange' : 'tag-gray'">{{ name === '用户管理' ? '已接入 · 只读' : name === '业务数据查询' ? '账本 / 流水 / 预算只读' : name === '分类管理' ? '系统分类可管理' : '接口待接入' }}</span></li></ul><p class="detail-note">用户、账本、流水和预算基础信息可只读查询；系统分类支持安全管理，用户自建分类只读；日志和生产监测仍待独立接入。</p></template><div v-else class="api-pending-module"><AppIcon name="i-lock" /><h3>此模块暂不可操作</h3><p>未加载演示集合，也未发送该模块的业务请求。请在接口接入完成后使用。</p><RouterLink class="btn btn-primary" to="/dashboard">返回管理工作台</RouterLink></div></div></section>
  </section>
</template>
