# User History & Memory Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate auth to Supabase, persist all user-generated content (transcripts, copies, articles, images) per-user, and add a history dashboard at `/history`.

**Architecture:** Session-based data model where each YouTube URL = one session. All content hangs off sessions. Supabase Auth replaces localStorage auth. Supabase Storage holds images; DB holds metadata + signed URLs. Saving happens server-side in API routes (best-effort, non-blocking).

**Tech Stack:** Next.js 16, React 19, Supabase (Auth + PostgreSQL + Storage), @supabase/ssr, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-23-user-history-design.md`

---

## File Structure

```
NEW FILES:
  lib/supabase/client.ts           — Browser Supabase client (singleton)
  lib/supabase/server.ts           — Server Supabase client (per-request, cookie-based)
  lib/supabase/middleware.ts        — Session refresh helper
  lib/services/history-service.ts   — CRUD: sessions, transcripts, copies, articles, images
  app/history/page.tsx              — History dashboard page
  app/api/history/route.ts          — GET: list user sessions
  app/api/history/[sessionId]/route.ts — GET: session detail / DELETE: remove session
  middleware.ts                     — Next.js middleware entry point
  supabase/schema.sql               — Full DB schema for reference

MODIFIED FILES:
  .env.local                        — Add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
  lib/context/auth-context.tsx      — Replace localStorage with Supabase Auth
  components/auth/auth-modals.tsx   — Update to use new auth (interface unchanged)
  app/layout.tsx                    — Keep AuthProvider (implementation changes internally)
  lib/services/storage-service.ts   — Replace file system with Supabase Storage
  app/api/transcript/route.ts       — Add session creation + transcript save + auth
  app/api/generate/route.ts         — Add copy save + auth + accept sessionId
  app/api/generate-article/route.ts — Add article save + auth + accept sessionId
  app/api/generate-images/route.ts  — Add image save + auth + accept sessionId
  app/api/regenerate-image/route.ts — Add image save + auth + accept sessionId
  app/page.tsx                      — Track sessionId, pass to API calls, add article regenerate button
```

---

## Task 1: Install dependencies + env vars + SQL schema

**Files:**
- Modify: `package.json`
- Modify: `.env.local`
- Create: `supabase/schema.sql`

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Add env vars to `.env.local`**

Append to `.env.local` (values are already in the existing `.env.local` — do NOT commit this file):
```
NEXT_PUBLIC_SUPABASE_URL=<from Supabase Dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase Dashboard>
```

**IMPORTANT:** Verify `.env.local` is listed in `.gitignore` before proceeding. Never commit `.env.local`.

- [ ] **Step 3: Create schema SQL file for reference**

Create `supabase/schema.sql`:

```sql
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

-- 8. Storage bucket (run via Supabase Dashboard > Storage > New Bucket)
-- Name: generated-images
-- Public: false
-- Storage policies: allow authenticated users to manage files under their own user_id/ prefix
```

- [ ] **Step 4: Run the SQL in Supabase SQL Editor**

Go to Supabase Dashboard > SQL Editor > paste the full schema and run.
Also create the Storage bucket `generated-images` (private) via Dashboard > Storage > New Bucket.

Add Storage policies via SQL:
```sql
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
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json supabase/schema.sql
git commit -m "feat: add Supabase deps and DB schema"
```

---

## Task 2: Supabase client utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create browser client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in Server Components (read-only cookies)
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware helper**

Create `lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() triggers token refresh via cookies
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 4: Create root middleware**

Create `middleware.ts` at project root:

```typescript
import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 5: Verify build**

```bash
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase client utilities and middleware"
```

---

## Task 3: Auth migration

**Files:**
- Modify: `lib/context/auth-context.tsx`
- Modify: `components/auth/auth-modals.tsx`

- [ ] **Step 1: Rewrite auth context to use Supabase**

Replace `lib/context/auth-context.tsx` with:

```typescript
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type ModalView = 'signIn' | 'signUp' | null;

interface AuthState {
  user: User | null;
  isLoading: boolean;
  modalView: ModalView;
  openSignIn: () => void;
  openSignUp: () => void;
  closeModals: () => void;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalView, setModalView] = useState<ModalView>(null);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const openSignIn = useCallback(() => setModalView('signIn'), []);
  const openSignUp = useCallback(() => setModalView('signUp'), []);
  const closeModals = useCallback(() => setModalView(null), []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    closeModals();
    return { ok: true };
  }, [supabase.auth, closeModals]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    closeModals();
    return { ok: true };
  }, [supabase.auth, closeModals]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase.auth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        modalView,
        openSignIn,
        openSignUp,
        closeModals,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Update auth modals**

