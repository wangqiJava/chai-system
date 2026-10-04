<script lang="ts">
import iconSource from '../../prototype/js/icons.js?raw'

// 只读取仓库内的固定 SVG 路径，不执行原型脚本，也不接受外部 SVG 内容。
const paths = Object.fromEntries(
  Array.from(iconSource.matchAll(/sym\('([^']+)', '([^']+)'\);/g), match => [match[1], match[2]]),
)
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: string; size?: 'sm' | 'lg' }>()
const markup = computed(() => paths[props.name] || paths['i-info'] || '')
</script>

<template>
  <svg class="ic" :class="size ? `ic-${size}` : undefined" viewBox="0 0 24 24" aria-hidden="true" focusable="false" v-html="markup" />
</template>
