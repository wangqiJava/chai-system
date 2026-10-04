<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ state: 'loading' | 'empty' | 'noresult' | 'error' | 'noauth'; title?: string; description?: string }>()
const emit = defineEmits<{ retry: []; reset: []; home: [] }>()
const states = {
  loading: { icon: 'i-clock', title: '正在加载演示数据', description: '仅加载本地样例，不请求业务接口。' },
  empty: { icon: 'i-inbox', title: '暂无演示数据', description: '当前演示子集没有记录，不代表真实业务数据为空。' },
  noresult: { icon: 'i-search', title: '未找到符合条件的结果', description: '请调整筛选条件，或清空筛选后重试。' },
  error: { icon: 'i-danger', title: '演示数据加载失败', description: '请重试；当前未连接真实管理接口。' },
  noauth: { icon: 'i-lock', title: '无访问权限', description: '请联系管理员核对权限。本组件仅定义展示状态。' },
}
const content = computed(() => states[props.state])
</script>

<template>
  <div class="state-block business-table-state" :role="state === 'error' ? 'alert' : 'status'" :aria-busy="state === 'loading'">
    <div class="state-ic"><span v-if="state === 'loading'" class="spin dark-spin" aria-hidden="true"></span><AppIcon v-else :name="content.icon" /></div>
    <p class="state-title">{{ title || content.title }}</p><p class="state-desc">{{ description || content.description }}</p>
    <button v-if="state === 'error'" class="btn btn-sm" type="button" @click="emit('retry')">重试</button>
    <button v-else-if="state === 'noresult'" class="btn btn-sm" type="button" @click="emit('reset')">清空筛选</button>
    <button v-else-if="state === 'noauth'" class="btn btn-sm" type="button" @click="emit('home')">返回概览</button>
  </div>
</template>
