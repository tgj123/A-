import { createMockDailyFundFlow } from './mockFundFlow'
import { TencentFundFlowAdapter } from './TencentFundFlowAdapter'
import type { DailyFundFlow, DataMode } from '../types/fundFlow'

const configuredMode = (import.meta.env.VITE_DATA_MODE ?? 'mock') as DataMode

export async function loadDailyFundFlow(
  date: string,
  signal?: AbortSignal,
): Promise<DailyFundFlow> {
  if (configuredMode !== 'tencent') return createMockDailyFundFlow(date)

  const adapter = new TencentFundFlowAdapter({
    endpoint: import.meta.env.VITE_TENCENT_FUND_FLOW_ENDPOINT ?? '',
    appId: import.meta.env.VITE_TENCENT_APP_ID,
  })
  return adapter.getDailyFundFlow(date, signal)
}
