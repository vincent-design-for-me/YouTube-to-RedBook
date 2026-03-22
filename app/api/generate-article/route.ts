import { NextRequest } from 'next/server';
import { fetchTranscript } from '@/lib/services/transcript-service';
import { runArticlePipeline } from '@/lib/services/generation-pipeline';
import type { PipelineProgress } from '@/lib/types/generation';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const url = (body.url || '').trim();
  const lang = (body.lang || 'en').trim();

  if (!url) {
    return new Response(JSON.stringify({ error: '请输入 YouTube 链接' }), {
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
        sendEvent({
          stage: 'extracting_keypoints',
          progress: 5,
          message: '正在获取视频字幕...',
        });

        const transcript = await fetchTranscript(url, lang);
        const result = await runArticlePipeline(transcript, sendEvent);

        sendEvent({
          stage: 'complete',
          progress: 100,
          message: '公众号文章生成完成！',
          data: result,
        });
      } catch (error) {
        console.error('Article generation error:', error);
        sendEvent({
          stage: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : '生成失败，请稍后重试',
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
