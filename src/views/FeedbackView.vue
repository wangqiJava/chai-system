<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
</script>

<template>
  <section class="business-page feedback-page" aria-labelledby="feedback-title">
    <div class="page-head"><div><h1 id="feedback-title" class="page-title">用户反馈</h1><p class="page-desc">沿用小程序原生反馈渠道。此页提供处理指引，不同步反馈内容。</p></div></div>
    <div class="banner banner-info ops-notice"><AppIcon name="i-info" /><div>反馈详情与处理入口以<b>微信小程序后台</b>实际展示为准。本管理前端没有读取、复制或保存反馈原文。</div></div>
    <div class="ops-feedback-grid">
      <section class="card" aria-labelledby="feedback-guide-title"><div class="card-head"><h2 id="feedback-guide-title" class="card-title">反馈核查流程</h2><span class="tag tag-blue">微信原生渠道</span></div><div class="card-body"><ol class="ops-workflow"><li><h3>在微信后台查看反馈</h3><p>使用具备该小程序管理权限的账号登录微信公众平台，进入对应小程序的反馈入口。实际菜单与权限以平台为准。</p></li><li><h3>按需核查关联信息</h3><p>仅在获得必要授权和明确用户标识后查询相关记录。不要根据昵称推断身份，也不要复制完整敏感标识。</p></li><li><h3>回到原渠道处理</h3><p>以微信后台可用能力记录处理结果。本管理前端不代发回复、通知或推送。</p></li></ol><div class="ops-feedback-actions"><a class="btn btn-primary" href="https://mp.weixin.qq.com" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">前往微信小程序后台<AppIcon name="i-link" size="sm" /><span class="sr-only">（在新标签页打开）</span></a><RouterLink class="btn" to="/users">查看用户演示列表</RouterLink></div><p class="detail-note">外部平台需单独登录；这里的演示会话不能用于微信认证。用户列表尚未接入真实数据，不能用于实际问题核查。</p></div></section>
      <section class="card" aria-labelledby="feedback-boundary-title"><div class="card-head"><h2 id="feedback-boundary-title" class="card-title">能力边界</h2></div><div class="card-body ops-prose"><ul class="ops-guidance-list"><li>不建设反馈列表或工单同步中心。</li><li>不提供在线客服会话。</li><li>不对用户发送消息、通知或推送。</li><li>不将演示查询当作真实用户问题的处理证据。</li></ul><div class="banner banner-info ops-feedback-privacy"><AppIcon name="i-shield" /><div>核查只使用完成任务所需的最少信息。不要将密码、令牌或用户财务原文粘贴到普通反馈记录中。</div></div></div></section>
    </div>
  </section>
</template>
