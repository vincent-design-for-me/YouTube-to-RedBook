import type { TranscriptSnippet } from '@/lib/types/transcript';

interface TranscriptListProps {
  snippets: TranscriptSnippet[];
  formatTime: (seconds: number) => string;
  showTimestamps?: boolean;
}

/**
 * 字幕列表组件
 * 显示字幕片段列表，带时间戳和文本
 */
export function TranscriptList({ snippets, formatTime, showTimestamps = true }: TranscriptListProps) {
  return (
    <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
      {snippets.map((snippet, index) => (
        <div
          key={index}
          className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
        >
          {showTimestamps && (
            <div className="font-mono text-xs text-muted-foreground">
              {formatTime(snippet.start)}
            </div>
          )}
          <div className="text-sm leading-relaxed">{snippet.text}</div>
        </div>
      ))}
    </div>
  );
}
