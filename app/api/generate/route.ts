import { NextRequest } from 'next/server';
import { fetchTranscript } from '@/lib/services/transcript-service';
import { runCopyPipeline } from '@/lib/services/generation-pipeline';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getOrCreateSession, saveCopy } from '@/lib/services/history-service';
import type { PipelineProgress } from '@/lib/types/generation';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const url = (body.url || '').trim();
  const lang = (body.lang || 'en').trim();
  const sessionId = body.sessionId || null;

  if (!url) {
    return new Response(JSON.stringify({ error: '请输入 YouTube 链接' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract user before stream (cookies() only works in request scope)
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

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
        const result = await runCopyPipeline(transcript, sendEvent);

        sendEvent({
          stage: 'complete',
          progress: 100,
          message: '文案生成完成！请查看效果，满意后可生成配图。',
          data: result,
        });

        // Best-effort save
        if (user) {
          try {
            const sid = sessionId || await getOrCreateSession(user.id, url, result.videoId);
            await saveCopy(sid, user.id, result.keyPoints, result.copy);
          } catch (saveError) {
            console.error('Failed to save copy to history:', saveError);
          }
        }
      } catch (error) {
        console.error('Copy generation error:', error);
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
