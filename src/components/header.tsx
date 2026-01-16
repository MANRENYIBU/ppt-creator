'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, History } from 'lucide-react';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/60 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-gray-900 transition-colors hover:text-blue-600">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-600/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg">AI PPT Creator</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/history"
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              pathname === '/history'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <History className="h-4 w-4" />
            <span>历史记录</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
