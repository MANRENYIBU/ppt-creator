'use client'

import { useEffect, useCallback, useState, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  Loader2,
  Search,
  FileText,
  Wand2,
  AlertCircle,
  PlayCircle,
  ExternalLink,
} from 'lucide-react'
import { Header } from '@/components/header'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { GenerationStage } from '@/types'

/**
 * Generate API 返回的精简响应
 */
interface GenerateResponse {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  mode: 'dsl' | 'image'
  stage: GenerationStage
  processing?: boolean
  error?: string
  resources?: {
    count: number
    items: Array<{ title: string; url: string }>
  }
  outline?: Array<{ title: string }>
  hasContent?: boolean
}

interface StageConfig {
  key: GenerationStage
  label: string
  labelEn: string
  icon: React.ElementType
}

const STAGES: StageConfig[] = [
  {
    key: 'collecting',
    label: '收集资料',
    labelEn: 'Collecting Resources',
    icon: Search,
  },
  {
    key: 'outlining',
    label: '生成大纲',
    labelEn: 'Creating Outline',
    icon: FileText,
  },
  {
    key: 'generating',
    label: '生成内容',
    labelEn: 'Generating Content',
    icon: Wand2,
  },
]

// 轮询配置
const POLL_INTERVAL = 2000 // 2秒轮询一次
const MAX_POLL_TIME = 3600000 // 最大轮询时间 60 分钟

function GenerateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL 参数：只需要 session ID
  const sessionId = searchParams.get('id')

  // 状态
  const [session, setSession] = useState<GenerateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const initRef = useRef<boolean>(false)

  // Refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // 从 session 获取语言设置
  const isZh = session?.language === 'zh-CN'

  // 清理定时器
  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // 组件卸载时清理
  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  // 调用 generate API（触发处理 + 获取状态）
  const callGenerateAPI =
    useCallback(async (): Promise<GenerateResponse | null> => {
      if (!sessionId) return null
      try {
        const response = await fetch(`/api/session/${sessionId}/generate`, {
          method: 'POST',
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Generate failed')
        }
        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        return null
      }
    }, [sessionId])

  // 计算进度
  const getProgress = useCallback((s: GenerateResponse | null): number => {
    if (!s) return 0
    switch (s.stage) {
      case 'idle':
        return 0
      case 'collecting':
        return 15
      case 'outlining':
        return 45
      case 'generating':
        return 75
      case 'exporting':
        return 90
      case 'completed':
        return 100
      case 'error':
        return 0
      default:
        return 0
    }
  }, [])

  // 获取阶段状态
  const getStageStatus = useCallback(
    (stageKey: GenerationStage, currentSession: GenerateResponse | null) => {
      if (!currentSession) return 'pending'

      const stageOrder: GenerationStage[] = [
        'idle',
        'collecting',
        'outlining',
        'generating',
        'exporting',
        'completed',
      ]
      const currentIndex = stageOrder.indexOf(currentSession.stage)
      const stageIndex = stageOrder.indexOf(stageKey)

      if (currentSession.stage === 'error') return 'pending'
      if (currentIndex > stageIndex) return 'completed'
      if (currentIndex === stageIndex) return 'loading'
      return 'pending'
    },
    [],
  )

  // 轮询逻辑
  const startPolling = useCallback(() => {
    if (pollingRef.current) return // 已在轮询中

    // 确保开始时间已设置
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now()
    }

    pollingRef.current = setInterval(async () => {
      // 检查超时
      if (Date.now() - startTimeRef.current > MAX_POLL_TIME) {
        cleanup()
        setError('Processing timeout, please refresh and retry')
        setIsGenerating(false)
        return
      }

      // 调用 generate API 获取最新状态（同时触发下一阶段处理）
      const currentSession = await callGenerateAPI()
      if (!currentSession) return

      setSession(currentSession)

      // 检查是否出错
      if (currentSession.stage === 'error') {
        cleanup()
        setError(currentSession.error || 'Generation failed')
        setIsGenerating(false)
        return
      }

      // 检查是否完成
      if (currentSession.stage === 'completed') {
        cleanup()
        setIsGenerating(false)
        return
      }
    }, POLL_INTERVAL)
  }, [callGenerateAPI, cleanup])

  // 开始生成流程
  const startGeneration = useCallback(async () => {
    if (!sessionId || isGenerating) return

    setIsGenerating(true)
    setError(null)
    startTimeRef.current = Date.now()

    // 立即调用一次 generate API 启动处理
    const initialSession = await callGenerateAPI()
    if (initialSession) {
      setSession(initialSession)

      // 如果已完成，不需要轮询
      if (initialSession.stage === 'completed') {
        setIsGenerating(false)
        return
      }

      // 如果出错，停止
      if (initialSession.stage === 'error') {
        setError(initialSession.error || 'Generation failed')
        setIsGenerating(false)
        return
      }
    }

    // 开始轮询
    startPolling()
  }, [sessionId, isGenerating, callGenerateAPI, startPolling])

  // 初始化：进入页面立即开始生成流程
  useEffect(() => {
    if (!sessionId) {
      router.replace('/')
      return
    }
    if (initRef.current) {
      return
    }
    initRef.current = true

    // 复用 startGeneration 逻辑
    startGeneration()
  }, [sessionId, router, startGeneration])

  // 跳转到结果页
  useEffect(() => {
    if (session?.stage === 'completed') {
      // 延迟跳转，让用户看到完成状态
      const timer = setTimeout(() => {
        router.replace(`/result?id=${session.id}`)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [session, router])

  const isError = !!error || session?.stage === 'error'
  const isComplete = session?.stage === 'completed'

  // 加载中状态（还没有获取到 session 数据）
  if (!session && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-white to-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-indigo-100/50 blur-3xl" />
      </div>

      <Header />

      <main className="relative container mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          {/* 标题区域 */}
          <div className="mb-10">
            <div
              className={`mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ${isError
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-600/25'
                  : isComplete
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-600/25'
                    : isGenerating
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-600/25'
                      : 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-600/25'
                }`}>
              {isError ? (
                <AlertCircle className="h-8 w-8 text-white" />
              ) : isComplete ? (
                <CheckCircle2 className="h-8 w-8 text-white" />
              ) : isGenerating ? (
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              ) : (
                <PlayCircle className="h-8 w-8 text-white" />
              )}
            </div>
            <h1 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
              {isError
                ? isZh
                  ? '生成出错'
                  : 'Generation Error'
                : isComplete
                  ? isZh
                    ? '生成完成'
                    : 'Generation Complete'
                  : isGenerating
                    ? isZh
                      ? '正在生成...'
                      : 'Generating...'
                    : isZh
                      ? '准备生成'
                      : 'Ready to Generate'}
            </h1>
            <p className="text-gray-500">&ldquo;{session?.topic}&rdquo;</p>
          </div>

          {/* 进度卡片 */}
          <div className="w-full max-w-lg">
            <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-6 shadow-xl shadow-gray-200/40 backdrop-blur-sm sm:p-8">
              {/* 错误提示 */}
              {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-4 text-left">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* 阶段列表 */}
              <div className="space-y-1">
                {STAGES.map((stage, index) => {
                  const status = getStageStatus(stage.key, session)
                  const Icon = stage.icon

                  return (
                    <div key={stage.key}>
                      <div
                        className={`flex items-center gap-4 rounded-xl p-3 transition-all duration-300 ${status === 'loading' ? 'bg-blue-50' : ''
                          }`}>
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${status === 'completed'
                              ? 'bg-green-100 text-green-600'
                              : status === 'loading'
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}>
                          {status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : status === 'loading' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>

                        <div className="flex-1 text-left">
                          <span
                            className={`text-sm font-medium ${status === 'pending'
                                ? 'text-gray-400'
                                : 'text-gray-900'
                              }`}>
                            {isZh ? stage.label : stage.labelEn}
                          </span>
                        </div>

                        {/* 状态标签 */}
                        {status === 'completed' && (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            {isZh ? '完成' : 'Done'}
                          </span>
                        )}
                        {status === 'loading' && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {isZh ? '进行中' : 'Processing'}
                          </span>
                        )}
                      </div>

                      {index < STAGES.length - 1 && (
                        <div className="ml-[1.4rem] h-2 w-0.5 bg-gray-200" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 进度条 */}
              <div className="mt-6 space-y-2">
                <Progress
                  value={getProgress(session)}
                  className="h-2 bg-gray-100"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {isError
                      ? isZh
                        ? '生成失败'
                        : 'Failed'
                      : isComplete
                        ? isZh
                          ? '即将跳转...'
                          : 'Redirecting...'
                        : isGenerating
                          ? isZh
                            ? '处理中...'
                            : 'Processing...'
                          : isZh
                            ? '点击开始生成'
                            : 'Click to start'}
                  </span>
                  <span className="font-medium text-blue-600">
                    {getProgress(session)}%
                  </span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="mt-6 flex gap-3">
                {isError ? (
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => {
                      setError(null)
                      startGeneration()
                    }}>
                    <PlayCircle className="h-4 w-4" />
                    {isZh ? '重试' : 'Retry'}
                  </Button>
                ) : (
                  <></>
                )}
              </div>

              {/* 资料预览 */}
              {session?.resources && session.resources.count > 0 && (
                <div className="mt-6 rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">
                    {isZh
                      ? `已收集 ${session.resources.count} 条资料`
                      : `Collected ${session.resources.count} resources`}
                  </h3>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {session.resources.items.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {r.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 大纲预览 */}
              {session?.outline && session.outline.length > 0 && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">
                    {isZh ? '大纲预览' : 'Outline Preview'}
                  </h3>
                  <div className="space-y-1 text-left">
                    {session.outline.map((item, i) => (
                      <div key={i} className="text-xs text-gray-600">
                        {i + 1}. {item.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 会话信息 */}
          {session && (
            <p className="mt-6 text-xs text-gray-400">
              Session: {session.id.slice(0, 8)}...
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-white to-white">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }>
      <GenerateContent />
    </Suspense>
  )
}
