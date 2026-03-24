-- ============================================
-- CopyFlow Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. sessions table
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_url text NOT NULL,
  video_id text NOT NULL,
  video_title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_url)
);

CREATE INDEX idx_sessions_user_created ON sessions(user_id, created_at DESC);

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. transcripts table
CREATE TABLE transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lang text DEFAULT 'en',
  content jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. xiaohongshu_copies table
CREATE TABLE xiaohongshu_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_points jsonb NOT NULL,
  copy jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. wechat_articles table
CREATE TABLE wechat_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_points jsonb NOT NULL,
  article jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 6. generated_images table
CREATE TABLE generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_point_id integer NOT NULL,
  prompt text,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, key_point_id)
);

-- 7. RLS Policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transcripts" ON transcripts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE xiaohongshu_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own copies" ON xiaohongshu_copies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE wechat_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own articles" ON wechat_articles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own images" ON generated_images FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Storage policies (run AFTER creating 'generated-images' bucket in Dashboard)
CREATE POLICY "Users upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);
