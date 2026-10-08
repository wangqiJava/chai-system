<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import logoUrl from '../assets/logo.png'
import { authDisplayName, authExpired, authMemoryOnly, authVerified, authModeLabel, checkAuthSession, isDemoMode, signOut } from '../state/auth'
import { adminSession, adminPhase, adminCheckedAt } from '../state/admin-session'
import { asAuthError } from '../api/admin-auth'

const route = useRoute()
const router = useRouter()
const media = window.matchMedia('(max-width: 1280px)')
const narrow = ref(media.matches)
const narrowExpanded = ref(false)
const desktopCollapsed = ref(false)
const menuOpen = ref(false)
const accountMenu = ref<HTMLElement | null>(null)
const accountButton = ref<HTMLButtonElement | null>(null)
const logoutButton = ref<HTMLButtonElement | null>(null)
let sessionTimer: ReturnType<typeof setInterval> | undefined

try { desktopCollapsed.value = localStorage.getItem('chai-system.sidebar.collapsed.v1') === 'true' } catch {}

const collapsed = computed(() => narrow.value ? !narrowExpanded.value : desktopCollapsed.value)
const groups: { title: string; items: { name: string; icon: string; to?: string }[] }[] = [
  { title: '业务管理', items: [{ name: '用户管理', icon: 'i-user', to: '/users' }, { name: '业务数据查询', icon: 'i-book', to: '/business-data' }, { name: '分类管理', icon: 'i-tag', to: '/categories' }] },
  { title: '运维支持', items: [{ name: '操作日志', icon: 'i-log', to: '/audit-logs' }, { name: '系统状态', icon: 'i-server', to: '/system-status' }, { name: '用户反馈', icon: 'i-msg', to: '/feedback' }] },
]

function toggleSidebar() {
  if (narrow.value) narrowExpanded.value = !narrowExpanded.value
  else {
    desktopCollapsed.value = !desktopCollapsed.value
    try { localStorage.setItem('chai-system.sidebar.collapsed.v1', String(desktopCollapsed.value)) } catch {}
  }
}

function resizeSidebar(event: MediaQueryListEvent) {
  narrow.value = event.matches
  narrowExpanded.value = false
}

async function toggleAccountMenu() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) { await nextTick(); logoutButton.value?.focus() }
}

function closeAccountMenu(restoreFocus = false) {
  menuOpen.value = false
  if (restoreFocus) accountButton.value?.focus()
}

function outsideMenu(event: PointerEvent) {
  if (event.target instanceof Node && !accountMenu.value?.contains(event.target)) closeAccountMenu()
}

async function inspectSession(force = false) {
  if (!isDemoMode && ['checking', 'logging-out'].includes(adminPhase.value)) return
  if (!isDemoMode && !force && Date.now() - adminCheckedAt.value < 60000 && adminSession.value && Date.parse(adminSession.value.expiresAt) > Date.now()) return
  const redirect = route.fullPath
  try {
    if (!await checkAuthSession()) await router.replace({ name: 'login', query: { reason: !isDemoMode || authExpired.value ? 'expired' : 'signed-out', redirect } })
  } catch (error) {
    if (asAuthError(error).kind !== 'cancelled') await router.replace({ name: 'auth-status', query: { redirect } })
  }
}
function focusChanged() { void inspectSession(true) }

function visibilityChanged() {
  if (!document.hidden) void inspectSession(true)
}

async function logout() {
  closeAccountMenu()
  const redirect = route.fullPath
  try { await signOut(); await router.replace({ name: 'login', query: { reason: 'logout' } }) } catch (error) {
    if (asAuthError(error).kind !== 'cancelled') await router.replace({ name: 'auth-status', query: { redirect } })
  }
}

onMounted(() => {
  media.addEventListener('change', resizeSidebar)
  document.addEventListener('pointerdown', outsideMenu)
  document.addEventListener('visibilitychange', visibilityChanged)
  window.addEventListener('focus', focusChanged)
  sessionTimer = setInterval(() => { if (!document.hidden) void inspectSession() }, 15000)
})

