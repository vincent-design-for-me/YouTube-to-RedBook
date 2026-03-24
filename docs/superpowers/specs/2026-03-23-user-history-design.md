# User History & Memory Feature — Design Spec

## Overview

Add persistent user history so every generation (transcript, xiaohongshu copy, wechat article, images) is saved per-user and browsable from a history dashboard. Migrate auth and storage to Supabase.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Supabase PostgreSQL | Free tier, integrated auth + storage |
| Auth | Supabase Auth (email+password) | Replaces insecure localStorage auth, supports cross-device |
| Image storage | Supabase Storage (private bucket) | DB stores metadata + path, images served via signed URLs |
| Data granularity | Session-based (1 YouTube URL = 1 session) | Matches user mental model of "which videos I processed" |

## Supabase Project

- URL and anon key stored in env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Database Schema

### sessions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid FK auth.users | NOT NULL |
| video_url | text | NOT NULL |
| video_id | text | NOT NULL |
| video_title | text | nullable, for display |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now(), auto-updated via trigger |

Index on `(user_id, created_at DESC)` for history listing.
Unique constraint on `(user_id, video_url)` for session reuse.

Trigger for `updated_at`:
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

Video thumbnails are derived from `video_id` using `https://img.youtube.com/vi/{video_id}/mqdefault.jpg` — no need to store separately.

### transcripts

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK sessions | NOT NULL, ON DELETE CASCADE, UNIQUE |
| user_id | uuid FK auth.users | NOT NULL (denormalized for RLS) |
| lang | text | default 'en' |
| content | jsonb | Full TranscriptResponse |
| created_at | timestamptz | |

### xiaohongshu_copies

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK sessions | NOT NULL, ON DELETE CASCADE |
| user_id | uuid FK auth.users | NOT NULL (denormalized for RLS) |
| key_points | jsonb | KeyPoint[] |
| copy | jsonb | XiaohongshuCopy |
| created_at | timestamptz | |

Regenerating copy for the same session creates a new row (preserves history). Latest row is used for display.

### wechat_articles

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK sessions | NOT NULL, ON DELETE CASCADE |
| user_id | uuid FK auth.users | NOT NULL (denormalized for RLS) |
| key_points | jsonb | KeyPoint[] |
| article | jsonb | WeChatArticle |
| created_at | timestamptz | |

Same regeneration strategy as xiaohongshu_copies — new row per generation.

### generated_images

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK sessions | NOT NULL, ON DELETE CASCADE |
| user_id | uuid FK auth.users | NOT NULL (denormalized for RLS) |
| key_point_id | integer | NOT NULL, ordinal index (1, 2, 3...), not a DB FK |
| prompt | text | nullable |
| storage_path | text | NOT NULL, path in Supabase Storage |
| created_at | timestamptz | |

Unique constraint on `(session_id, key_point_id)` to prevent duplicate images per key point. On regeneration, upsert (replace storage file + update row).

### RLS Policies

All tables have a denormalized `user_id` column for simple, performant RLS (no JOINs needed):

```sql
-- Example for sessions (same pattern for all tables)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own sessions"
  ON sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE USING (auth.uid() = user_id);

-- Repeat for transcripts, xiaohongshu_copies, wechat_articles, generated_images
-- All use: auth.uid() = user_id
```

### Storage Bucket

- Bucket name: `generated-images`
- Access: private
- Path convention: `{user_id}/{session_id}/keypoint-{key_point_id}.png`
- Access via signed URLs (60 min expiry)
- Storage RLS: users can only access paths under their own `user_id/` prefix

## Auth Migration

### Current State
- `lib/context/auth-context.tsx` uses localStorage
- Stores users in `copyflow_users`, session in `copyflow_session`
- Components: `SignUpForm`, `SignInForm` in `components/auth/auth-modals.tsx`

### Target State
- Replace with `@supabase/supabase-js` + `@supabase/ssr`
- `AuthProvider` wraps app, manages Supabase session
- `useAuth()` hook returns `{ user, signIn, signUp, signOut, isLoading }`
- API routes extract user from Supabase session via server client
- Root `middleware.ts` calls helper from `lib/supabase/middleware.ts` to refresh session token

### Existing Users
Existing localStorage users will need to re-register with Supabase Auth. No migration path — acceptable since the app is in early stage.

### New Files
- `lib/supabase/client.ts` — browser Supabase client (singleton)
- `lib/supabase/server.ts` — server Supabase client (per-request, reads cookies)
- `lib/supabase/middleware.ts` — session refresh helper (called by root middleware.ts)

## Data Flow — Save Points

Saving happens **server-side within the SSE stream handler**, before `controller.close()`. This ensures data is saved even if the user closes the browser tab after the stream completes. If a save fails, the generation result is still sent to the client (best-effort save) and the error is logged server-side.

| Event | What is saved | Target |
|-------|--------------|--------|
| Transcript fetched | Create/reuse session + save transcript | `sessions` + `transcripts` |
| Xiaohongshu copy generated | Save key_points + copy (new row) | `xiaohongshu_copies` |
| WeChat article generated | Save key_points + article (new row) | `wechat_articles` |
| Each image generated | Upload PNG to Storage + upsert metadata | Storage + `generated_images` |
| Image regenerated | Replace file in Storage + upsert row | Storage + `generated_images` |

