<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import logoUrl from '../assets/logo.png'
import { isDemoMode, authModeLabel, signIn, signOut } from '../state/auth'
import { cancelAdminLogin } from '../state/admin-session'
import { asAuthError } from '../api/admin-auth'
import { safeAuthDestination } from '../router'

const route = useRoute()
const router = useRouter()
const account = ref(isDemoMode ? 'demo-admin' : '')
const password = ref('')
const passwordVisible = ref(false)
const accountError = ref('')
const passwordError = ref('')
const submitError = ref('')
const loading = ref(false)
const accountInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
let loginTimer: ReturnType<typeof setTimeout> | undefined
let retryTimer: ReturnType<typeof setInterval> | undefined
let disposed = false
const retryUntil = ref(0)
const now = ref(Date.now())
const retrySeconds = computed(() => Math.max(0, Math.ceil((retryUntil.value - now.value) / 1000)))

const reasonMessage = computed(() => {
  if (!isDemoMode) {
    if (route.query.reason === 'expired') return '管理员会话已失效或尚未登录，请重新登录。'
    if (route.query.reason === 'logout') return '服务端已确认退出或会话已失效，请重新登录。'
    return ''
  }
  if (route.query.reason === 'expired') return '演示会话已过期，请重新进入。'
  if (route.query.reason === 'logout') return '已退出演示，本页未连接真实认证服务。'
  if (route.query.reason === 'signed-out') return '演示会话已结束，请重新进入。'
  return ''
})

async function submitLogin() {
  if (loading.value || retrySeconds.value) return
  accountError.value = ''
  passwordError.value = ''
  submitError.value = ''
  if (isDemoMode) {
    if (!account.value.trim()) accountError.value = '请输入演示账号'
    else if (account.value.trim() !== 'demo-admin') accountError.value = '当前仅支持演示账号 demo-admin，不验证真实管理员账号'
    if (!password.value.trim()) passwordError.value = '请填写一个演示口令，勿使用真实密码'
    else if (password.value.trim().length < 6) passwordError.value = '演示口令至少需要 6 个字符'
  } else {
    if (!/^[a-z][a-z0-9._-]{2,31}$/.test(account.value.trim().toLowerCase())) accountError.value = '账号须为 3–32 位字母、数字或 ._-，以字母开头'
    const chars = Array.from(password.value)
    if (!password.value.trim() || chars.length < 12 || chars.length > 128 || new TextEncoder().encode(password.value).length > 512 || chars.some(char => { const code = char.codePointAt(0)!; return code < 32 || (code >= 127 && code <= 159) || (code >= 0xD800 && code <= 0xDFFF) })) passwordError.value = '密码须为 12–128 个字符，不能全为空白或包含控制、无效字符'
  }
  if (accountError.value || passwordError.value) {
    await nextTick()
    if (accountError.value) accountInput.value?.focus()
    else passwordInput.value?.focus()
    return
  }
  loading.value = true
  try {
    if (isDemoMode) await new Promise<void>(resolve => { loginTimer = setTimeout(resolve, 500) })
    if (disposed) return
    await signIn(account.value.trim().toLowerCase(), password.value)
    password.value = ''
    await router.replace(safeAuthDestination(route.query.redirect))
  } catch (error) {
    if (disposed) return
    if (isDemoMode) { await signOut(); submitError.value = '无法进入演示页面，请重试。' }
    else {
      const known = asAuthError(error)
      if (known.kind === 'cancelled') return
      submitError.value = known.status === 401 ? '账号或密码错误，请重新输入。' : known.message
      if (known.status === 429 && known.retryAfter) {
        now.value = Date.now()
        retryUntil.value = now.value + known.retryAfter * 1000
        clearInterval(retryTimer)
        retryTimer = setInterval(() => { now.value = Date.now(); if (!retrySeconds.value) clearInterval(retryTimer) }, 1000)
      }
    }
  } finally { password.value = ''; loading.value = false }
}

onBeforeUnmount(() => { disposed = true; clearTimeout(loginTimer); clearInterval(retryTimer); cancelAdminLogin(); password.value = '' })
</script>

