import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAmountToYuan,
  parseTonghuashunBoardTable,
  parseTonghuashunLargeOrderTable,
  parseTonghuashunStockTable,
} from './tonghuashunParser.mjs'

const BOARD_HTML = `
<table>
  <thead><tr><th>序号</th><th>行业</th><th>行业指数</th><th>涨跌幅</th><th>流入资金(亿)</th><th>流出资金(亿)</th><th>净额(亿)</th><th>公司家数</th><th>领涨股</th><th>涨跌幅</th><th>当前价(元)</th></tr></thead>
  <tbody>
    <tr><td>1</td><td><a href="/funds/hyzjl/board/885700/">军工装备</a></td><td>2175.17</td><td>2.06%</td><td>130.69</td><td>123.21</td><td>7.48</td><td>82</td><td>晟楠科技</td><td>29.96%</td><td>22.21</td></tr>
    <tr><td>2</td><td><a href="/funds/hyzjl/board/881169/">贵金属</a></td><td>6004.17</td><td>-0.40%</td><td>120.22</td><td>125.74</td><td>-5.53</td><td>14</td><td>招金黄金</td><td>5.03%</td><td>21.08</td></tr>
  </tbody>
</table>`

const STOCK_HTML = `
<table>
  <thead><tr><th>序号</th><th>股票代码</th><th>股票简称</th><th>流入资金(万)</th><th>流出资金(万)</th><th>净额(万)</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>300308</td><td>中际旭创</td><td>2012727.39</td><td>1757521.96</td><td>255205.43</td></tr>
  </tbody>
</table>`

const LARGE_ORDER_HTML = `
<table>
  <thead><tr><th>成交时间</th><th>股票代码</th><th>股票简称</th><th>成交价格</th><th>成交量(股)</th><th>成交额(万元)</th><th>大单性质</th></tr></thead>
  <tbody>
    <tr><td>09:31:00</td><td>688981</td><td>中芯国际</td><td>124.80</td><td>15300</td><td>190.94</td><td>买盘</td></tr>
    <tr><td>09:31:01</td><td>688981</td><td>中芯国际</td><td>124.80</td><td>5000</td><td>62.40</td><td>卖盘</td></tr>
  </tbody>
</table>`

test('金额单位统一转换为元', () => {
  assert.equal(parseAmountToYuan('7.48', '亿'), 748_000_000)
  assert.equal(parseAmountToYuan('-1533.56万'), -15_335_600)
  assert.equal(parseAmountToYuan('1.2亿'), 120_000_000)
  assert.equal(parseAmountToYuan('--', '亿'), null)
})

test('行业表保留同花顺原始名称和来源层级', () => {
  const rows = parseTonghuashunBoardTable(BOARD_HTML, 'industry')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    code: '885700',
    name: '军工装备',
    sourceType: 'industry',
    changePercent: 2.06,
    inflow: 13_069_000_000,
    outflow: 12_321_000_000,
    netInflow: 748_000_000,
    leadingStock: '晟楠科技',
  })
  assert.equal(rows[1]?.name, '贵金属')
  assert.equal(rows[1]?.netInflow, -553_000_000)
})

test('同一代码重复行只保留第一条有效记录', () => {
  const duplicateRow = '<tr><td>1</td><td><a href="/funds/hyzjl/board/885700/">军工装备</a></td><td>2175.17</td><td>2.06%</td><td>130.69</td><td>123.21</td><td>7.48</td><td>82</td><td>晟楠科技</td><td>29.96%</td><td>22.21</td></tr>'
  const rows = parseTonghuashunBoardTable(BOARD_HTML.replace('</tbody>', `${duplicateRow}</tbody>`), 'industry')
  assert.equal(rows.filter((row) => row.code === '885700').length, 1)
})

test('个股表解析全市场流入流出和净额', () => {
  const rows = parseTonghuashunStockTable(STOCK_HTML)
  assert.deepEqual(rows, [{
    code: '300308',
    name: '中际旭创',
    inflow: 20_127_273_900,
    outflow: 17_575_219_600,
    netInflow: 2_552_054_300,
  }])
})

test('大单追踪表按买卖性质解析成交金额', () => {
  assert.deepEqual(parseTonghuashunLargeOrderTable(LARGE_ORDER_HTML), [
    { time: '09:31:00', code: '688981', amount: 1_909_400, side: 'buy' },
    { time: '09:31:01', code: '688981', amount: 624_000, side: 'sell' },
  ])
})
