'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Zap, Clock, Globe } from 'lucide-react';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DURATION_OPTIONS } from '@/types';

export default function HomePage() {
  const router = useRouter();

  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState<'zh-CN' | 'en-US'>('zh-CN');
  const [duration, setDuration] = useState<number>(15);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    const params = new URLSearchParams({
      topic: topic.trim(),
      language,
      duration: duration.toString(),
    });

    router.push(`/generate?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-indigo-100/50 blur-3xl" />
        <div className="absolute -bottom-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-50/80 blur-3xl" />
      </div>

      <Header />

      <main className="relative container mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          {/* Hero区域 */}
          <div className="mb-12 max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-sm text-blue-700 backdrop-blur-sm">
              <Zap className="h-4 w-4" />
              <span>AI驱动 · 快速生成</span>
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                AI PPT Creator
              </span>
            </h1>

            <p className="text-lg text-gray-600 sm:text-xl">
              输入主题，AI帮你搜集资料、规划大纲、生成专业演示文稿
            </p>
          </div>

          {/* 主表单卡片 */}
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-6 shadow-xl shadow-gray-200/40 backdrop-blur-sm sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 主题输入 */}
                <div className="space-y-2 text-left">
                  <label htmlFor="topic" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    演讲主题
                  </label>
                  <Input
                    id="topic"
                    type="text"
                    placeholder="例如：人工智能的未来发展"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    maxLength={200}
                    required
                    className="h-12 border-gray-200 bg-gray-50/50 transition-all focus:border-blue-500 focus:bg-white focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-gray-400">
                    {topic.length}/200 字符
                  </p>
                </div>

                {/* 语言选择 */}
                <div className="space-y-2 text-left">
                  <label htmlFor="language" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Globe className="h-4 w-4 text-blue-500" />
                    语言
                  </label>
                  <Select
                    value={language}
                    onValueChange={(v) => setLanguage(v as 'zh-CN' | 'en-US')}
                  >
                    <SelectTrigger id="language" className="h-12 border-gray-200 bg-gray-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-CN">中文</SelectItem>
                      <SelectItem value="en-US">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 时长选择 */}
                <div className="space-y-3 text-left">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Clock className="h-4 w-4 text-blue-500" />
                    演讲时长
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                          duration === d
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {d} 分钟
                      </button>
                    ))}
                  </div>
                </div>

                {/* 提交按钮 */}
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-medium shadow-lg shadow-blue-600/25 transition-all duration-200 hover:shadow-xl hover:shadow-blue-600/30"
                  disabled={!topic.trim()}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  开始生成
                </Button>
              </form>
            </div>
          </div>

          {/* 底部说明 */}
          <div className="mt-8 flex items-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              无需注册
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              即刻使用
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              免费导出
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
