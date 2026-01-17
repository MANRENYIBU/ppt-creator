'use client';

import { useEffect, useCallback, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  Search,
  FileText,
  Wand2,
  Download,
  AlertCircle,
  PlayCircle,
  RefreshCw,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Header } from '@/components/header';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useGenerationStore } from '@/store/generation';
import { GenerationStage, GenerationSession } from '@/types';

interface StageConfig {
  key: GenerationStage;
  label: string;
  labelEn: string;
  icon: React.ElementType;
  endpoint: string;
}

const STAGES: StageConfig[] = [
  { key: 'collecting', label: '收集资料', labelEn: 'Collecting Resources', icon: Search, endpoint: 'collect' },
  { key: 'outlining', label: '规划大纲', labelEn: 'Creating Outline', icon: FileText, endpoint: 'outline' },
  { key: 'generating', label: '生成内容', labelEn: 'Generating Content', icon: Wand2, endpoint: 'content' },
  { key: 'exporting', label: '导出文件', labelEn: 'Exporting File', icon: Download, endpoint: 'export' },
];

function GenerateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addSessionId } = useGenerationStore();

  // URL参数
  const topic = searchParams.get('topic') || '';
  const language = (searchParams.get('language') || 'zh-CN') as 'zh-CN' | 'en-US';
  const sessionId = searchParams.get('session');
  const isZh = language === 'zh-CN';

  // 状态
  const [session, setSession] = useState<GenerationSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const hasInitialized = useRef(false);

  // 计算进度
  const getProgress = useCallback(() => {
    if (!session) return 0;
    const stageIndex = STAGES.findIndex(s => s.key === session.stage);
    if (session.stage === 'completed') return 100;
    if (session.stage === 'idle') return 0;
    if (stageIndex === -1) return 0;
    return Math.min(95, (stageIndex + 1) * 25);
  }, [session]);

  // 创建会话
  const createSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, language }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const newSession: GenerationSession = await response.json();
      setSession(newSession);

      // 保存会话ID到本地
      addSessionId(newSession.id);

      // 更新URL添加session ID
      const url = new URL(window.location.href);
      url.searchParams.set('session', newSession.id);
      router.replace(url.pathname + url.search);

      return newSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [topic, language, router, addSessionId]);

  // 获取会话状态
  const fetchSession = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/session/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          // 会话不存在，创建新会话
          return createSession();
        }
        throw new Error('Failed to fetch session');
      }
      const data: GenerationSession = await response.json();
      setSession(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    }
  }, [createSession]);

  // 执行某个阶段
  const executeStage = useCallback(async (stageIndex: number) => {
    if (!session) return;

    const stage = STAGES[stageIndex];
    if (!stage) return;

    setLoading(true);
    setError(null);
    setCurrentStageIndex(stageIndex);

    try {
      const response = await fetch(`/api/session/${session.id}/${stage.endpoint}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed at ${stage.labelEn}`);
      }

      const updatedSession: GenerationSession = await response.json();
      setSession(updatedSession);

      // 如果完成，保存会话ID并跳转到结果页
      if (updatedSession.stage === 'completed') {
        addSessionId(updatedSession.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
      setCurrentStageIndex(-1);
    }
  }, [session, addSessionId]);

  // 自动执行所有阶段
  const executeAll = useCallback(async () => {
    let currentSession = session;

    for (let i = 0; i < STAGES.length; i++) {
      if (!currentSession) break;

      // 检查是否已经完成此阶段
      const stage = STAGES[i];
      const shouldSkip =
        (stage.key === 'collecting' && currentSession.resources) ||
        (stage.key === 'outlining' && currentSession.outline?.length) ||
        (stage.key === 'generating' && currentSession.dslPresentation?.slides?.length) ||
        (stage.key === 'exporting' && currentSession.stage === 'completed');

      if (shouldSkip) continue;

      setLoading(true);
      setCurrentStageIndex(i);

      try {
        const response = await fetch(`/api/session/${currentSession.id}/${stage.endpoint}`, {
          method: 'POST',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed at ${stage.labelEn}`);
        }

        currentSession = await response.json();
        setSession(currentSession);

        if (currentSession && currentSession.stage === 'completed') {
          addSessionId(currentSession.id);
          break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        break;
      }
    }

    setLoading(false);
    setCurrentStageIndex(-1);
  }, [session, addSessionId]);

  // 初始化
  useEffect(() => {
    if (!topic) {
      router.replace('/');
      return;
    }

    // 防止重复初始化
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    if (sessionId) {
      fetchSession(sessionId);
    } else {
      createSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, sessionId]);

  // 跳转到结果页
  useEffect(() => {
    if (session?.stage === 'completed') {
      router.replace(`/result?id=${session.id}`);
    }
  }, [session, router]);

  // 获取阶段状态
  const getStageStatus = (stageIndex: number) => {
    if (!session) return 'pending';

    const stage = STAGES[stageIndex];

    // 检查是否已完成
    const isCompleted =
      (stage.key === 'collecting' && session.resources) ||
      (stage.key === 'outlining' && session.outline?.length) ||
      (stage.key === 'generating' && session.dslPresentation?.slides?.length) ||
      (stage.key === 'exporting' && session.stage === 'completed');

    if (isCompleted) return 'completed';
    if (currentStageIndex === stageIndex && loading) return 'loading';
    if (session.stage === stage.key) return 'current';
    return 'pending';
  };

  // 检查是否可以执行某个阶段
  const canExecuteStage = (stageIndex: number) => {
    if (!session || loading) return false;

    const stage = STAGES[stageIndex];

    // 检查前置条件
    if (stage.key === 'outlining' && !session.resources && stageIndex > 0) {
      // 如果没有资料但已经跳过了收集阶段，允许执行
      const collectStatus = getStageStatus(0);
      if (collectStatus !== 'completed' && collectStatus !== 'pending') return false;
    }
    if (stage.key === 'generating' && (!session.outline || session.outline.length === 0)) return false;
    if (stage.key === 'exporting' && !session.dslPresentation?.slides?.length) return false;

    return true;
  };

  const isError = !!error;

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
              className={`mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ${
                isError
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-600/25'
                  : loading
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-600/25'
                  : 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-600/25'
              }`}
            >
              {isError ? (
                <AlertCircle className="h-8 w-8 text-white" />
              ) : loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              ) : (
                <PlayCircle className="h-8 w-8 text-white" />
              )}
            </div>
            <h1 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
              {isError
                ? (isZh ? '生成出错' : 'Generation Error')
                : loading
                ? (isZh ? '正在处理...' : 'Processing...')
                : (isZh ? 'PPT 生成控制台' : 'PPT Generation Console')}
            </h1>
            <p className="text-gray-500">&ldquo;{topic}&rdquo;</p>
          </div>

          {/* 进度卡片 */}
          <div className="w-full max-w-lg">
            <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-6 shadow-xl shadow-gray-200/40 backdrop-blur-sm sm:p-8">
              {/* 错误提示 */}
              {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-4 text-left">
                  <p className="text-sm text-red-600">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setError(null)}
                  >
                    {isZh ? '关闭' : 'Dismiss'}
                  </Button>
                </div>
              )}

              {/* 阶段列表 */}
              <div className="space-y-1">
                {STAGES.map((stage, index) => {
                  const status = getStageStatus(index);
                  const Icon = stage.icon;
                  const canExecute = canExecuteStage(index);

                  return (
                    <div key={stage.key}>
                      <div
                        className={`flex items-center gap-4 rounded-xl p-3 transition-all duration-300 ${
                          status === 'loading' ? 'bg-blue-50' : status === 'current' ? 'bg-gray-50' : ''
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                            status === 'completed'
                              ? 'bg-green-100 text-green-600'
                              : status === 'loading'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
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
                            className={`text-sm font-medium ${
                              status === 'pending' && !canExecute ? 'text-gray-400' : 'text-gray-900'
                            }`}
                          >
                            {isZh ? stage.label : stage.labelEn}
                          </span>
                        </div>

                        {/* 状态标签或操作按钮 */}
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
                        {status !== 'loading' && status !== 'completed' && canExecute && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => executeStage(index)}
                            disabled={loading}
                          >
                            {status === 'current' ? (
                              <RefreshCw className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            {isZh ? '执行' : 'Run'}
                          </Button>
                        )}
                      </div>

                      {index < STAGES.length - 1 && (
                        <div className="ml-[1.4rem] h-2 w-0.5 bg-gray-200" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 进度条 */}
              <div className="mt-6 space-y-2">
                <Progress value={getProgress()} className="h-2 bg-gray-100" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {loading
                      ? (isZh ? '处理中...' : 'Processing...')
                      : session?.stage === 'completed'
                      ? (isZh ? '已完成' : 'Completed')
                      : (isZh ? '等待操作' : 'Waiting')}
                  </span>
                  <span className="font-medium text-blue-600">{getProgress()}%</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="mt-6 flex gap-3">
                <Button
                  className="flex-1 gap-2"
                  onClick={executeAll}
                  disabled={loading || session?.stage === 'completed'}
                >
                  <PlayCircle className="h-4 w-4" />
                  {isZh ? '一键生成' : 'Generate All'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/')}
                  disabled={loading}
                >
                  {isZh ? '返回' : 'Back'}
                </Button>
              </div>

              {/* 资料预览 */}
              {session?.resources && session.resources.results.length > 0 && (
                <div className="mt-6 rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">
                    {isZh ? `已收集 ${session.resources.results.length} 条资料` : `Collected ${session.resources.results.length} resources`}
                  </h3>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {session.resources.results.slice(0, 5).map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate"
                      >
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
  );
}

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-white to-white">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <GenerateContent />
    </Suspense>
  );
}
