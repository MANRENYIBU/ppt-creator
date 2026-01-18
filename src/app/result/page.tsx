'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  Download,
  Plus,
  History,
  Loader2,
  FileText,
  Palette,
} from 'lucide-react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { useGenerationStore } from '@/store/generation'
import { GenerationSession, ThemeName } from '@/types'

// 主题配置
const THEMES: { name: ThemeName; label: string; labelEn: string; color: string }[] = [
  { name: 'blue', label: '专业蓝', labelEn: 'Blue', color: '#2563EB' },
  { name: 'green', label: '清新绿', labelEn: 'Green', color: '#16A34A' },
  { name: 'teal', label: '科技青', labelEn: 'Teal', color: '#0D9488' },
  { name: 'purple', label: '优雅紫', labelEn: 'Purple', color: '#9333EA' },
  { name: 'orange', label: '活力橙', labelEn: 'Orange', color: '#EA580C' },
  { name: 'red', label: '醒目红', labelEn: 'Red', color: '#DC2626' },
  { name: 'rose', label: '温暖粉', labelEn: 'Rose', color: '#E11D48' },
  { name: 'slate', label: '简约灰', labelEn: 'Slate', color: '#475569' },
]

function ResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { fetchSession, addSessionId } = useGenerationStore()

  const sessionId = searchParams.get('id')
  const [session, setSession] = useState<GenerationSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>('blue')

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) {
        router.replace('/')
        return
      }

      setLoading(true)
      const fetchedSession = await fetchSession(sessionId)

      if (!fetchedSession) {
        router.replace('/')
        return
      }

      // 确保会话ID在列表中
      addSessionId(sessionId)
      setSession(fetchedSession)
      // 使用会话中的主题作为默认值
      if (fetchedSession.theme) {
        setSelectedTheme(fetchedSession.theme)
      }
      setLoading(false)
    }

    loadSession()
  }, [sessionId, fetchSession, addSessionId, router])

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 via-white to-white">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  const isZh = session.language === 'zh-CN'

  const handleDownload = async () => {
    if (!sessionId) return

    setDownloading(true)
    try {
      // 每次都调用 export API 生成新的 PPTX，传递选中的主题
      const response = await fetch(`/api/session/${sessionId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: selectedTheme }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Export failed')
      }

      const result = await response.json()

      if (result.downloadUrl) {
        const link = document.createElement('a')
        link.href = result.downloadUrl
        link.download = `${session.topic}.pptx`
        link.click()
      }
    } catch (error) {
      console.error('Download failed:', error)
      alert(isZh ? '下载失败，请重试' : 'Download failed, please try again')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-green-50 via-white to-white">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-green-100/50 blur-3xl" />
        <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-emerald-100/50 blur-3xl" />
      </div>

      <Header />

      <main className="relative container mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          {/* 成功标题 */}
          <div className="mb-10">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-600/25">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
              {isZh ? '生成完成！' : 'Generation Complete!'}
            </h1>
            <p className="text-gray-500">&ldquo;{session.topic}&rdquo;</p>
          </div>

          {/* 大纲预览卡片 */}
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-6 shadow-xl shadow-gray-200/40 backdrop-blur-sm sm:p-8">
              {/* 卡片标题 */}
              <div className="mb-4 flex items-center gap-2 text-gray-900">
                <FileText className="h-5 w-5 text-green-600" />
                <h2 className="font-semibold">
                  {isZh ? 'PPT 大纲预览' : 'PPT Outline Preview'}
                </h2>
              </div>

              {/* 大纲列表 */}
              <div className="mb-6 max-h-64 space-y-1 overflow-y-auto rounded-xl bg-gray-50 p-4">
                {session.outline && session.outline.length > 0 ? (
                  session.outline.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-700">{item.title}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    {isZh ? '暂无大纲数据' : 'No outline data'}
                  </p>
                )}
              </div>

              {/* 幻灯片数量 */}
              {session.dslPresentation?.slides?.length && (
                <p className="mb-4 text-sm text-gray-500">
                  {isZh
                    ? `共 ${session.dslPresentation.slides.length} 张幻灯片`
                    : `${session.dslPresentation.slides.length} slides total`}
                </p>
              )}

              {/* 主题颜色选择 */}
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Palette className="h-4 w-4 text-green-600" />
                  {isZh ? '选择主题颜色' : 'Choose Theme Color'}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setSelectedTheme(t.name)}
                      className={`group relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all ${
                        selectedTheme === t.name
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      <div
                        className="h-6 w-6 rounded-full shadow-sm ring-2 ring-white"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-xs text-gray-600">
                        {isZh ? t.label : t.labelEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 下载按钮 */}
              <Button
                size="lg"
                className="h-12 w-full bg-gradient-to-r from-green-500 to-emerald-600 text-base font-medium shadow-lg shadow-green-600/25 transition-all duration-200 hover:shadow-xl hover:shadow-green-600/30"
                onClick={handleDownload}
                disabled={downloading || !session.dslPresentation}
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isZh ? '正在生成...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    {isZh ? '下载 PPTX 文件' : 'Download PPTX File'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              className="border-gray-200 bg-white/80 text-gray-700 backdrop-blur-sm hover:bg-gray-50"
              asChild
            >
              <Link href="/">
                <Plus className="mr-2 h-4 w-4" />
                {isZh ? '生成新的PPT' : 'Create New PPT'}
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-gray-200 bg-white/80 text-gray-700 backdrop-blur-sm hover:bg-gray-50"
              asChild
            >
              <Link href="/history">
                <History className="mr-2 h-4 w-4" />
                {isZh ? '查看历史' : 'View History'}
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 via-white to-white">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  )
}
