const configuredMode = import.meta.env.VITE_AUTH_MODE || (import.meta.env.PROD ? 'api' : 'demo')
if (configuredMode !== 'api' && configuredMode !== 'demo') throw new Error('VITE_AUTH_MODE 只能为 api 或 demo')

export const authMode: 'api' | 'demo' = configuredMode
export const isDemoMode = authMode === 'demo'
export const authModeLabel = isDemoMode ? '演示模式' : '真实认证模式'
