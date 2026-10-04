export interface DemoAuditLog { time: string; admin: string; type: string; target: string; result: '成功' | '失败'; requestId: string; summary: string }
export interface DemoService { name: string; icon: string; status: 'ok' | 'off' | 'unknown'; label: string; purpose: string; description: string; latency?: string }
export interface OperationsData { logs: DemoAuditLog[]; services: DemoService[]; snapshot: string }

export const auditTypes = ['登录', '数据查询', '敏感数据查看', '分类管理']
// 日志来自原型；概览独有的失败登录样例补入集合，其请求 ID 显式标为 demo。
// 记录互不构成生产事实；本地操作不追加审计，也不继承原型中的账号锁定承诺。
const operationsData: OperationsData = {
  snapshot: '2026-09-30 10:00（固定演示时间）',
  logs: [
    { time: '2026-09-30 10:05:12', admin: '张明', type: '敏感数据查看', target: '用户 U10231 · 记账记录 R203101', result: '成功', requestId: 'req-8f3a2c6b', summary: '模拟授权查看单条记账记录，用途：排查用户反馈问题。摘要不包含金额和备注原文。' },
    { time: '2026-09-30 09:20:41', admin: '李雯', type: '数据查询', target: '用户管理列表', result: '成功', requestId: 'req-2d91e4af', summary: '查询用户列表，注册时间筛选：2026-09-01 至 2026-09-30。' },
    { time: '2026-09-30 09:12:08', admin: '张明', type: '登录', target: '管理后台', result: '成功', requestId: 'req-a17c05dd', summary: '管理员登录成功（固定示例，不代表当前演示会话）。' },
    { time: '2026-09-29 18:40:23', admin: '李雯', type: '分类管理', target: '系统分类「人情」· 停用', result: '成功', requestId: 'req-5b62f1e8', summary: '模拟停用系统预置支出分类「人情」，引用 690 条历史记录，历史记录保留不变。分类页与日志为独立样例，不构成真实变更链。' },
    { time: '2026-09-29 15:02:57', admin: '张明', type: '数据查询', target: '记账记录（用户 U10244）', result: '成功', requestId: 'req-c48d20b1', summary: '查询用户 U10244 在 2026-09-25 至 2026-09-26 的记录；金额保持遮蔽，未授权查看。' },
    { time: '2026-09-29 11:26:35', admin: '李雯', type: '登录', target: '管理后台', result: '失败', requestId: 'req-e93a77c2', summary: '登录失败：演示密码错误。真实账号锁定和限流策略尚未接入本管理前端。' },
    { time: '2026-09-28 17:08', admin: '李雯', type: '登录', target: '管理后台', result: '失败', requestId: 'demo-overview-login-failure', summary: '与概览失败登录样例对应。此请求 ID 为前端演示标识，不对应服务端请求。' },
    { time: '2026-09-28 16:44:10', admin: '张明', type: '分类管理', target: '系统分类「娱乐」· 排序调整', result: '成功', requestId: 'req-71f0b9a4', summary: '模拟将支出分类「娱乐」排序由 6 调整为 5。' },
    { time: '2026-09-28 09:30:19', admin: '张明', type: '数据查询', target: '账本列表', result: '成功', requestId: 'req-09bd5e63', summary: '查询账本列表，所属用户筛选：U10231。' },
  ],
  services: [
    { name: '后端服务', icon: 'i-server', status: 'ok', label: '正常（模拟）', purpose: 'chai-api · HTTP 服务', description: '展示正常状态样式，未向服务器发送健康检查请求。', latency: '86 ms（原型样例）' },
    { name: '数据库', icon: 'i-database', status: 'ok', label: '正常（模拟）', purpose: 'MySQL · 业务数据存储', description: '未建立数据库连接，不能据此判断生产可用性或备份状态。' },
    { name: 'Redis', icon: 'i-database', status: 'off', label: '未接入', purpose: '登录会话 / 缓存监测', description: '本管理前端尚未接入监测，不代表生产环境没有部署 Redis。' },
    { name: '小程序端版本', icon: 'i-monitor', status: 'unknown', label: '未知', purpose: '微信「柴记账」小程序', description: '未读取线上发布记录；实际版本和发布时间须在微信后台核验。' },
  ],
}

export function loadDemoOperations(signal?: AbortSignal): Promise<OperationsData> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      try { resolve(structuredClone(operationsData)) } catch (error) { reject(error) }
    }, 300)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
