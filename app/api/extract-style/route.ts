import { NextRequest } from 'next/server';
import { generateTextWithImage } from '@/lib/llm/text-provider';
import { buildStyleExtractionPrompt } from '@/lib/prompts/extract-style';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const referenceImage: string | undefined = body.referenceImage;

  if (!referenceImage) {
    return new Response(JSON.stringify({ error: '请上传参考图' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { system, user } = buildStyleExtractionPrompt();
    const stylePrompt = await generateTextWithImage(system, user, referenceImage);

    return new Response(JSON.stringify({ stylePrompt }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Style extraction error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '风格提取失败',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
