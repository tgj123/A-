export const SNAPSHOT_SCHEMA_VERSION = 2
export const SNAPSHOT_SOURCE = 'tonghuashun'

function finite(value) {
  return Number.isFinite(value)
}

export function aggregateMarketFlow(stocks, largeOrders) {
  return {
    inflow: stocks.reduce((sum, stock) => sum + stock.inflow, 0),
    outflow: stocks.reduce((sum, stock) => sum + stock.outflow, 0),
    net: stocks.reduce((sum, stock) => sum + stock.netInflow, 0),
    largeBuy: largeOrders.filter((order) => order.side === 'buy').reduce((sum, order) => sum + order.amount, 0),
    largeSell: largeOrders.filter((order) => order.side === 'sell').reduce((sum, order) => sum + order.amount, 0),
  }
}

export function createTonghuashunSnapshot(
  tradingDate,
  time,
  boards,
  stocks,
  largeOrders,
  capturedAt = new Date().toISOString(),
) {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    source: SNAPSHOT_SOURCE,
    tradingDate,
    time,
    capturedAt,
    boards,
    marketFlow: aggregateMarketFlow(stocks, largeOrders),
  }
}

function validBoard(board) {
  return board && typeof board.code === 'string' && typeof board.name === 'string'
    && (board.sourceType === 'industry' || board.sourceType === 'concept')
    && ['inflow', 'outflow', 'netInflow', 'changePercent'].every((key) => finite(board[key]))
}

function validSnapshot(snapshot, date) {
  return snapshot?.schemaVersion === SNAPSHOT_SCHEMA_VERSION
    && snapshot?.source === SNAPSHOT_SOURCE
    && snapshot?.tradingDate === date
    && /^\d{2}:\d{2}$/u.test(snapshot?.time ?? '')
    && Array.isArray(snapshot?.boards)
    && snapshot.boards.every(validBoard)
    && snapshot.marketFlow
    && ['inflow', 'outflow', 'net', 'largeBuy', 'largeSell'].every((key) => finite(snapshot.marketFlow[key]))
}

export function isCompatibleDay(day) {
  return day?.schemaVersion === SNAPSHOT_SCHEMA_VERSION
    && day?.source === SNAPSHOT_SOURCE
    && /^\d{4}-\d{2}-\d{2}$/u.test(day?.date ?? '')
    && Array.isArray(day?.snapshots)
    && day.snapshots.every((snapshot) => validSnapshot(snapshot, day.date))
}
