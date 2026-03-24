'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { GeneratedImage, KeyPoint, XiaohongshuCopy } from '@/lib/types/generation';

interface CopyViewProps {
  keyPoints: KeyPoint[];
  copy: XiaohongshuCopy;
  images: GeneratedImage[];
  onRegenerateCopy: () => void;
  isRegenerating: boolean;
}

export function CopyView({
  keyPoints,
  copy,
  images,
  onRegenerateCopy,
  isRegenerating,
}: CopyViewProps) {
  const [copied, setCopied] = useState(false);

  const fullCopyText = [
    copy.title,
    '',
    copy.hook,
    '',
    ...copy.sections.flatMap((s) => [s.heading, s.body, '']),
    copy.callToAction,
    '',
    copy.hashtags.map((t) => `#${t}`).join(' '),
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullCopyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleCopy} variant="outline" size="sm">
          {copied ? '已复制!' : '复制文案'}
        </Button>
        <Button
          onClick={onRegenerateCopy}
          variant="secondary"
          size="sm"
          disabled={isRegenerating}
        >
          {isRegenerating ? '重新生成中...' : '重新生成文案'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-base font-medium text-primary">{copy.hook}</p>

          {copy.sections.map((section, index) => {
            const keyPoint = keyPoints.find((kp) => kp.id === section.keyPointId);
            const sectionImage = images.find((img) => img.keyPointId === section.keyPointId);

            return (
              <div key={index} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">{section.heading}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {section.body}
                </p>
                {keyPoint && (
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      {keyPoint.relevantQuotes.map((q, i) => (
                        <span key={i} className="block italic">
                          &ldquo;{q}&rdquo;
                        </span>
                      ))}
                    </p>
                  </div>
                )}
                {sectionImage && (
                  <div className="overflow-hidden rounded-lg border">
                    <img
                      src={`data:image/png;base64,${sectionImage.base64Data}`}
                      alt={section.heading}
                      className="w-full object-cover"
                    />
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-base font-medium">{copy.callToAction}</p>

          <div className="flex flex-wrap gap-2">
            {copy.hashtags.map((tag, i) => (
              <span
                key={i}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
              >
                #{tag}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ImageViewProps {
  keyPoints: KeyPoint[];
  images: GeneratedImage[];
  isGenerating: boolean;
  imageErrors: string[];
  onRegenerateImage?: (keyPointId: number) => void;
  regeneratingImageIds?: Set<number>;
}

export function ImageView({ keyPoints, images, isGenerating, imageErrors, onRegenerateImage, regeneratingImageIds = new Set() }: ImageViewProps) {
  const handleDownloadImage = (base64Data: string, keyPointId: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = `keypoint-${keyPointId}.png`;
    link.click();
  };

  const handleDownloadAll = () => {
    images.forEach((img) => handleDownloadImage(img.base64Data, img.keyPointId));
  };

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 && (
        <div className="flex gap-3">
          <Button onClick={handleDownloadAll} variant="outline" size="sm">
            下载所有图片 ({images.length})
          </Button>
        </div>
      )}

      {imageErrors.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          部分配图生成失败：
          {imageErrors.map((err, i) => (
            <p key={i} className="mt-1">{err}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {keyPoints.map((kp) => {
          const image = images.find((img) => img.keyPointId === kp.id);
          const isRegenerating = regeneratingImageIds.has(kp.id);

          return (
            <Card key={kp.id} className="overflow-hidden">
              {isRegenerating ? (
                <div className="flex aspect-[3/4] items-center justify-center bg-muted/50">
                  <div className="flex flex-col items-center gap-3 px-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-center text-xs text-muted-foreground">
                      重新生成中...
                    </p>
                  </div>
                </div>
              ) : image ? (
                <img
                  src={`data:image/png;base64,${image.base64Data}`}
                  alt={kp.title}
                  className="w-full object-cover"
                />
              ) : isGenerating ? (
                <div className="flex aspect-[3/4] items-center justify-center bg-muted/50">
                  <div className="flex flex-col items-center gap-3 px-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-center text-xs text-muted-foreground">
                      正在生成...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center bg-muted/30">
                  <p className="text-xs text-muted-foreground">生成失败</p>
                </div>
              )}
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">#{kp.id} {kp.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{kp.summary}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {onRegenerateImage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isRegenerating || isGenerating}
                        onClick={() => onRegenerateImage(kp.id)}
                      >
                        {isRegenerating ? '生成中...' : '重新生成'}
                      </Button>
                    )}
                    {image && !isRegenerating && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadImage(image.base64Data, image.keyPointId)}
                      >
                        下载
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
