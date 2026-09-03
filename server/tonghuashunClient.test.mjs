import test from 'node:test'
import assert from 'node:assert/strict'
import { TonghuashunClient, validateTonghuashunHtml } from './tonghuashunClient.mjs'

test('校验拒绝登录、验证码和空表响应', () => {
  assert.throws(() => validateTonghuashunHtml('<html>访问过于频繁，请完成验证码</html>', ['行业']), /验证|限流/u)
  assert.throws(() => validateTonghuashunHtml('<html><table></table></html>', ['行业']), /缺少字段/u)
  assert.doesNotThrow(() => validateTonghuashunHtml('<table><tr><th>行业</th><th>净额</th></tr></table>', ['行业', '净额']))
})

test('客户端复用单一浏览器上下文并在关闭时释放', async () => {
  const calls = []
  const page = {
    async goto(url) { calls.push(['goto', url]) },
    async evaluate(url) { calls.push(['evaluate', url]); return '<table><tr><th>行业</th><th>净额</th></tr></table>' },
  }
  const context = { async newPage() { calls.push(['newPage']); return page }, async close() { calls.push(['contextClose']) } }
  const browser = { async newContext() { calls.push(['newContext']); return context }, async close() { calls.push(['browserClose']) } }
  const client = new TonghuashunClient({ browserFactory: async () => browser })

  await Promise.all([
    client.fetchHtml('https://data.10jqka.com.cn/funds/hyzjl/', ['行业', '净额']),
    client.fetchHtml('https://data.10jqka.com.cn/funds/gnzjl/', ['行业', '净额']),
  ])
  await client.close()

  assert.equal(calls.filter(([name]) => name === 'newContext').length, 1)
  assert.equal(calls.filter(([name]) => name === 'newPage').length, 1)
  assert.deepEqual(calls.slice(-2), [['contextClose'], ['browserClose']])
})
