'use client';

import { useState } from 'react';
import { readSSEStream } from '@/lib/utils/sse';

interface HistoryImage {
  id: string;
  key_point_id: number;
  url: string;
  prompt: string;
  created_at: string;
}

interface HistoryKeyPoint {
  id: number;
  title: string;
  summary: string;
  relevantQuotes: string[];
}

interface HistoryImageViewProps {
  keyPoints: HistoryKeyPoint[];
  images: HistoryImage[];
  sessionId: string;
  transcriptText: string;
  onImagesChange: (updater: (prev: HistoryImage[]) => HistoryImage[]) => void;
}

export function HistoryImageView({
  keyPoints,
  images,
  sessionId,
  transcriptText,
  onImagesChange,
}: HistoryImageViewProps) {
  const [regeneratingImageIds, setRegeneratingImageIds] = useState<Set<number>>(new Set());
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const [localOverrides, setLocalOverrides] = useState<Map<number, string>>(new Map());

  const imageCount = keyPoints.filter(
    (kp) => localOverrides.has(kp.id) || images.some((img) => img.key_point_id === kp.id)
  ).length;

  const missingCount = keyPoints.filter(
    (kp) => !localOverrides.has(kp.id) && !images.some((img) => img.key_point_id === kp.id)
  ).length;

  const handleDownload = async (keyPointId: number) => {
    const override = localOverrides.get(keyPointId);
    const link = document.createElement('a');
    if (override) {
      link.href = `data:image/png;base64,${override}`;
    } else {
      const img = images.find((i) => i.key_point_id === keyPointId);
      if (!img) return;
      link.href = img.url;
    }
    link.download = `keypoint-${keyPointId}.png`;
    link.click();
  };

  const handleDownloadAll = () => {
    keyPoints.forEach((kp) => {
      const hasImage =
        localOverrides.has(kp.id) || images.some((img) => img.key_point_id === kp.id);
      if (hasImage) handleDownload(kp.id);
    });
  };

  const handleRegenerateImage = async (keyPointId: number) => {
    const keyPoint = keyPoints.find((kp) => kp.id === keyPointId);
    if (!keyPoint) return;

    setRegeneratingImageIds((prev) => new Set(prev).add(keyPointId));

    try {
      const response = await fetch('/api/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyPoint, transcriptText, sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setImageErrors((prev) => [...prev, data.error || `图片 #${keyPointId} 重新生成失败`]);
        return;
      }

      const result = await response.json();
      setLocalOverrides((prev) => new Map(prev).set(keyPointId, result.base64Data));
      onImagesChange((prevImages) => {
        const filtered = prevImages.filter((img) => img.key_point_id !== keyPointId);
        return [
          ...filtered,
          {
            id: `regenerated-${keyPointId}`,
            key_point_id: keyPointId,
            url: '',
            prompt: result.prompt || '',
            created_at: new Date().toISOString(),
          },
        ];
      });
    } catch {
      setImageErrors((prev) => [...prev, `图片 #${keyPointId} 重新生成失败，请重试`]);
    } finally {
      setRegeneratingImageIds((prev) => {
        const next = new Set(prev);
        next.delete(keyPointId);
        return next;
      });
    }
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    setImageErrors([]);

    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyPoints, transcriptText, sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setImageErrors([data.error || '配图生成失败']);
        return;
      }

      const errors: string[] = [];

      await readSSEStream(response, (progress) => {
        if (progress.message?.includes('生成失败:')) {
          errors.push(progress.message);
        }

        if (progress.stage === 'image_ready' && progress.image) {
          const { keyPointId, base64Data, prompt } = progress.image;
          setLocalOverrides((prev) => new Map(prev).set(keyPointId, base64Data));
          onImagesChange((prevImages) => {
            const filtered = prevImages.filter((img) => img.key_point_id !== keyPointId);
            return [
              ...filtered,
              {
                id: `generated-${keyPointId}`,
                key_point_id: keyPointId,
                url: '',
                prompt,
                created_at: new Date().toISOString(),
              },
            ];
          });
        } else if (progress.stage === 'complete') {
          setImageErrors(errors);
        } else if (progress.stage === 'error') {
          setImageErrors([progress.message]);
        }
      });
    } catch {
      setImageErrors(['配图生成失败，请重试']);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // No keyPoints: fallback to simple image grid
  if (keyPoints.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative aspect-[3/4] rounded-xl overflow-hidden bg-ed-surface-container"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`Key point ${img.key_point_id}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        {imageCount > 0 && (
          <button
            onClick={handleDownloadAll}
            className="px-3 py-1.5 text-sm border border-ed-outline-variant/20 rounded-xl text-ed-on-surface-variant hover:text-ed-on-surface transition-colors"
          >
            下载全部 ({imageCount})
          </button>
        )}
        {missingCount > 0 && (
          <button
            onClick={handleGenerateAll}
            disabled={isGeneratingAll || regeneratingImageIds.size > 0}
            className="px-3 py-1.5 text-sm bg-ed-primary text-ed-on-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingAll ? '生成中...' : `生成全部配图 (${missingCount})`}
          </button>
        )}
      </div>

      {/* 错误提示 */}
      {imageErrors.length > 0 && (
        <div className="text-sm text-red-600 space-y-1">
          {imageErrors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      {/* 图片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {keyPoints.map((kp) => {
          const image = images.find((img) => img.key_point_id === kp.id);
          const override = localOverrides.get(kp.id);
          const isRegenerating = regeneratingImageIds.has(kp.id);
          const hasImage = image || override;
          const imageSrc = override
            ? `data:image/png;base64,${override}`
            : image?.url;

          return (
            <div key={kp.id} className="space-y-2">
              {/* 图片区域 */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-ed-surface-container">
                {hasImage && imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageSrc}
                    alt={kp.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ed-on-surface-variant/40 text-sm">
                    暂无配图
                  </div>
                )}
                {isRegenerating && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Key point 信息 */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-ed-on-background">
                  #{kp.id} {kp.title}
                </p>
                <p className="text-xs text-ed-on-surface-variant line-clamp-2">{kp.summary}</p>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  disabled={isRegenerating || isGeneratingAll}
                  onClick={() => handleRegenerateImage(kp.id)}
                  className="px-2.5 py-1 text-xs border border-ed-outline-variant/20 rounded-lg text-ed-on-surface-variant hover:text-ed-on-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRegenerating ? '生成中...' : '重新生成'}
                </button>
                {hasImage && (
                  <button
                    onClick={() => handleDownload(kp.id)}
                    className="px-2.5 py-1 text-xs border border-ed-outline-variant/20 rounded-lg text-ed-on-surface-variant hover:text-ed-on-surface transition-colors"
                  >
                    下载
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