The `AuthModals` component and form components stay structurally identical. The only change is that `useAuth()` now returns `user: User | null` instead of `user: string | null`. The forms call the same `signUp(email, password)` and `signIn(email, password)`.

Review `components/auth/auth-modals.tsx` for any references to `user` — the forms don't directly use `user` (they only use `signUp`, `signIn`, `openSignIn`, `openSignUp`), so no changes are needed. But verify this by reading the file.

- [ ] **Step 3: Update main page user references**

In `app/page.tsx`, the current code uses `user` as a string (email). After migration, `user` is a Supabase `User` object. Update the header display:

Find where `user` is displayed (e.g., the email in the header). Change:
- `{user}` → `{user?.email}`
- `const isLoggedIn = !!user;` stays the same (still truthy/falsy check)

Search for all occurrences of `user` in `app/page.tsx` that assume it's a string and update to `user?.email`.

- [ ] **Step 4: Verify build + test auth flow**

```bash
npx next build
```

Start dev server, test sign up, sign in, sign out in browser.

- [ ] **Step 5: Commit**

```bash
git add lib/context/auth-context.tsx app/page.tsx
git commit -m "feat: migrate auth from localStorage to Supabase Auth"
```

---

## Task 4: History service + storage service

**Files:**
- Create: `lib/services/history-service.ts`
- Modify: `lib/services/storage-service.ts`

- [ ] **Step 1: Create history service**

Create `lib/services/history-service.ts`:

```typescript
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
    // Update title if provided
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

  // Get sessions with counts
  const { data: sessions, error, count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);

  // Get content flags for each session
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
        .createSignedUrl(img.storage_path, 3600); // 60 min

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
```

- [ ] **Step 2: Rewrite storage service for Supabase Storage**

Replace `lib/services/storage-service.ts` with:

```typescript
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
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add lib/services/history-service.ts lib/services/storage-service.ts
git commit -m "feat: add history service and migrate storage to Supabase"
```

---

## Task 5: Auth helper for API routes + update transcript route

**Files:**
- Modify: `app/api/transcript/route.ts`

- [ ] **Step 1: Update transcript route with auth + save**

Replace `app/api/transcript/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { TranscriptError } from '@/lib/api/errors';
import { fetchTranscript } from '@/lib/services/transcript-service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getOrCreateSession, saveTranscript } from '@/lib/services/history-service';
import type { TranscriptResponse, ErrorResponse } from '@/lib/types/transcript';

function handleTranscriptError(error: unknown): NextResponse<ErrorResponse> {
  if (error instanceof TranscriptError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('transcript is disabled') || message.includes('disabled')) {
      return NextResponse.json({ error: '该视频已禁用字幕' }, { status: 404 });
    }
    if (message.includes('no transcript') || message.includes('not available')) {
      return NextResponse.json({ error: '找不到该语言的字幕，请尝试其他语言代码（如 en、zh-Hans）' }, { status: 404 });
    }
    if (message.includes('video unavailable') || message.includes('not found')) {
      return NextResponse.json({ error: '视频不存在或无法访问' }, { status: 404 });
    }
    if (message.includes('network') || message.includes('fetch')) {
      return NextResponse.json({ error: '网络错误，请稍后重试' }, { status: 503 });
    }
  }

  console.error('Unexpected error in transcript API:', error);
  return NextResponse.json({ error: '获取字幕失败，请稍后重试' }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = (body.url || '').trim();
    const lang = (body.lang || 'en').trim();

    if (!url) {
      return NextResponse.json({ error: '请输入 YouTube 链接' }, { status: 400 });
    }

    const result = await fetchTranscript(url, lang);

    // Best-effort save: create session + save transcript if user is logged in
    let sessionId: string | null = null;
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        sessionId = await getOrCreateSession(user.id, url, result.video_id, result.title);
        await saveTranscript(sessionId, user.id, lang, result);
      }
    } catch (saveError) {
      console.error('Failed to save transcript to history:', saveError);
    }

    return NextResponse.json({ ...result, sessionId });
  } catch (error) {
    return handleTranscriptError(error);
  }
}
```

Key changes:
- The response now includes `sessionId` so the frontend can pass it to subsequent API calls
- The frontend reads `sessionId` from the response — since this is an extra field on top of `TranscriptResponse`, the frontend should type it as `TranscriptResponse & { sessionId?: string }` or simply read it via `data.sessionId` after the JSON parse

