import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateMarketFlow, createTonghuashunSnapshot, isCompatibleDay } from './fundFlowSnapshot.mjs'

const boards = [{
  code: '885700', name: '军工装备', sourceType: 'industry', changePercent: 2.06,
  inflow: 13_069_000_000, outflow: 12_321_000_000, netInflow: 748_000_000, leadingStock: '晟楠科技',
}, {
  code: '301001', name: '军工', sourceType: 'concept', changePercent: 0.28,
  inflow: 66_457_000_000, outflow: 68_401_000_000, netInflow: -1_944_000_000, leadingStock: '晟楠科技',
}]
const stocks = [{ code: '300308', name: '中际旭创', inflow: 20, outflow: 15, netInflow: 5 }]
const largeOrders = [{ time: '09:31:00', code: '300308', amount: 8, side: 'buy' }, { time: '09:31:01', code: '300308', amount: 6, side: 'sell' }]

test('五张卡片统一使用全市场个股和大单追踪口径', () => {
  assert.deepEqual(aggregateMarketFlow(stocks, largeOrders), {
    inflow: 20,
    outflow: 15,
    net: 5,
    largeBuy: 8,
    largeSell: 6,
  })
})

test('快照写入同花顺来源和版本且保留原始名称', () => {
  const snapshot = createTonghuashunSnapshot('2026-09-03', '09:31', boards, stocks, largeOrders, '2026-09-03T01:31:00.000Z')
  assert.equal(snapshot.schemaVersion, 2)
  assert.equal(snapshot.source, 'tonghuashun')
  assert.equal(snapshot.boards[0]?.name, '军工装备')
  assert.equal(snapshot.marketFlow.net, 5)
})

test('旧腾讯日期文件不能参与新快照匹配', () => {
  assert.equal(isCompatibleDay({ date: '2026-09-03', snapshots: [] }), false)
  assert.equal(isCompatibleDay({ schemaVersion: 2, source: 'tonghuashun', date: '2026-09-03', snapshots: [] }), true)
})
