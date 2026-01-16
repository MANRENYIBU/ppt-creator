/**
 * 网页内容抓取工具
 * 从URL获取网页内容并提取纯文本
 */

// 不支持抓取的文件扩展名
const UNSUPPORTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico',
  '.exe', '.dmg', '.apk', '.msi',
  '.css', '.js', '.json', '.xml', '.rss',
]

/**
 * 检查URL是否是不支持的文件类型
 */
function isUnsupportedFileType(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return UNSUPPORTED_EXTENSIONS.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * 从HTML中提取纯文本内容
 */
function extractTextFromHtml(html: string): string {
  // 移除script和style标签及其内容
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')

  // 移除所有HTML标签
  text = text.replace(/<[^>]+>/g, ' ')

  // 解码HTML实体
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")

  // 清理多余空白
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()

  return text
}

/**
 * 截断文本到指定长度
 */
function truncateText(text: string, maxLength: number = 5000): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 抓取单个URL的内容
 */
export async function fetchUrlContent(
  url: string,
  timeout: number = 10000
): Promise<string | null> {
  // 检查是否是不支持的文件类型
  if (isUnsupportedFileType(url)) {
    console.log(`Skipping unsupported file type: ${url}`)
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.log(`HTTP ${response.status} for ${url}`)
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain')
    ) {
      console.log(`Unsupported content type: ${contentType} for ${url}`)
      return null
    }

    const html = await response.text()
    const text = extractTextFromHtml(html)

    // 过滤掉内容太少的页面
    if (text.length < 100) {
      console.log(`Content too short (${text.length} chars) for ${url}`)
      return null
    }

    return truncateText(text)
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.log(`Timeout fetching ${url}`)
      } else {
        // 简化错误日志，不打印完整堆栈
        const errorMsg =
          (error as NodeJS.ErrnoException).code || error.message
        console.log(`Failed to fetch ${url}: ${errorMsg}`)
      }
    }
    return null
  }
}

/**
 * 批量抓取URL内容
 */
export async function fetchMultipleUrls(
  urls: string[],
  concurrency: number = 3,
  timeout: number = 10000
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()

  // 过滤掉不支持的URL
  const supportedUrls = urls.filter((url) => !isUnsupportedFileType(url))

  if (supportedUrls.length < urls.length) {
    console.log(
      `Filtered out ${urls.length - supportedUrls.length} unsupported URLs`
    )
  }

  // 分批处理以控制并发
  for (let i = 0; i < supportedUrls.length; i += concurrency) {
    const batch = supportedUrls.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const content = await fetchUrlContent(url, timeout)
        return { url, content }
      })
    )

    for (const { url, content } of batchResults) {
      results.set(url, content)
    }
  }

  return results
}

/**
 * 为搜索结果补充网页内容
 */
export async function enrichSearchResults<
  T extends { url: string; rawContent?: string },
>(results: T[], concurrency: number = 3): Promise<T[]> {
  // 找出没有rawContent且是支持的文件类型的结果
  const needFetch = results.filter(
    (r) => !r.rawContent && !isUnsupportedFileType(r.url)
  )

  if (needFetch.length === 0) {
    return results
  }

  console.log(`Fetching content for ${needFetch.length} URLs...`)

  const urls = needFetch.map((r) => r.url)
  const contents = await fetchMultipleUrls(urls, concurrency)

  // 统计成功抓取的数量
  const successCount = Array.from(contents.values()).filter(Boolean).length
  console.log(`Successfully fetched ${successCount}/${needFetch.length} URLs`)

  // 更新结果
  return results.map((r) => {
    if (!r.rawContent && contents.has(r.url)) {
      const content = contents.get(r.url)
      if (content) {
        return { ...r, rawContent: content }
      }
    }
    return r
  })
}
