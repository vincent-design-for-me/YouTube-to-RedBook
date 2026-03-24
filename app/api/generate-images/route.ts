import { NextRequest } from 'next/server';
import { runImagePipeline } from '@/lib/services/generation-pipeline';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uploadImage } from '@/lib/services/storage-service';
import { saveImageMetadata } from '@/lib/services/history-service';
import type { PipelineProgress, KeyPoint } from '@/lib/types/generation';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const keyPoints: KeyPoint[] = body.keyPoints;
  const transcriptText: string = body.transcriptText || '';
  const sessionId = body.sessionId || null;

  if (!keyPoints || keyPoints.length === 0) {
    return new Response(JSON.stringify({ error: '缺少知识点数据' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: PipelineProgress) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Wrap sendEvent to save images as they arrive
        const wrappedSendEvent = (data: PipelineProgress) => {
          sendEvent(data);

          // Save each image as it's generated (fire-and-forget)
          if (data.stage === 'image_ready' && data.image && user && sessionId) {
            uploadImage(user.id, sessionId, data.image.keyPointId, data.image.base64Data)
              .then((storagePath) =>
                saveImageMetadata(sessionId, user.id, data.image!.keyPointId, data.image!.prompt, storagePath)
              )
              .catch((err) =>
                console.error(`Failed to save image ${data.image!.keyPointId}:`, err)
              );
          }
        };

        await runImagePipeline(keyPoints, transcriptText, wrappedSendEvent);
        // 图片通过 image_ready 事件逐张推送，不再一次性打包发送
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
