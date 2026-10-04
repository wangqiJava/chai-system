export type CategoryType = '支出' | '收入'
export interface SystemCategory { id: string; icon: string; name: string; type: CategoryType; order: number; refs: number; enabled: boolean; updated: string }
export interface CustomCategory { id: string; userId: string; name: string; type: CategoryType; refs: number; created: string }
export interface CategoryData { system: SystemCategory[]; custom: CustomCategory[] }
export interface CategoryDraft { name: string; type: CategoryType; icon: string; order: number }

export const categoryIcons = [
  ['i-bowl', '餐饮'], ['i-car', '交通'], ['i-bag', '购物'], ['i-home', '居住'], ['i-play', '娱乐'],
  ['i-med', '医疗'], ['i-edu', '教育'], ['i-gift', '礼物'], ['i-paw', '宠物'], ['i-dots', '其他'],
  ['i-cash', '现金'], ['i-medal', '奖励'], ['i-pie', '理财'], ['i-case', '工作'], ['i-envelope', '红包'],
]

// 沿用 prototype/categories.html 的固定样例；ID 仅为本地稳定行键。
// 每次进入页面重新克隆，不持久化，不改变业务查询样例或生产分类。
const categoryData: CategoryData = {
  system: [
    { id: 'SC01', icon: 'i-bowl', name: '餐饮', type: '支出', order: 1, refs: 9842, enabled: true, updated: '2026-05-11 10:02' },
    { id: 'SC02', icon: 'i-car', name: '交通', type: '支出', order: 2, refs: 6231, enabled: true, updated: '2026-05-11 10:02' },
    { id: 'SC03', icon: 'i-bag', name: '购物', type: '支出', order: 3, refs: 5804, enabled: true, updated: '2026-05-11 10:03' },
    { id: 'SC04', icon: 'i-home', name: '居住', type: '支出', order: 4, refs: 3120, enabled: true, updated: '2026-05-11 10:03' },
    { id: 'SC05', icon: 'i-play', name: '娱乐', type: '支出', order: 5, refs: 2386, enabled: true, updated: '2026-09-27 10:14' },
    { id: 'SC06', icon: 'i-med', name: '医疗', type: '支出', order: 6, refs: 864, enabled: true, updated: '2026-05-11 10:04' },
    { id: 'SC07', icon: 'i-edu', name: '教育', type: '支出', order: 7, refs: 752, enabled: true, updated: '2026-05-11 10:04' },
    { id: 'SC08', icon: 'i-gift', name: '人情', type: '支出', order: 8, refs: 690, enabled: false, updated: '2026-09-27 18:40' },
    { id: 'SC09', icon: 'i-paw', name: '宠物', type: '支出', order: 9, refs: 214, enabled: true, updated: '2026-05-11 10:05' },
    { id: 'SC10', icon: 'i-dots', name: '其他支出', type: '支出', order: 10, refs: 102, enabled: true, updated: '2026-05-11 10:05' },
    { id: 'SC11', icon: 'i-cash', name: '工资', type: '收入', order: 1, refs: 4102, enabled: true, updated: '2026-05-11 10:06' },
    { id: 'SC12', icon: 'i-pie', name: '理财', type: '收入', order: 2, refs: 1257, enabled: true, updated: '2026-05-11 10:06' },
    { id: 'SC13', icon: 'i-medal', name: '奖金', type: '收入', order: 3, refs: 618, enabled: true, updated: '2026-05-11 10:07' },
    { id: 'SC14', icon: 'i-envelope', name: '红包', type: '收入', order: 4, refs: 527, enabled: true, updated: '2026-05-11 10:07' },
    { id: 'SC15', icon: 'i-case', name: '兼职', type: '收入', order: 5, refs: 342, enabled: true, updated: '2026-05-11 10:08' },
    { id: 'SC16', icon: 'i-dots', name: '其他收入', type: '收入', order: 6, refs: 96, enabled: true, updated: '2026-05-11 10:08' },
  ],
  custom: [
    { id: 'CC01', userId: 'U10231', name: '奶茶咖啡', type: '支出', refs: 86, created: '2026-06-02 14:20' },
    { id: 'CC02', userId: 'U10233', name: '基金定投', type: '支出', refs: 27, created: '2026-06-18 09:12' },
    { id: 'CC03', userId: 'U10244', name: '宝宝用品', type: '支出', refs: 63, created: '2026-07-15 11:42' },
    { id: 'CC04', userId: 'U10266', name: '追星应援', type: '支出', refs: 9, created: '2026-09-20 23:05' },
    { id: 'CC05', userId: 'U10232', name: '游戏氪金', type: '支出', refs: 41, created: '2026-05-20 20:31' },
    { id: 'CC06', userId: 'U10258', name: '副业稿费', type: '收入', refs: 12, created: '2026-08-30 16:08' },
  ],
}

export function validateCategory(draft: CategoryDraft, rows: SystemCategory[], editingId?: string) {
  const errors: Partial<Record<keyof CategoryDraft, string>> = {}
  const name = draft.name.trim().normalize('NFC')
  if (Array.from(name).length < 2 || Array.from(name).length > 6 || /[\u0000-\u001f\u007f]/.test(name)) errors.name = '名称须为 2–6 个字符，不能包含控制字符'
  else if (rows.some(row => row.id !== editingId && row.type === draft.type && row.name.normalize('NFC').toLowerCase() === name.toLowerCase())) errors.name = '同一收支类型下已有该名称（含停用分类）'
  if (!['支出', '收入'].includes(draft.type)) errors.type = '请选择收支类型'
  if (!categoryIcons.some(([icon]) => icon === draft.icon)) errors.icon = '请选择一个分类图标'
  if (!Number.isInteger(draft.order) || draft.order < 1 || draft.order > 99) errors.order = '排序须为 1–99 的整数；相同序号按分类 ID 排列'
  return errors
}

export function loadDemoCategories(signal?: AbortSignal): Promise<CategoryData> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      try { resolve(structuredClone(categoryData)) } catch (error) { reject(error) }
    }, 300)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
