import { NextRequest } from 'next/server';
import { generateImage } from '@/lib/llm/image-provider';
import { buildImagePrompt } from '@/lib/prompts/generate-image-prompt';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uploadImage } from '@/lib/services/storage-service';
import { saveImageMetadata } from '@/lib/services/history-service';
import type { KeyPoint } from '@/lib/types/generation';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const keyPoint: KeyPoint = body.keyPoint;
  const transcriptText: string = body.transcriptText || '';
  const sessionId = body.sessionId || null;
  // Style comes pre-extracted and confirmed by the user
  const stylePrompt: string | undefined = body.stylePrompt || undefined;
  const referenceImageBase64: string | undefined = body.referenceImage || undefined;

  if (!keyPoint) {
    return new Response(JSON.stringify({ error: '缺少知识点数据' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const prompt = buildImagePrompt(keyPoint, transcriptText, stylePrompt);
    const base64Data = await generateImage(prompt, {}, referenceImageBase64);

    // Best-effort save to Supabase
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && sessionId) {
        const storagePath = await uploadImage(user.id, sessionId, keyPoint.id, base64Data);
        await saveImageMetadata(sessionId, user.id, keyPoint.id, prompt, storagePath);
      }
    } catch (saveError) {
      console.error('Failed to save regenerated image:', saveError);
    }

    return new Response(
      JSON.stringify({ keyPointId: keyPoint.id, prompt, base64Data }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Image regeneration error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '图片重新生成失败',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
