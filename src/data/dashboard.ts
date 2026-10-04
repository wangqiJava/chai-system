export type TrendRange = 7 | 30

export interface DashboardMetric {
  label: string
  icon: string
  value: number
  unit: string
  period: string
  delta?: { direction: 'up' | 'down'; text: string }
}

export interface TrendPoint {
  date: string
  users: number
  records: number
}

export interface DashboardData {
  snapshot: string
  metrics: DashboardMetric[]
  trend: TrendPoint[]
  services: { name: string; detail: string; status: 'ok' | 'off' | 'unknown'; label: string }[]
  activities: { time: string; operator: string; action: string; result: '成功' | '失败' }[]
}

// 固定演示快照，沿用原型样例并统一交叉区间：7 天即 30 天末 7 天。
// 不调用管理接口；刷新不代表生产数据更新、健康检查或审计采集。
const users = [19, 22, 18, 25, 29, 33, 27, 21, 24, 30, 35, 38, 29, 23, 26, 32, 37, 41, 33, 25, 27, 34, 39, 28, 35, 41, 32, 38, 44, 36]
const records = [1480, 1520, 1390, 1610, 1705, 1830, 1590, 1420, 1500, 1660, 1780, 1855, 1620, 1470, 1540, 1710, 1840, 1960, 1730, 1560, 1620, 1770, 1890, 1720, 1850, 1690, 1905, 2040, 2210, 1892]

const demoData: DashboardData = {
  snapshot: '2026-09-30 10:00',
  metrics: [
    { label: '累计用户', icon: 'i-user', value: 12847, unit: '人', period: '上线起至演示快照时间' },
    { label: '今日新增用户', icon: 'i-plus', value: 36, unit: '人', period: '演示当日 00:00–10:00', delta: { direction: 'up', text: '较昨日同期 +4' } },
    { label: '今日记账笔数', icon: 'i-edit', value: 1892, unit: '笔', period: '演示当日 00:00–10:00', delta: { direction: 'down', text: '较昨日同期 -86' } },
    { label: '累计账本数', icon: 'i-book', value: 31206, unit: '本', period: '截至演示快照 · 户均 2.4 本' },
  ],
  trend: users.map((value, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, users: value, records: records[index] })),
  services: [
    { name: '后端服务', detail: '模拟状态，未连接服务', status: 'ok', label: '正常（模拟）' },
    { name: '数据库', detail: '模拟状态，未连接数据库', status: 'ok', label: '正常（模拟）' },
    { name: 'Redis', detail: '监测接口待接入', status: 'off', label: '未接入' },
    { name: '小程序端版本', detail: '须以发布核验结果为准', status: 'unknown', label: '未知' },
  ],
  activities: [
    { time: '09-30 10:05', operator: '张明', action: '敏感数据查看 · 用户 U10231 记账明细', result: '成功' },
    { time: '09-30 09:20', operator: '李雯', action: '数据查询 · 用户管理列表', result: '成功' },
    { time: '09-30 09:12', operator: '张明', action: '登录系统', result: '成功' },
    { time: '09-29 18:40', operator: '李雯', action: '分类管理 · 停用系统分类「人情」', result: '成功' },
    { time: '09-28 17:08', operator: '李雯', action: '登录系统（密码错误）', result: '失败' },
  ],
}

export function loadDemoDashboard(signal?: AbortSignal): Promise<DashboardData> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      try { resolve(structuredClone(demoData)) } catch (error) { reject(error) }
    }, 400)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
