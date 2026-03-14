import type { TranscriptSnippet } from '@/lib/types/transcript';

interface TranscriptListProps {
  snippets: TranscriptSnippet[];
  formatTime: (seconds: number) => string;
}

/**
 * 字幕列表组件
 * 显示字幕片段列表，带时间戳和文本
 */
export function TranscriptList({ snippets, formatTime }: TranscriptListProps) {
  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto">
      {snippets.map((snippet, index) => (
        <div
          key={index}
          className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 font-mono">
            {formatTime(snippet.start)}
          </div>
          <div className="text-gray-900 dark:text-gray-100">{snippet.text}</div>
        </div>
      ))}
    </div>
  );
}
