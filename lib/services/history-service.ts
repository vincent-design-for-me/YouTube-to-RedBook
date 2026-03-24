import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { TranscriptResponse } from '@/lib/types/transcript';
import type { KeyPoint, XiaohongshuCopy, WeChatArticle } from '@/lib/types/generation';

export async function getOrCreateSession(
  userId: string,
  videoUrl: string,
  videoId: string,
  videoTitle?: string
): Promise<string> {
  const supabase = await createServerSupabaseClient();

  // Try to find existing session
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('video_url', videoUrl)
    .single();

  if (existing) {
    if (videoTitle) {
      await supabase
        .from('sessions')
        .update({ video_title: videoTitle })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new session
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      video_url: videoUrl,
      video_id: videoId,
      video_title: videoTitle,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data.id;
}

export async function saveTranscript(
  sessionId: string,
  userId: string,
  lang: string,
  content: TranscriptResponse
) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('transcripts')
    .upsert(
      { session_id: sessionId, user_id: userId, lang, content },
      { onConflict: 'session_id' }
    );

  if (error) console.error('Failed to save transcript:', error.message);
}

export async function saveCopy(
  sessionId: string,
  userId: string,
  keyPoints: KeyPoint[],
  copy: XiaohongshuCopy
) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('xiaohongshu_copies')
    .insert({ session_id: sessionId, user_id: userId, key_points: keyPoints, copy });

  if (error) console.error('Failed to save copy:', error.message);
}

export async function saveArticle(
  sessionId: string,
  userId: string,
  keyPoints: KeyPoint[],
  article: WeChatArticle
) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('wechat_articles')
    .insert({ session_id: sessionId, user_id: userId, key_points: keyPoints, article });

  if (error) console.error('Failed to save article:', error.message);
}

export async function saveImageMetadata(
  sessionId: string,
  userId: string,
  keyPointId: number,
  prompt: string,
  storagePath: string
) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('generated_images')
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        key_point_id: keyPointId,
        prompt,
        storage_path: storagePath,
      },
      { onConflict: 'session_id,key_point_id' }
    );

  if (error) console.error('Failed to save image metadata:', error.message);
}

export async function listSessions(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const supabase = await createServerSupabaseClient();
  const offset = (page - 1) * limit;

  const { data: sessions, error, count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);

  const sessionIds = (sessions || []).map((s) => s.id);

  if (sessionIds.length === 0) {
    return { sessions: [], total: 0, page, limit };
  }

  const [transcripts, copies, articles, images] = await Promise.all([
    supabase.from('transcripts').select('session_id').in('session_id', sessionIds),
    supabase.from('xiaohongshu_copies').select('session_id').in('session_id', sessionIds),
    supabase.from('wechat_articles').select('session_id').in('session_id', sessionIds),
    supabase.from('generated_images').select('session_id').in('session_id', sessionIds),
  ]);

  const transcriptSet = new Set((transcripts.data || []).map((t) => t.session_id));
  const copySet = new Set((copies.data || []).map((c) => c.session_id));
  const articleSet = new Set((articles.data || []).map((a) => a.session_id));

  const imageCountMap = new Map<string, number>();
  for (const img of images.data || []) {
    imageCountMap.set(img.session_id, (imageCountMap.get(img.session_id) || 0) + 1);
  }

  return {
    sessions: (sessions || []).map((s) => ({
      id: s.id,
      video_url: s.video_url,
      video_id: s.video_id,
      video_title: s.video_title,
      created_at: s.created_at,
      has_transcript: transcriptSet.has(s.id),
      has_copy: copySet.has(s.id),
      has_article: articleSet.has(s.id),
      image_count: imageCountMap.get(s.id) || 0,
    })),
    total: count || 0,
    page,
    limit,
  };
}

export async function getSessionDetail(sessionId: string, userId: string) {
  const supabase = await createServerSupabaseClient();

  const [sessionRes, transcriptRes, copiesRes, articlesRes, imagesRes] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', sessionId).eq('user_id', userId).single(),
    supabase.from('transcripts').select('*').eq('session_id', sessionId).single(),
    supabase.from('xiaohongshu_copies').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }),
    supabase.from('wechat_articles').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }),
    supabase.from('generated_images').select('*').eq('session_id', sessionId).order('key_point_id'),
  ]);

  if (sessionRes.error || !sessionRes.data) return null;

  // Generate signed URLs for images
  const imagesWithUrls = await Promise.all(
    (imagesRes.data || []).map(async (img) => {
      const { data } = await supabase.storage
        .from('generated-images')
        .createSignedUrl(img.storage_path, 3600);

      return {
        id: img.id,
        key_point_id: img.key_point_id,
        prompt: img.prompt,
        url: data?.signedUrl || '',
        created_at: img.created_at,
      };
    })
  );

  return {
    ...sessionRes.data,
    transcript: transcriptRes.data
      ? { lang: transcriptRes.data.lang, content: transcriptRes.data.content }
      : null,
    copies: copiesRes.data || [],
    articles: articlesRes.data || [],
    images: imagesWithUrls,
  };
}

export async function deleteSession(sessionId: string, userId: string) {
  const supabase = await createServerSupabaseClient();

  // 1. Get image paths to clean up Storage
  const { data: images } = await supabase
    .from('generated_images')
    .select('storage_path')
    .eq('session_id', sessionId)
    .eq('user_id', userId);

  // 2. Delete files from Storage
  if (images && images.length > 0) {
    const paths = images.map((img) => img.storage_path);
    await supabase.storage.from('generated-images').remove(paths);
  }

  // 3. Delete session (cascade handles child rows)
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to delete session: ${error.message}`);
}
