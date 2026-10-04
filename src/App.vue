<script setup lang="ts">
import { RouterView } from 'vue-router'
import { authChecking } from './state/auth'
import { adminPhase } from './state/admin-session'
</script>

<template>
  <main v-if="authChecking" class="auth-checking-page" role="status" aria-live="polite" aria-busy="true"><span class="spin dark-spin" aria-hidden="true"></span><h1>{{ adminPhase === 'logging-out' ? '正在确认退出' : '正在验证管理员身份' }}</h1><p>请等待服务端确认，不会切换为演示登录。</p></main>
  <RouterView v-else />
</template>