onBeforeUnmount(() => {
  media.removeEventListener('change', resizeSidebar)
  document.removeEventListener('pointerdown', outsideMenu)
  document.removeEventListener('visibilitychange', visibilityChanged)
  window.removeEventListener('focus', focusChanged)
  clearInterval(sessionTimer)
})
</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <div class="layout app-layout">
    <aside id="admin-sidebar" class="sidebar" :class="{ collapsed, expanded: narrow && narrowExpanded }" aria-label="侧边导航">
      <RouterLink to="/dashboard" class="side-logo" aria-label="柴记账管理后台首页">
        <img class="logo-mark" :src="logoUrl" width="30" height="30" alt="">
        <span class="logo-text"><b>柴记账</b><i>管理后台</i></span>
      </RouterLink>
      <nav class="side-nav" aria-label="主要导航">
        <div class="nav-group">总览</div>
        <RouterLink to="/dashboard" class="nav-item" active-class="active" :title="isDemoMode ? '数据概览' : '管理工作台'" :aria-label="isDemoMode ? '数据概览' : '管理工作台'">
          <AppIcon name="i-overview" /><span>{{ isDemoMode ? '数据概览' : '管理工作台' }}</span>
        </RouterLink>
        <template v-for="group in groups" :key="group.title">
          <div class="nav-group">{{ group.title }}</div>
          <template v-for="item in group.items" :key="item.name">
            <RouterLink v-if="item.to" :to="item.to" class="nav-item" active-class="active" :title="isDemoMode || item.to === '/users' ? item.name : item.to === '/business-data' ? '账本/流水/预算只读，金额和备注只读展示' : item.to === '/categories' ? '系统分类可管理，用户自建分类只读' : item.to === '/audit-logs' ? '服务端审计日志，只读' : item.to === '/system-status' ? 'API、MySQL、Redis 实时连通性，只读' : item.to === '/feedback' ? '微信小程序原生反馈，外部渠道处理' : `${item.name}：接口待接入`" :aria-label="item.name"><AppIcon :name="item.icon" /><span>{{ item.name }}</span><span v-if="!isDemoMode && !['/users', '/audit-logs', '/system-status', '/feedback'].includes(item.to || '')" class="nav-tag pending-tag">{{ item.to === '/business-data' ? '已接入 · 只读' : item.to === '/categories' ? '部分可管理' : '待接入' }}</span><span v-else-if="!isDemoMode && item.to === '/feedback'" class="nav-tag external-tag">外部渠道</span></RouterLink>
            <button v-else class="nav-item nav-pending" type="button" disabled :title="`${item.name}：待后续开发`" :aria-label="`${item.name}，待开发`">
              <AppIcon :name="item.icon" /><span>{{ item.name }}</span><span class="nav-tag pending-tag">待开发</span>
            </button>
          </template>
        </template>
      </nav>
      <div class="side-foot">v0.1.0 · {{ authModeLabel }}<br>{{ isDemoMode ? '管理页面已齐 · 真实接口待接入' : '用户 / 账本 / 流水 / 预算 / 分类 / 审计日志 / 系统状态 / 微信反馈' }}</div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="icon-btn" type="button" :aria-label="collapsed ? '展开菜单' : '折叠菜单'" :aria-expanded="!collapsed" aria-controls="admin-sidebar" @click="toggleSidebar">
          <AppIcon name="i-collapse" />
        </button>
        <nav class="breadcrumb" aria-label="面包屑">
          <RouterLink to="/dashboard">首页</RouterLink><AppIcon name="i-chev-r" /><b aria-current="page">{{ route.meta.title }}</b>
        </nav>
        <div class="top-right">
          <span class="env-tag">{{ isDemoMode ? '演示模式 · 未接入后端' : '真实认证 · 只读管理' }}</span>
          <span class="top-divider" aria-hidden="true"></span>
          <div ref="accountMenu" class="account-menu" @keydown.esc.stop.prevent="closeAccountMenu(true)">
            <button ref="accountButton" class="admin-chip admin-toggle" type="button" aria-label="管理员菜单" :aria-expanded="menuOpen" aria-controls="account-dropdown" @click="toggleAccountMenu">
              <span class="avatar avatar-sm demo-avatar" aria-hidden="true">{{ isDemoMode ? '演' : Array.from(authDisplayName)[0] || '管' }}</span>
              <span class="name">{{ authDisplayName }}</span><AppIcon name="i-chev-d" />
            </button>
            <div v-if="menuOpen" id="account-dropdown" class="dropdown open">
              <div class="dropdown-item account-note"><AppIcon name="i-shield" size="sm" />{{ isDemoMode ? '仅本地演示会话' : '管理员 · 服务端会话' }}</div>
              <button ref="logoutButton" class="dropdown-item danger account-logout" type="button" @click="logout"><AppIcon name="i-logout" size="sm" />{{ isDemoMode ? '退出演示' : '退出登录' }}</button>
            </div>
          </div>
        </div>
      </header>
      <main id="main-content" class="content" tabindex="-1">
        <div v-if="authMemoryOnly" class="banner banner-warn storage-note" role="status">浏览器存储不可用，演示会话仅在当前页面保留，刷新后需要重新进入。</div>
        <RouterView v-if="isDemoMode || authVerified" />
      </main>
    </div>
  </div>
</template>