- [ ] **Step 2: Verify build**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/transcript/route.ts
git commit -m "feat: add auth + history save to transcript route"
```

---

## Task 6: Update generate (copy) route

**Files:**
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: Add auth + save to copy generation route**

Update `app/api/generate/route.ts` to:
1. Accept optional `sessionId` from request body
2. After copy generation, save to `xiaohongshu_copies` (best-effort)

The key modifications to the existing route:
- Read `sessionId` from `body.sessionId`
- **IMPORTANT:** Extract user BEFORE creating the ReadableStream (cookies() is not available inside the stream callback)
- After `runCopyPipeline` completes (inside the stream), call `saveCopy` using the pre-extracted user
- If no sessionId provided but user is logged in, look up or create session

```typescript
// At the TOP of the POST handler, BEFORE the ReadableStream:
const sessionId = body.sessionId || null;

// Extract user before stream (cookies() only works in request scope)
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();

// Then inside the stream, after runCopyPipeline completes:
if (user) {
  try {
    const sid = sessionId || await getOrCreateSession(user.id, url, result.videoId);
    await saveCopy(sid, user.id, result.keyPoints, result.copy);
  } catch (saveError) {
    console.error('Failed to save copy to history:', saveError);
  }
}
```

Note: `user` is captured in the closure — safe to use inside the stream callback.

- [ ] **Step 2: Verify build**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: add auth + history save to copy generation route"
```

---

## Task 7: Update generate-article route

**Files:**
- Modify: `app/api/generate-article/route.ts`

- [ ] **Step 1: Add auth + save to article generation route**

Same pattern as Task 6. Accept `sessionId`, **extract user BEFORE the ReadableStream**, save article after generation:

```typescript
// At the TOP of the POST handler, BEFORE the ReadableStream:
const sessionId = body.sessionId || null;
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();

// Inside the stream, after runArticlePipeline completes:
if (user) {
  try {
    const sid = sessionId || await getOrCreateSession(user.id, url, result.videoId);
    await saveArticle(sid, user.id, result.keyPoints, result.article);
  } catch (saveError) {
    console.error('Failed to save article to history:', saveError);
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/generate-article/route.ts
git commit -m "feat: add auth + history save to article generation route"
```

---

## Task 8: Update generate-images + regenerate-image routes

**Files:**
- Modify: `app/api/generate-images/route.ts`
- Modify: `app/api/regenerate-image/route.ts`

- [ ] **Step 1: Update image generation route**

In `app/api/generate-images/route.ts`:
- Accept `sessionId` from request body
- **Extract user BEFORE creating the ReadableStream**
- Wrap `sendEvent` to intercept `image_ready` events and save each image as it arrives

```typescript
// At the TOP of the POST handler, BEFORE the ReadableStream:
const sessionId = body.sessionId || null;
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();

// Inside the stream start() callback, wrap the sendEvent to intercept images:
const originalSendEvent = sendEvent;
const wrappedSendEvent = async (data: PipelineProgress) => {
  originalSendEvent(data);

  // Save each image as it's generated
  if (data.stage === 'image_ready' && data.image && user && sessionId) {
    try {
      const storagePath = await uploadImage(
        user.id, sessionId, data.image.keyPointId, data.image.base64Data
      );
      await saveImageMetadata(
        sessionId, user.id, data.image.keyPointId, data.image.prompt, storagePath
      );
    } catch (err) {
      console.error(`Failed to save image ${data.image.keyPointId}:`, err);
    }
  }
};

// Pass wrappedSendEvent to runImagePipeline instead of sendEvent
await runImagePipeline(keyPoints, transcriptText, wrappedSendEvent);
```

Note: `sendEvent` is synchronous (enqueues to controller), but the save is async. The pipeline uses `Promise.allSettled` internally so images are generated concurrently — saves will also happen concurrently.

- [ ] **Step 2: Update regenerate-image route**

In `app/api/regenerate-image/route.ts`:
- Accept `sessionId` from request body
- This route is NOT an SSE stream (regular JSON response), so `createServerSupabaseClient()` works directly
- After image generation, upload to Storage + upsert metadata

```typescript
const sessionId = body.sessionId || null;

// After generating the image, before returning response:
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
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/generate-images/route.ts app/api/regenerate-image/route.ts
git commit -m "feat: add image upload + history save to image routes"
```

---

## Task 9: History API routes

**Files:**
- Create: `app/api/history/route.ts`
- Create: `app/api/history/[sessionId]/route.ts`

- [ ] **Step 1: Create history list route**

