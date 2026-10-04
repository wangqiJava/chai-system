<script setup lang="ts">
import { computed, useId } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{ page: number; pageSize: number; total: number; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ change: [page: number, pageSize: number] }>()
const id = `page-size-${useId()}`
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const current = computed(() => Math.min(Math.max(1, props.page), pages.value))
const start = computed(() => props.total ? (current.value - 1) * props.pageSize + 1 : 0)
const end = computed(() => Math.min(current.value * props.pageSize, props.total))
</script>

<template>
  <nav class="pager business-pager" aria-label="表格分页">
    <span class="total" aria-live="polite">共 {{ total }} 条<span v-if="total"> · 第 {{ start }}–{{ end }} 条</span></span>
    <div class="page-size-control"><label :for="id">每页</label><select :id="id" class="select" :value="pageSize" :disabled="disabled" @change="emit('change', 1, Number(($event.target as HTMLSelectElement).value))"><option v-for="size in [5, 10, 20]" :key="size" :value="size">{{ size }} 条</option></select></div>
    <div class="pages"><button class="page-btn" type="button" aria-label="上一页" :disabled="disabled || current <= 1 || !total" @click="emit('change', current - 1, pageSize)"><AppIcon name="i-chev-l" size="sm" /></button><span class="page-count tnum">{{ total ? `${current} / ${pages}` : '暂无记录' }}</span><button class="page-btn" type="button" aria-label="下一页" :disabled="disabled || current >= pages || !total" @click="emit('change', current + 1, pageSize)"><AppIcon name="i-chev-r" size="sm" /></button></div>
  </nav>
</template>
