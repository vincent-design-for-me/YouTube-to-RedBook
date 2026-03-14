import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { TranscriptError } from '@/lib/api/errors';
import { extractVideoId } from '@/lib/utils/extract-video-id';
import type { TranscriptResponse, ErrorResponse } from '@/lib/types/transcript';

/**
 * 处理字幕获取错误
 * @param error - 捕获的错误对象
 * @returns 格式化的错误响应
 */
function handleTranscriptError(error: unknown): NextResponse<ErrorResponse> {
  // 处理自定义错误
  if (error instanceof TranscriptError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  // 处理 YouTube Transcript API 错误
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('transcript is disabled') || message.includes('disabled')) {
      return NextResponse.json(
        { error: '该视频已禁用字幕' },
        { status: 404 }
      );
    }

    if (message.includes('no transcript') || message.includes('not available')) {
      return NextResponse.json(
        { error: '找不到该语言的字幕，请尝试其他语言代码（如 en、zh-Hans）' },
        { status: 404 }
      );
    }

    if (message.includes('video unavailable') || message.includes('not found')) {
      return NextResponse.json(
        { error: '视频不存在或无法访问' },
        { status: 404 }
      );
    }

    if (message.includes('network') || message.includes('fetch')) {
      return NextResponse.json(
        { error: '网络错误，请稍后重试' },
        { status: 503 }
      );
    }
  }

  // 未知错误
  console.error('Unexpected error in transcript API:', error);
  return NextResponse.json(
    { error: '获取字幕失败，请稍后重试' },
    { status: 500 }
  );
}

/**
 * POST /api/transcript
 * 获取 YouTube 视频字幕
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<TranscriptResponse | ErrorResponse>> {
  try {
    const body = await request.json();
    const url = (body.url || '').trim();
    const lang = (body.lang || 'en').trim();

    if (!url) {
      return NextResponse.json(
        { error: '请输入 YouTube 链接' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);

    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang,
    });

    return NextResponse.json({
      video_id: videoId,
      snippets: transcript.map((item) => ({
        start: item.offset / 1000,
        duration: item.duration / 1000,
        text: item.text,
      })),
    });
  } catch (error) {
    return handleTranscriptError(error);
  }
}