Create `app/api/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listSessions } from '@/lib/services/history-service';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const result = await listSessions(user.id, page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to list history:', error);
    return NextResponse.json({ error: '获取历史记录失败' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create session detail + delete route**

Create `app/api/history/[sessionId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSessionDetail, deleteSession } from '@/lib/services/history-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    const session = await getSessionDetail(sessionId, user.id);
    if (!session) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Failed to get session detail:', error);
    return NextResponse.json({ error: '获取详情失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    await deleteSession(sessionId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/history/
git commit -m "feat: add history API routes (list, detail, delete)"
```

---

## Task 10: Update frontend — track sessionId + article regenerate button

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add sessionId state and pass to API calls**

In `app/page.tsx`:

1. Add state: `const [sessionId, setSessionId] = useState<string | null>(null);`
2. In `handleSubmit` (transcript fetch): read `sessionId` from response and store it:
   ```typescript
   const data = await response.json();
   setTranscript(data);
   if (data.sessionId) setSessionId(data.sessionId);
   ```
3. In `handleGenerateCopy`: add `sessionId` to request body:
   ```typescript
   body: JSON.stringify({ url, lang: 'en', sessionId }),
   ```
4. In `handleGenerateArticle`: add `sessionId` to request body:
   ```typescript
   body: JSON.stringify({ url, lang: 'en', sessionId }),
   ```
5. In `handleGenerateImages`: add `sessionId` to request body:
   ```typescript
   body: JSON.stringify({ keyPoints, transcriptText: ..., sessionId }),
   ```
6. In `handleRegenerateImage`: add `sessionId` to request body:
   ```typescript
   body: JSON.stringify({ keyPoint, transcriptText: ..., sessionId }),
   ```
7. Reset `sessionId` in `handleSubmit` at the top: `setSessionId(null);`

- [ ] **Step 2: Add WeChat article regenerate button**

Find the article section in the JSX. Add a regenerate button similar to the existing copy regenerate button. The `handleGenerateArticle` function already works — just wire up a button that calls it when an article is already displayed.

- [ ] **Step 3: Add history link in header**

Find the header section in `app/page.tsx`. Add a link to `/history` visible only when logged in:

```tsx
{user && (
  <a href="/history" className="text-sm text-ed-on-surface-variant hover:text-ed-on-surface transition-colors">
    History
  </a>
)}
```

- [ ] **Step 4: Verify build**

```bash
npx next build
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: track sessionId in frontend, add article regenerate + history link"
```

---

## Task 11: History dashboard page

**Files:**
- Create: `app/history/page.tsx`

- [ ] **Step 1: Create the history page**

Create `app/history/page.tsx` — a client component that:
1. Calls `GET /api/history` on mount
2. Displays sessions as cards in a grid
3. Each card shows: video thumbnail (from `https://img.youtube.com/vi/{video_id}/mqdefault.jpg`), title, date, content badges (transcript/copy/article/images)
4. Click card → calls `GET /api/history/[sessionId]` and expands to show full content
5. Delete button per card (with confirmation dialog) → calls `DELETE /api/history/[sessionId]`
6. Pagination controls at bottom
7. Redirects to home if not logged in

Use existing UI components (`Card`, `Button`, `Skeleton`) and follow the app's existing Tailwind styling patterns (the `ed-*` color scheme).

The page should handle:
- Loading state (skeleton cards)
- Empty state ("No history yet")
- Error state
- Delete confirmation

- [ ] **Step 2: Verify build + manual test**

```bash
npx next build
```

Start dev server, navigate to `/history`, verify it shows (empty for new user), then generate some content on the main page and verify it appears in history.

- [ ] **Step 3: Commit**

```bash
git add app/history/
git commit -m "feat: add history dashboard page"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Full flow test**

1. Sign up with a new account
2. Enter a YouTube URL → verify transcript appears + check Supabase `sessions` + `transcripts` tables
3. Generate Xiaohongshu copy → verify `xiaohongshu_copies` table
4. Generate images → verify `generated_images` table + `generated-images` bucket in Storage
5. Generate WeChat article → verify `wechat_articles` table
6. Regenerate an image → verify Storage file is replaced + row updated
7. Go to `/history` → verify the session appears with all content badges
8. Click on the session → verify all content loads with signed image URLs
9. Delete the session → verify all data is cleaned up (DB rows + Storage files)
10. Sign out → verify `/history` redirects or shows login prompt

- [ ] **Step 2: Verify build passes clean**

```bash
npx next build
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete user history & memory feature with Supabase"
```
