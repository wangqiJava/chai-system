export interface DemoUser { id: string; name: string; registeredAt: string; lastRecordedAt: string; maskedOpenId: string }
export interface DemoLedger { id: string; name: string; userId: string; isDefault: boolean; historicalCount: number; createdAt: string }
export interface DemoRecord { id: string; userId: string; ledgerId: string; type: '支出' | '收入'; category: string; amount: number; date: string; createdAt: string; note: string }
export interface DemoBudget { id: string; userId: string; ledgerId: string; month: string; category: string; amount: number; createdAt: string }
export interface BusinessData { users: DemoUser[]; ledgers: DemoLedger[]; records: DemoRecord[]; budgets: DemoBudget[] }
export type BusinessTab = 'ledgers' | 'records' | 'budgets'

// 来源：prototype/users.html 与 prototype/data.html 的固定虚构样例。
// historicalCount 是演示历史汇总；records 仅为明细子集，不得当作全量记录。
// 所有金额仅在前端演示中使用，遮蔽不构成安全措施；未接入真实查询、鉴权或审计。
const businessData: BusinessData = {
  users: [
    { id: 'U10231', name: '晓婷爱存钱', registeredAt: '2026-03-12 10:24', lastRecordedAt: '2026-09-29 21:47', maskedOpenId: 'o7Xk3****9f2A' },
    { id: 'U10232', name: '思远的账本', registeredAt: '2026-04-02 15:10', lastRecordedAt: '2026-09-30 08:12', maskedOpenId: 'oQ8m2****c4De' },
    { id: 'U10233', name: '小林不剁手', registeredAt: '2026-05-18 09:32', lastRecordedAt: '2026-09-30 08:40', maskedOpenId: 'oP3nW****7bKq' },
    { id: 'U10244', name: '墨墨记账', registeredAt: '2026-06-30 20:05', lastRecordedAt: '2026-09-26 22:18', maskedOpenId: 'oL5vT****h2Rm' },
    { id: 'U10251', name: '晴天的钱包', registeredAt: '2026-08-09 11:47', lastRecordedAt: '2026-09-29 19:22', maskedOpenId: 'oH9bF****k8Xz' },
    { id: 'U10258', name: '翔哥省钱记', registeredAt: '2026-08-21 08:15', lastRecordedAt: '2026-09-28 09:30', maskedOpenId: 'oD2cJ****m5Np' },
    { id: 'U10266', name: '琪琪的小金库', registeredAt: '2026-09-14 22:30', lastRecordedAt: '2026-09-29 21:05', maskedOpenId: 'oA6gX****t3Vy' },
    { id: 'U10271', name: '楠得糊涂', registeredAt: '2026-09-29 19:03', lastRecordedAt: '2026-09-30 07:58', maskedOpenId: 'oE4sQ****w9Lu' },
  ],
  ledgers: [
    { id: 'L50021', name: '日常开销', userId: 'U10231', isDefault: true, historicalCount: 386, createdAt: '2026-03-12 10:30' },
    { id: 'L50022', name: '旅行基金', userId: 'U10231', isDefault: false, historicalCount: 46, createdAt: '2026-04-20 21:02' },
    { id: 'L50023', name: '装修存款', userId: 'U10231', isDefault: false, historicalCount: 80, createdAt: '2026-06-05 15:44' },
    { id: 'L50031', name: '日常开销', userId: 'U10232', isDefault: true, historicalCount: 214, createdAt: '2026-04-02 15:12' },
    { id: 'L50032', name: '报销暂存', userId: 'U10232', isDefault: false, historicalCount: 38, createdAt: '2026-05-11 09:26' },
    { id: 'L50041', name: '日常开销', userId: 'U10233', isDefault: true, historicalCount: 96, createdAt: '2026-05-18 09:35' },
    { id: 'L50052', name: '日常开销', userId: 'U10244', isDefault: true, historicalCount: 173, createdAt: '2026-06-30 20:08' },
    { id: 'L50053', name: '宝宝基金', userId: 'U10244', isDefault: false, historicalCount: 29, createdAt: '2026-07-15 11:40' },
    { id: 'L50061', name: '日常开销', userId: 'U10251', isDefault: true, historicalCount: 41, createdAt: '2026-08-09 11:50' },
    { id: 'L50071', name: '日常开销', userId: 'U10258', isDefault: true, historicalCount: 128, createdAt: '2026-08-21 08:18' },
    { id: 'L50081', name: '日常开销', userId: 'U10266', isDefault: true, historicalCount: 15, createdAt: '2026-09-14 22:32' },
    { id: 'L50091', name: '日常开销', userId: 'U10271', isDefault: true, historicalCount: 2, createdAt: '2026-09-29 19:05' },
  ],
  records: [
    { id: 'R203101', userId: 'U10231', ledgerId: 'L50021', type: '支出', category: '餐饮', amount: -38, date: '2026-09-29', createdAt: '2026-09-29 21:47', note: '和同事聚餐' },
    { id: 'R203102', userId: 'U10231', ledgerId: 'L50022', type: '支出', category: '交通', amount: -128.5, date: '2026-09-28', createdAt: '2026-09-28 10:15', note: '高铁票' },
    { id: 'R203103', userId: 'U10231', ledgerId: 'L50021', type: '收入', category: '理财', amount: 12.36, date: '2026-09-27', createdAt: '2026-09-27 08:00', note: '余额宝收益' },
    { id: 'R203110', userId: 'U10232', ledgerId: 'L50031', type: '支出', category: '购物', amount: -299, date: '2026-09-29', createdAt: '2026-09-29 20:31', note: '跑鞋' },
    { id: 'R203111', userId: 'U10232', ledgerId: 'L50031', type: '支出', category: '餐饮', amount: -25, date: '2026-09-30', createdAt: '2026-09-30 08:12', note: '早餐' },
    { id: 'R203118', userId: 'U10244', ledgerId: 'L50052', type: '支出', category: '教育', amount: -1580, date: '2026-09-26', createdAt: '2026-09-26 22:18', note: '绘画课季度费' },
    { id: 'R203119', userId: 'U10244', ledgerId: 'L50053', type: '支出', category: '人情', amount: -600, date: '2026-09-25', createdAt: '2026-09-25 19:02', note: '份子钱' },
    { id: 'R203124', userId: 'U10233', ledgerId: 'L50041', type: '支出', category: '餐饮', amount: -16, date: '2026-09-30', createdAt: '2026-09-30 08:40', note: '' },
    { id: 'R203125', userId: 'U10251', ledgerId: 'L50061', type: '支出', category: '交通', amount: -6, date: '2026-09-29', createdAt: '2026-09-29 19:22', note: '地铁' },
    { id: 'R203130', userId: 'U10258', ledgerId: 'L50071', type: '收入', category: '工资', amount: 8650, date: '2026-09-28', createdAt: '2026-09-28 09:30', note: '9 月工资' },
  ],
  budgets: [
    { id: 'B70001', userId: 'U10231', ledgerId: 'L50021', month: '2026-09', category: '', amount: 3000, createdAt: '2026-08-31 22:10' },
    { id: 'B70002', userId: 'U10231', ledgerId: 'L50021', month: '2026-09', category: '餐饮', amount: 1200, createdAt: '2026-08-31 22:11' },
    { id: 'B70003', userId: 'U10231', ledgerId: 'L50021', month: '2026-09', category: '交通', amount: 400, createdAt: '2026-08-31 22:12' },
    { id: 'B70004', userId: 'U10231', ledgerId: 'L50021', month: '2026-10', category: '', amount: 3000, createdAt: '2026-09-28 23:05' },
    { id: 'B70005', userId: 'U10232', ledgerId: 'L50031', month: '2026-09', category: '', amount: 2500, createdAt: '2026-09-01 08:20' },
    { id: 'B70006', userId: 'U10244', ledgerId: 'L50053', month: '2026-09', category: '', amount: 2000, createdAt: '2026-08-29 21:33' },
    { id: 'B70007', userId: 'U10244', ledgerId: 'L50053', month: '2026-10', category: '', amount: 2000, createdAt: '2026-09-26 22:40' },
  ],
}

export const categories = ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '教育', '人情', '宠物', '工资', '理财']
export const money = (value: number) => Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const queryText = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 100) : ''
export function pageNumber(value: unknown) { const n = Number(queryText(value)); return Number.isSafeInteger(n) && n > 0 && n <= 10000 ? n : 1 }
export function pageSizeNumber(value: unknown) { const n = Number(queryText(value)); return [5, 10, 20].includes(n) ? n : 10 }
export function dateRangeError(from: string, to: string) {
  const valid = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value)
  if (!valid(from) || !valid(to)) return '请输入有效日期'
  return from && to && from > to ? '开始日期不能晚于结束日期' : ''
}
export function avatarColor(id: string) {
  const colors = ['#007AFF', '#A64B99', '#DE6438', '#009CB0', '#6176B8']
  return colors[Array.from(id).reduce((total, char) => total + char.charCodeAt(0), 0) % colors.length]
}

export function loadDemoBusiness(signal?: AbortSignal): Promise<BusinessData> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      try { resolve(structuredClone(businessData)) } catch (error) { reject(error) }
    }, 300)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
