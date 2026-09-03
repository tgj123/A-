const DEFAULT_TIMEOUT_MS = 20_000
const BLOCKED_MARKERS = /验证码|访问过于频繁|异常访问|请登录|安全验证|Access Denied/iu

export function validateTonghuashunHtml(html, requiredFields = []) {
  if (!html || BLOCKED_MARKERS.test(html)) {
    throw new Error('同花顺请求触发验证或限流')
  }
  for (const field of requiredFields) {
    if (!html.includes(field)) throw new Error(`同花顺响应缺少字段：${field}`)
  }
  return html
}

async function defaultBrowserFactory() {
  const { chromium } = await import('playwright')
  return chromium.launch({ channel: 'msedge', headless: true })
}

export class TonghuashunClient {
  constructor({ browserFactory = defaultBrowserFactory, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.browserFactory = browserFactory
    this.timeoutMs = timeoutMs
    this.browser = null
    this.context = null
    this.page = null
    this.sessionPromise = null
  }

  async ensureSession() {
    if (this.page) return this.page
    if (this.sessionPromise) return this.sessionPromise
    this.sessionPromise = (async () => {
      this.browser = await this.browserFactory()
      this.context = await this.browser.newContext({
        locale: 'zh-CN',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
      })
      this.page = await this.context.newPage()
      await this.page.goto('https://data.10jqka.com.cn/funds/hyzjl/', {
        waitUntil: 'domcontentloaded',
        timeout: this.timeoutMs,
      })
      return this.page
    })()
    try {
      return await this.sessionPromise
    } catch (error) {
      await this.close()
      throw error
    } finally {
      this.sessionPromise = null
    }
  }

  async fetchHtml(url, requiredFields = []) {
    const page = await this.ensureSession()
    const html = await page.evaluate(async ({ requestUrl, timeoutMs }) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(requestUrl, {
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.text()
      } finally {
        clearTimeout(timer)
      }
    }, { requestUrl: url, timeoutMs: this.timeoutMs })
    return validateTonghuashunHtml(html, requiredFields)
  }

  async fetchPages(urlForPage, requiredFields) {
    const first = await this.fetchHtml(urlForPage(1), requiredFields)
    const totalPages = Number(first.match(/class=["']page_info["'][^>]*>\s*\d+\s*\/\s*(\d+)/iu)?.[1] ?? 1)
    const pages = [first]
    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
      pages.push(await this.fetchHtml(urlForPage(pageNumber), requiredFields))
    }
    return pages
  }

  async close() {
    const context = this.context
    const browser = this.browser
    this.page = null
    this.context = null
    this.browser = null
    this.sessionPromise = null
    await context?.close()
    await browser?.close()
  }
}
