const UNIT_MULTIPLIERS = {
  元: 1,
  万: 10_000,
  万元: 10_000,
  亿: 100_000_000,
  亿元: 100_000_000,
}

function decodeHtml(value) {
  return value
    .replace(/<br\s*\/?>/giu, ' ')
    .replace(/<[^>]+>/gu, '')
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .trim()
}

function parseCells(rowHtml, tagPattern = 't[hd]') {
  return [...rowHtml.matchAll(new RegExp(`<${tagPattern}\\b[^>]*>([\\s\\S]*?)<\\/${tagPattern}>`, 'giu'))]
    .map((match) => ({ html: match[1], text: decodeHtml(match[1]) }))
}

function normalizeHeader(value) {
  return value.replace(/[\s（）()]/gu, '').replace(/资金/gu, '')
}

function findColumn(headers, candidates) {
  const normalized = headers.map(normalizeHeader)
  return candidates.reduce((found, candidate) => {
    if (found >= 0) return found
    const target = normalizeHeader(candidate)
    return normalized.findIndex((header) => header === target || header.includes(target))
  }, -1)
}

function parseNumber(value) {
  const parsed = Number(String(value).replace(/[%+,\s]/gu, ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function parseAmountToYuan(value, defaultUnit = '元') {
  const text = String(value ?? '').replace(/[,\s]/gu, '').trim()
  if (!text || text === '--' || text === '-') return null
  const match = text.match(/^([+-]?\d+(?:\.\d+)?)(亿元|万元|亿|万|元)?$/u)
  if (!match) return null
  const amount = Number(match[1])
  const unit = match[2] || defaultUnit
  const multiplier = UNIT_MULTIPLIERS[unit]
  return Number.isFinite(amount) && multiplier ? Math.round(amount * multiplier) : null
}

function headerUnit(header, fallback = '元') {
  const unit = header.match(/\((亿元|万元|亿|万|元)\)/u)?.[1]
  return unit || fallback
}

function findDataTable(html, requiredHeaders) {
  for (const tableMatch of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/giu)) {
    const tableHtml = tableMatch[1]
    const headerRow = tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/iu)?.[0] ?? ''
    const headers = parseCells(headerRow).map((cell) => cell.text)
    if (requiredHeaders.every((candidate) => findColumn(headers, [candidate]) >= 0)) {
      return { tableHtml, headers }
    }
  }
  return null
}

function dataRows(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)].map((match) => match[1])
  return rows.slice(1).map((row) => parseCells(row, 'td')).filter((cells) => cells.length)
}

function cellText(cells, index) {
  return index >= 0 ? cells[index]?.text ?? '' : ''
}

function codeFromCell(cell) {
  if (!cell) return ''
  const hrefCode = cell.html.match(/(?:board|code)[\/-](\d{6})/iu)?.[1]
    ?? cell.html.match(/(?:board|code)\/(\d{6})/iu)?.[1]
  return hrefCode ?? cell.text.match(/\b\d{6}\b/u)?.[0] ?? ''
}

export function parseTonghuashunBoardTable(html, sourceType) {
  const table = findDataTable(html, ['行业', '流入资金', '流出资金', '净额'])
  if (!table) return []
  const { headers, tableHtml } = table
  const nameIndex = findColumn(headers, ['行业', '概念', '板块'])
  const changeIndex = findColumn(headers, ['涨跌幅'])
  const inflowIndex = findColumn(headers, ['流入资金', '流入'])
  const outflowIndex = findColumn(headers, ['流出资金', '流出'])
  const netIndex = findColumn(headers, ['净额'])
  const leaderIndex = headers.findIndex((header) => /领涨股/u.test(header))
  const seen = new Set()

  return dataRows(tableHtml).flatMap((cells) => {
    const nameCell = cells[nameIndex]
    const code = codeFromCell(nameCell)
    const name = nameCell?.text.trim() ?? ''
    const inflow = parseAmountToYuan(cellText(cells, inflowIndex), headerUnit(headers[inflowIndex] ?? ''))
    const outflow = parseAmountToYuan(cellText(cells, outflowIndex), headerUnit(headers[outflowIndex] ?? ''))
    const netInflow = parseAmountToYuan(cellText(cells, netIndex), headerUnit(headers[netIndex] ?? ''))
    const changePercent = parseNumber(cellText(cells, changeIndex))
    if (!code || !name || inflow === null || outflow === null || netInflow === null || changePercent === null || seen.has(code)) return []
    seen.add(code)
    return [{
      code,
      name,
      sourceType,
      changePercent,
      inflow,
      outflow,
      netInflow,
      leadingStock: cellText(cells, leaderIndex),
    }]
  })
}

export function parseTonghuashunStockTable(html) {
  const table = findDataTable(html, ['股票代码', '流入资金', '流出资金', '净额'])
  if (!table) return []
  const { headers, tableHtml } = table
  const codeIndex = findColumn(headers, ['股票代码', '代码'])
  const nameIndex = findColumn(headers, ['股票简称', '名称'])
  const inflowIndex = findColumn(headers, ['流入资金', '流入'])
  const outflowIndex = findColumn(headers, ['流出资金', '流出'])
  const netIndex = findColumn(headers, ['净额'])
  const seen = new Set()

  return dataRows(tableHtml).flatMap((cells) => {
    const code = cellText(cells, codeIndex).match(/\b\d{6}\b/u)?.[0] ?? ''
    const name = cellText(cells, nameIndex)
    const inflow = parseAmountToYuan(cellText(cells, inflowIndex), headerUnit(headers[inflowIndex] ?? ''))
    const outflow = parseAmountToYuan(cellText(cells, outflowIndex), headerUnit(headers[outflowIndex] ?? ''))
    const netInflow = parseAmountToYuan(cellText(cells, netIndex), headerUnit(headers[netIndex] ?? ''))
    if (!code || !name || [inflow, outflow, netInflow].some((value) => value === null) || seen.has(code)) return []
    seen.add(code)
    return [{ code, name, inflow, outflow, netInflow }]
  })
}

export function parseTonghuashunLargeOrderTable(html) {
  const table = findDataTable(html, ['成交时间', '股票代码', '成交额', '大单性质'])
  if (!table) return []
  const { headers, tableHtml } = table
  const timeIndex = findColumn(headers, ['成交时间'])
  const codeIndex = findColumn(headers, ['股票代码', '代码'])
  const amountIndex = findColumn(headers, ['成交额'])
  const sideIndex = findColumn(headers, ['大单性质'])

  return dataRows(tableHtml).flatMap((cells) => {
    const time = cellText(cells, timeIndex)
    const code = cellText(cells, codeIndex).match(/\b\d{6}\b/u)?.[0] ?? ''
    const amount = parseAmountToYuan(cellText(cells, amountIndex), headerUnit(headers[amountIndex] ?? '万元'))
    const sideText = cellText(cells, sideIndex)
    const side = sideText.includes('买') ? 'buy' : sideText.includes('卖') ? 'sell' : null
    return time && code && amount !== null && side ? [{ time, code, amount, side }] : []
  })
}
