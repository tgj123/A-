export const PINNED_BOARD_NAMES = [
  '医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人',
] as const

export interface BoardCandidate {
  name: string
  heatScore: number
}

export function selectPinnedBoards<T extends BoardCandidate>(boards: T[], limit: number): T[] {
  const byName = new Map(boards.map((board) => [board.name, board]))
  const pinned = PINNED_BOARD_NAMES.flatMap((name) => {
    const board = byName.get(name)
    return board ? [board] : []
  })
  const pinnedNames = new Set(pinned.map((board) => board.name))
  const remaining = boards
    .filter((board) => !pinnedNames.has(board.name))
    .sort((left, right) => right.heatScore - left.heatScore)

  return [...pinned, ...remaining].slice(0, limit)
}

export interface PublicBoardCandidate extends BoardCandidate {
  netInflow: number
  changePercent: number
}

export function selectPublicBoards<T extends PublicBoardCandidate>(boards: T[], limit: number): T[] {
  const pinnedNames = new Set<string>(PINNED_BOARD_NAMES)
  const pinned = boards.filter((board) => pinnedNames.has(board.name))
  const inflows = [...boards].filter((board) => board.netInflow >= 0)
    .sort((left, right) => right.netInflow - left.netInflow).slice(0, 4)
  const outflows = [...boards].filter((board) => board.netInflow < 0)
    .sort((left, right) => left.netInflow - right.netInflow).slice(0, 4)
  const gains = [...boards].filter((board) => board.changePercent >= 0)
    .sort((left, right) => right.changePercent - left.changePercent).slice(0, 4)
  const losses = [...boards].filter((board) => board.changePercent < 0)
    .sort((left, right) => left.changePercent - right.changePercent).slice(0, 4)
  const prioritized = [...pinned, ...inflows, ...outflows, ...gains, ...losses]
  const prioritizedNames = new Set(prioritized.map((board) => board.name))
  const remaining = boards.filter((board) => !prioritizedNames.has(board.name))
    .sort((left, right) => right.heatScore - left.heatScore)

  return [...new Map([...prioritized, ...remaining].map((board) => [board.name, board])).values()]
    .slice(0, limit)
}

export interface NormalizedBoardSignals {
  flow: number
  change: number
  amplitude: number
}

/**
 * 公共候选池以资金方向变化为核心；涨跌幅和振幅只用于补充板块活跃度。
 * 输入值应先在当批板块内归一化到 0～1。
 */
export function calculateBoardHeatScore(signals: NormalizedBoardSignals): number {
  return signals.flow * 0.7 + signals.change * 0.2 + signals.amplitude * 0.1
}
