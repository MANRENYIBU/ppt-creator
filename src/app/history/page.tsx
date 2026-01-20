'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Download,
  Trash2,
  Plus,
  FileText,
  Globe,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { useGenerationStore, fetchSessionSummaries, SessionSummary } from '@/store/generation'

export default function HistoryPage() {
  const router = useRouter()
  const { sessionIds, loadSessionIds, removeSessionId } = useGenerationStore()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  // 加载会话ID列表
  useEffect(() => {
    loadSessionIds()
  }, [loadSessionIds])

  // 当sessionIds变化时，获取会话摘要
  useEffect(() => {
    const loadSessions = async () => {
      if (sessionIds.length === 0) {
        setSessions([])
        setLoading(false)
        return
      }

      setLoading(true)
      const fetchedSessions = await fetchSessionSummaries(sessionIds)
      // 按创建时间排序（最新的在前）
      fetchedSessions.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setSessions(fetchedSessions)
      setLoading(false)
    }

    loadSessions()
  }, [sessionIds])

  const handleDownload = (sessionId: string) => {
    // 跳转到结果页，用户可以选择主题后下载
    router.push(`/result?id=${sessionId}`)
  }

  const handleRemove = (id: string) => {
    removeSessionId(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  const handleRefresh = async () => {
    setLoading(true)
    const fetchedSessions = await fetchSessionSummaries(sessionIds)
    fetchedSessions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    setSessions(fetchedSessions)
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStageLabel = (stage: string, isZh: boolean) => {
    const labels: Record<string, { zh: string; en: string }> = {
      idle: { zh: '未开始', en: 'Not Started' },
      collecting: { zh: '收集资料', en: 'Collecting' },
      outlining: { zh: '生成大纲', en: 'Outlining' },
      generating: { zh: '生成内容', en: 'Generating' },
      exporting: { zh: '导出中', en: 'Exporting' },
      completed: { zh: '已完成', en: 'Completed' },
      error: { zh: '出错', en: 'Error' },
    }
    return labels[stage]?.[isZh ? 'zh' : 'en'] || stage
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-slate-100/50 blur-3xl" />
        <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-blue-50/50 blur-3xl" />
      </div>

      <Header />

      <main className="relative container mx-auto max-w-5xl px-4 py-12 sm:py-16">
        {/* 页面标题 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              生成历史
            </h1>
            <p className="mt-1 text-gray-500">查看和管理您生成的所有PPT</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25"
              asChild
            >
              <Link href="/">
                <Plus className="mr-2 h-4 w-4" />
                新建 PPT
              </Link>
            </Button>
          </div>
        </div>

        {loading ? (
          /* 加载状态 */
          <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-12 text-center shadow-xl shadow-gray-200/40 backdrop-blur-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-500">加载中...</p>
          </div>
        ) : sessions.length === 0 ? (
          /* 空状态 */
          <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-12 text-center shadow-xl shadow-gray-200/40 backdrop-blur-sm">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              暂无生成记录
            </h3>
            <p className="mb-6 text-gray-500">开始创建您的第一个AI演示文稿吧</p>
            <Button
              className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25"
              asChild
            >
              <Link href="/">
                <Sparkles className="mr-2 h-4 w-4" />
                开始创建
              </Link>
            </Button>
          </div>
        ) : (
          /* 历史列表 */
          <div className="space-y-3">
            {sessions.map((session) => {
              const isZh = session.language === 'zh-CN'
              const isCompleted = session.stage === 'completed'
              const isImageMode = session.mode === 'image'
              // 使用 hasContent 判断是否可下载
              const canDownload = session.hasContent

              return (
                <div
                  key={session.id}
                  className="group rounded-xl border border-gray-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-gray-300/60 hover:shadow-md sm:p-5"
                >
                  <div className="flex items-center gap-4">
                    {/* 图标 */}
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
                        isCompleted
                          ? 'from-green-50 to-emerald-50'
                          : session.stage === 'error'
                            ? 'from-red-50 to-orange-50'
                            : 'from-blue-50 to-indigo-50'
                      }`}
                    >
                      <FileText
                        className={`h-6 w-6 ${
                          isCompleted
                            ? 'text-green-600'
                            : session.stage === 'error'
                              ? 'text-red-600'
                              : 'text-blue-600'
                        }`}
                      />
                    </div>

                    {/* 内容 */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-gray-900">
                        {session.topic}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" />
                          {isZh ? '中文' : 'English'}
                        </span>
                        {/* 模式标签 */}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            isImageMode
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {isImageMode ? '图片模式' : '标准模式'}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            isCompleted
                              ? 'bg-green-100 text-green-700'
                              : session.stage === 'error'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {getStageLabel(session.stage, true)}
                        </span>
                        <span className="hidden sm:inline">
                          {formatDate(session.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex shrink-0 gap-2">
                      {!isCompleted && session.stage !== 'error' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                          asChild
                        >
                          <Link href={`/generate?id=${session.id}`}>
                            继续
                          </Link>
                        </Button>
                      )}
                      {canDownload && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                          onClick={() => handleDownload(session.id)}
                        >
                          <Download className="h-4 w-4" />
                          <span className="ml-1.5 hidden sm:inline">
                            下载
                          </span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleRemove(session.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 底部统计 */}
        {sessions.length > 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">
            共 {sessions.length} 条记录
          </p>
        )}
      </main>
    </div>
  )
}