<template>
  <div class="auth-page app-auth">
    <div class="auth-brand"><img class="logo-mark" :src="logoUrl" width="36" height="36" alt=""><b>柴记账</b><span>管理后台</span></div>
    <main class="auth-card" aria-labelledby="login-title">
      <h1 id="login-title" class="auth-title">管理员登录</h1>
      <div class="auth-sub"><AppIcon name="i-lock" />仅限管理员 · {{ authModeLabel }}</div>
      <div v-if="reasonMessage" class="banner banner-info auth-banner" role="status"><AppIcon name="i-info" /><span>{{ reasonMessage }}</span></div>
      <div v-if="submitError" class="banner banner-danger auth-banner" role="alert">{{ submitError }}</div>
      <form novalidate :aria-busy="loading" @submit.prevent="submitLogin">
        <div class="auth-field field">
          <label class="field-label" for="login-account">{{ isDemoMode ? '演示账号' : '管理员账号' }}</label>
          <div class="input-icon"><AppIcon name="i-account" />
            <input id="login-account" ref="accountInput" v-model="account" class="input btn-block login-input" :autocomplete="isDemoMode ? 'off' : 'username'" autocapitalize="none" spellcheck="false" maxlength="64" :placeholder="isDemoMode ? '请输入演示账号' : '请输入管理员账号'" :disabled="loading" :aria-invalid="Boolean(accountError)" aria-describedby="account-error" required>
          </div>
          <p v-if="accountError" id="account-error" class="field-error" role="alert">{{ accountError }}</p>
        </div>
        <div class="auth-field field">
          <label class="field-label" for="login-password">{{ isDemoMode ? '演示口令（自行填写）' : '管理员密码' }}</label>
          <div class="input-icon"><AppIcon name="i-key" />
            <input id="login-password" ref="passwordInput" v-model="password" class="input btn-block login-input password-input" :type="passwordVisible ? 'text' : 'password'" :autocomplete="isDemoMode ? 'off' : 'current-password'" :maxlength="isDemoMode ? 128 : 256" :placeholder="isDemoMode ? '至少 6 个字符，勿使用真实密码' : '请输入 12–128 个字符的密码'" :disabled="loading" :aria-invalid="Boolean(passwordError)" aria-describedby="password-error login-instructions" required>
            <button class="icon-btn password-toggle" type="button" :disabled="loading" :aria-label="passwordVisible ? (isDemoMode ? '隐藏演示口令' : '隐藏密码') : (isDemoMode ? '显示演示口令' : '显示密码')" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible"><AppIcon :name="passwordVisible ? 'i-eyeoff' : 'i-eye'" size="sm" /></button>
          </div>
          <p v-if="passwordError" id="password-error" class="field-error" role="alert">{{ passwordError }}</p>
        </div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="loading || retrySeconds > 0"><span v-if="loading" class="spin" aria-hidden="true"></span>{{ loading ? (isDemoMode ? '正在进入…' : '正在验证…') : retrySeconds ? `请等待 ${retrySeconds} 秒` : isDemoMode ? '进入演示后台' : '登录管理后台' }}</button>
      </form>
      <div id="login-instructions" class="auth-demo-hint"><AppIcon name="i-info" size="sm" /><span v-if="isDemoMode">账号 <b class="num">demo-admin</b>；口令自行填写，仅检查长度，不发送或保存。</span><span v-else>仅使用已由管理员初始化的账号。密码只发送到本站认证接口，不写入应用存储。</span></div>
      <div v-if="isDemoMode" class="auth-foot">当前未连接真实认证或业务接口。<br>本地演示会话有效期 30 分钟，不构成访问控制。</div><div v-else class="auth-foot">身份与会话由服务端验证，接口不可用时不会回退到演示。<br>业务查询、分类、审计和系统状态已接入；用户反馈通过微信外部渠道处理。</div>
    </main>
    <p class="app-auth-footer">柴记账 · 管理后台 v0.1.0 · {{ authModeLabel }}</p>
  </div>
</template>
