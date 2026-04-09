import { YoutubeTranscript } from 'youtube-transcript';
import { extractVideoId } from '@/lib/utils/extract-video-id';
import { mergeTranscriptSegmentsIntoSentences } from '@/lib/utils/merge-transcript-sentences';
import type { TranscriptResponse } from '@/lib/types/transcript';

async function fetchVideoMeta(videoId: string): Promise<{ title: string; thumbnail_url: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || 'Untitled Video',
        thumbnail_url: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch {
    // fallback below
  }
  return {
    title: 'Untitled Video',
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export async function fetchTranscript(
  url: string,
  lang: string = 'en'
): Promise<TranscriptResponse> {
  const videoId = extractVideoId(url);

  const [transcript, meta] = await Promise.all([
    YoutubeTranscript.fetchTranscript(videoId, { lang }),
    fetchVideoMeta(videoId),
  ]);

  const raw = transcript.map((item) => ({
    start: item.offset / 1000,
    duration: item.duration / 1000,
    text: item.text,
  }));

  return {
    video_id: videoId,
    title: meta.title,
    thumbnail_url: meta.thumbnail_url,
    snippets: mergeTranscriptSegmentsIntoSentences(raw),
  };
}
