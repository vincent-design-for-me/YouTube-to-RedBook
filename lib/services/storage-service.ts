import { createServerSupabaseClient } from '@/lib/supabase/server';

const BUCKET = 'generated-images';

export async function uploadImage(
  userId: string,
  sessionId: string,
  keyPointId: number,
  base64Data: string
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const storagePath = `${userId}/${sessionId}/keypoint-${keyPointId}.png`;
  const buffer = Buffer.from(base64Data, 'base64');

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) throw new Error(`Failed to upload image: ${error.message}`);
  return storagePath;
}

export async function deleteImages(
  storagePaths: string[]
): Promise<void> {
  if (storagePaths.length === 0) return;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(storagePaths);

  if (error) console.error('Failed to delete images from storage:', error.message);
}
