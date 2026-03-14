'use client';

import { useState } from 'react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { TranscriptList } from '@/components/ui/transcript-list';
import { formatTime } from '@/lib/utils/format-time';
import type { TranscriptResponse, ErrorResponse } from '@/lib/types/transcript';

export default function Home() {
  const [url, setUrl] = useState('');
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState<TranscriptResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTranscript(null);

    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, lang }),
      });

      const data: TranscriptResponse | ErrorResponse = await response.json();

      if (!response.ok) {
        setError((data as ErrorResponse).error || '获取字幕失败');
        return;
      }

      setTranscript(data as TranscriptResponse);
    } catch (err) {
      setError('网络错误，请检查连接后重试');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!transcript) return;

    const text = transcript.snippets
      .map((s) => `[${formatTime(s.start)}] ${s.text}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      alert('字幕已复制到剪贴板');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          YouTube 字幕获取工具
        </h1>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8" suppressHydrationWarning>
          <div className="mb-4">
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              YouTube 链接或视频 ID
            </label>
            <input
              type="text"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="lang" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              语言代码（可选）
            </label>
            <input
              type="text"
              id="lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              placeholder="en, zh-Hans, zh-Hant"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? '获取中...' : '获取字幕'}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
              正在获取字幕...
            </h2>
            <LoadingSkeleton />
          </div>
        )}

        {transcript && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                字幕内容 (视频 ID: {transcript.video_id})
              </h2>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors text-sm"
              >
                复制全部
              </button>
            </div>
            <TranscriptList snippets={transcript.snippets} formatTime={formatTime} />
          </div>
        )}
      </div>
    </div>
  );
}
