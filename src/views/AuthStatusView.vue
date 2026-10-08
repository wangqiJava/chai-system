<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import logoUrl from '../assets/logo.png'
import { adminFailure, adminLogoutPending, adminLogoutMarkerAvailable } from '../state/admin-session'
import { signOut } from '../state/auth'
import { asAuthError } from '../api/admin-auth'
import { safeAuthDestination } from '../router'

const route = useRoute()
const router = useRouter()
const destination = computed(() => safeAuthDestination(route.query.redirect))
const message = computed(() => adminLogoutPending.value ? '上次退出尚未得到服务端确认，管理页面已暂时锁定。请重试退出，不要将关闭页面当作服务端会话已撤销。' : adminFailure.value?.message || '需要重新验证管理员身份，才能进入管理页面。')
function retryVerification() { return router.replace(destination.value) }
function goLogin() { return router.replace({ name: 'login', query: { redirect: destination.value } }) }
async function retryLogout() {
  try { await signOut(); await router.replace({ name: 'login', query: { reason: 'logout' } }) } catch (error) {
    if (asAuthError(error).kind === 'cancelled') return
    await router.replace({ name: 'auth-status', query: { redirect: destination.value } })
  }
}
</script>

<template>
  <div class="auth-page app-auth api-auth-status">
    <div class="auth-brand"><img class="logo-mark" :src="logoUrl" width="36" height="36" alt=""><b>柴记账</b><span>管理后台</span></div>
    <main class="auth-card" aria-labelledby="auth-status-title"><div class="api-status-symbol"><AppIcon :name="adminLogoutPending ? 'i-lock' : 'i-server'" /></div><h1 id="auth-status-title" class="auth-title">{{ adminLogoutPending ? '退出尚未确认' : '暂时无法验证身份' }}</h1><p class="auth-sub">真实认证模式 · 不使用演示登录兜底</p><div class="banner banner-warn auth-banner" role="alert">{{ message }}</div><p v-if="adminFailure?.status" class="detail-note">认证接口状态：HTTP {{ adminFailure.status }}</p><p v-if="adminLogoutPending && !adminLogoutMarkerAvailable" class="detail-note">浏览器存储不可用，退出阻断提示仅保留在当前页面。请重试退出并等待确认。</p><div class="api-status-actions"><button v-if="adminLogoutPending" class="btn btn-primary" type="button" @click="retryLogout">重试退出</button><template v-else><button class="btn btn-primary" type="button" @click="retryVerification">重新验证身份</button><button class="btn" type="button" @click="goLogin">返回登录</button></template></div><div class="api-status-help"><h2>接入检查</h2><ul><li>确认后端管理员认证已获批启用，账号和数据库已准备。</li><li>确认页面与 API 同源，代理目标和 ADMIN_ORIGIN 一致。</li><li>Redis 或数据库不可用时等待恢复，不绕过鉴权。</li></ul></div></main>
    <p class="app-auth-footer">不保存密码或登录令牌，不展示未经验证的管理数据。</p>
  </div>
</template>
