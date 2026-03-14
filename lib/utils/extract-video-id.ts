import { TranscriptError, TranscriptErrorType } from '@/lib/api/errors';

/**
 * 从 YouTube URL 或视频 ID 中提取视频 ID
 * @param urlOrId - YouTube URL 或 11 位视频 ID
 * @returns 提取的视频 ID
 * @throws {TranscriptError} 如果无法识别 URL 或 ID
 */
export function extractVideoId(urlOrId: string): string {
  const patterns = [
    /(?:v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // 检查是否是纯视频 ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId;
  }

  throw new TranscriptError(
    TranscriptErrorType.INVALID_URL,
    '无法识别的 YouTube 链接或 ID',
    400
  );
}