### Session Creation

Sessions are created at transcript-fetch time (`/api/transcript`). The `/api/generate` and `/api/generate-article` routes also fetch transcripts internally — they will create a session too if one doesn't exist for that `(user_id, video_url)`. The unique constraint on `(user_id, video_url)` prevents duplicates via `INSERT ... ON CONFLICT DO NOTHING`.

All generation routes (`/api/generate`, `/api/generate-images`, `/api/generate-article`) receive the `sessionId` from the client after the transcript step. If no `sessionId` is provided, the route looks up or creates a session.

## New API Routes

### GET /api/history?page=1&limit=20

Returns paginated session list for current user. Default: page 1, limit 20.

Response:
```json
{
  "sessions": [
    {
      "id": "uuid",
      "video_url": "...",
      "video_id": "...",
      "video_title": "...",
      "created_at": "...",
      "has_transcript": true,
      "has_copy": true,
      "has_article": false,
      "image_count": 4
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20
}
```

The `has_*` fields and `image_count` are computed via LEFT JOINs (or subqueries) at query time.

### GET /api/history/[sessionId]

Returns full session data.

Response:
```json
{
  "session": {
    "id": "uuid",
    "video_url": "...",
    "video_id": "...",
    "video_title": "...",
    "created_at": "...",
    "transcript": { "lang": "en", "content": { ... } },
    "copies": [{ "id": "uuid", "key_points": [...], "copy": {...}, "created_at": "..." }],
    "articles": [{ "id": "uuid", "key_points": [...], "article": {...}, "created_at": "..." }],
    "images": [{ "id": "uuid", "key_point_id": 1, "url": "signed-url", "created_at": "..." }]
  }
}
```

Images are returned with signed URLs (60 min expiry).

### DELETE /api/history/[sessionId]

1. Query `generated_images` for the session to get all `storage_path` values
2. Batch-delete files from Supabase Storage bucket
3. Delete the session row (cascade handles all child table rows)

## Frontend Changes

### New: /history page

- Accessible from header nav (logged-in users only)
- Lists sessions as cards: video thumbnail (derived from video_id), title, date, content badges
- Click card → navigates to detail view showing all content
- Delete button per session with confirmation
- Pagination with page controls

### Modified: Main page (app/page.tsx)

- After transcript fetch: receive `sessionId` from API, store in state
- Pass `sessionId` to subsequent generation API calls
- After each generation completes: data is already saved server-side
- Add "WeChat article regenerate" button (user requested)

### Modified: Auth modals

- Rewire to Supabase Auth (signUp, signIn with email+password)
- Remove localStorage logic

## File Structure Changes

```
lib/
├── supabase/
│   ├── client.ts              — NEW: browser client
│   ├── server.ts              — NEW: server client
│   └── middleware.ts           — NEW: session refresh helper
├── services/
│   ├── history-service.ts     — NEW: CRUD for sessions + content
│   └── storage-service.ts     — MODIFY: file system → Supabase Storage
├── context/
│   └── auth-context.tsx       — MODIFY: localStorage → Supabase Auth

app/
├── history/
│   └── page.tsx               — NEW: history dashboard
├── api/
│   ├── history/
│   │   ├── route.ts           — NEW: list sessions
│   │   └── [sessionId]/
│   │       └── route.ts       — NEW: get/delete session
│   ├── generate/route.ts      — MODIFY: add save + auth
│   ├── generate-article/route.ts — MODIFY: add save + auth
│   ├── generate-images/route.ts  — MODIFY: add save + auth
│   ├── regenerate-image/route.ts — MODIFY: add save + auth
│   └── transcript/route.ts      — MODIFY: add save + auth

middleware.ts                  — NEW: Next.js middleware entry point, calls lib/supabase/middleware.ts
```

## Dependencies

```
@supabase/supabase-js    — Supabase client SDK
@supabase/ssr            — Next.js SSR integration (cookie-based sessions)
```

## Environment Variables (new)

```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

## Error Handling

- **Save failure**: Generation results are still delivered to the client. Save errors are logged server-side but do not block the user experience. The history page simply won't show that entry.
- **Storage upload failure**: Image is still returned to the client as base64. The `generated_images` row is not created. User can retry via "regenerate" button.
- **Delete failure**: If Storage file deletion fails but DB cascade succeeds, orphaned files remain in Storage. Acceptable for now; can add a cleanup job later.

## What Does NOT Change

- Generation pipeline logic (prompts, LLM calls, image generation)
- SSE streaming mechanism
- Main page UI layout and interaction flow
- Third-party API configuration (LLM_BASE_URL, IMAGE_BASE_URL, etc.)

## Scope Exclusions

- No third-party OAuth (Google/GitHub login) — can add later
- No sharing/collaboration features
- No export functionality beyond current download buttons
- No search within history (just list + view)
- No migration for existing localStorage users (re-register required)
- No rate limiting (can add later)
