'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Circle, Loader2, Search, FileText, Wand2, Download } from 'lucide-react';
import { Header } from '@/components/header';
import { Progress } from '@/components/ui/progress';
import { useGenerationStore } from '@/store/generation';
import { GenerationStage } from '@/types';

const STAGES: { key: GenerationStage; label: string; labelEn: string; icon: React.ElementType }[] = [
  { key: 'collecting', label: '收集资料', labelEn: 'Collecting Resources', icon: Search },
  { key: 'outlining', label: '规划大纲', labelEn: 'Creating Outline', icon: FileText },
  { key: 'generating', label: '生成内容', labelEn: 'Generating Content', icon: Wand2 },
  { key: 'completed', label: '导出文件', labelEn: 'Exporting File', icon: Download },
];

function GenerateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProgress, currentRecord } = useGenerationStore();

  const topic = searchParams.get('topic') || '';
  const language = (searchParams.get('language') || 'zh-CN') as 'zh-CN' | 'en-US';
  const isZh = language === 'zh-CN';

  useEffect(() => {
    if (!topic) {
      router.replace('/');
      return;
    }

    if (currentRecord) {
      router.replace(`/result?id=${currentRecord.id}`);
    }
  }, [topic, currentRecord, router]);

  const getStageIndex = (stage: GenerationStage) => {
    return STAGES.findIndex((s) => s.key === stage);
  };

  const currentStageIndex = currentProgress
    ? getStageIndex(currentProgress.stage)
    : 0;

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
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
            <h1 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
              {isZh ? '正在为您生成 PPT' : 'Generating Your PPT'}
            </h1>
            <p className="text-gray-500">&ldquo;{topic}&rdquo;</p>
          </div>

          {/* 进度卡片 */}
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-6 shadow-xl shadow-gray-200/40 backdrop-blur-sm sm:p-8">
              <div className="space-y-1">
                {STAGES.map((stage, index) => {
                  const isCompleted = index < currentStageIndex;
                  const isCurrent = index === currentStageIndex;
                  const isPending = index > currentStageIndex;
                  const Icon = stage.icon;

                  return (
                    <div key={stage.key}>
                      <div
                        className={`flex items-center gap-4 rounded-xl p-3 transition-all duration-300 ${
                          isCurrent ? 'bg-blue-50' : ''
                        }`}
                      >
                        {/* 图标 */}
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                            isCompleted
                              ? 'bg-green-100 text-green-600'
                              : isCurrent
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : isCurrent ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>

                        {/* 文本 */}
                        <div className="flex-1 text-left">
                          <span
                            className={`text-sm font-medium ${
                              isPending ? 'text-gray-400' : 'text-gray-900'
                            }`}
                          >
                            {isZh ? stage.label : stage.labelEn}
                          </span>
                        </div>

                        {/* 状态标签 */}
                        {isCompleted && (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            {isZh ? '完成' : 'Done'}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {isZh ? '进行中' : 'Processing'}
                          </span>
                        )}
                      </div>

                      {/* 连接线 */}
                      {index < STAGES.length - 1 && (
                        <div className="ml-[1.4rem] h-2 w-0.5 bg-gray-200" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 进度条 */}
              <div className="mt-6 space-y-2">
                <Progress
                  value={currentProgress?.progress || 0}
                  className="h-2 bg-gray-100"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {currentProgress?.message || (isZh ? '准备中...' : 'Preparing...')}
                  </span>
                  <span className="font-medium text-blue-600">
                    {currentProgress?.progress || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 底部提示 */}
          <p className="mt-8 text-sm text-gray-400">
            {isZh
              ? '请稍候，AI正在努力工作中...'
              : 'Please wait, AI is working hard...'}
          </p>
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
