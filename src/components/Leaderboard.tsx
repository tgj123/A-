import type { SectorFundFlow } from '../types/fundFlow'

interface LeaderboardProps {
  sectors: SectorFundFlow[]
}

function formatCompact(value: number): string {
  const absolute = Math.abs(value)
  if (absolute >= 100_000_000) return `${value < 0 ? '-' : '+'}${(absolute / 100_000_000).toFixed(1)}亿`
  return `${value < 0 ? '-' : '+'}${(absolute / 10_000).toFixed(0)}万`
}

export function Leaderboard({ sectors }: LeaderboardProps) {
  return (
    <section className="leaderboard" aria-label="资金流领先板块">
      {sectors.slice(0, 3).map((sector, index) => (
        <div className="leader-row" key={sector.sectorCode}>
          <span className="leader-rank">0{index + 1}</span>
          <span className="leader-name">{sector.sectorName}</span>
          <span className={sector.netInflow >= 0 ? 'amount positive' : 'amount negative'}>
            {formatCompact(sector.netInflow)}
          </span>
        </div>
      ))}
    </section>
  )
}
