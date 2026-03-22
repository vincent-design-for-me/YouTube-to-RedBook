import { NextRequest } from 'next/server';
import { runImagePipeline } from '@/lib/services/generation-pipeline';
import type { PipelineProgress, KeyPoint } from '@/lib/types/generation';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const keyPoints: KeyPoint[] = body.keyPoints;
  const transcriptText: string = body.transcriptText || '';

  if (!keyPoints || keyPoints.length === 0) {
    return new Response(JSON.stringify({ error: '缺少知识点数据' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: PipelineProgress) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const images = await runImagePipeline(keyPoints, transcriptText, sendEvent);

        sendEvent({
          stage: 'complete',
          progress: 100,
          message: `配图生成完成！成功 ${images.length}/${keyPoints.length} 张`,
          data: { images },
        });
      } catch (error) {
        console.error('Image generation error:', error);
        sendEvent({
          stage: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : '配图生成失败',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
