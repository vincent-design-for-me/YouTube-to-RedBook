'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

interface SessionSummary {
  id: string;
  video_url: string;
  video_id: string;
  video_title: string | null;
  created_at: string;
  has_transcript: boolean;
  has_copy: boolean;
  has_article: boolean;
  image_count: number;
}

interface SessionDetail {
  id: string;
  video_url: string;
  video_id: string;
  video_title: string | null;
  created_at: string;
  transcript: { lang: string; content: any } | null;
  copies: Array<{ id: string; key_points: any[]; copy: any; created_at: string }>;
  articles: Array<{ id: string; key_points: any[]; article: any; created_at: string }>;
  images: Array<{ id: string; key_point_id: number; url: string; created_at: string }>;
}

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Detail view
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/history?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setSessions(data.sessions);
      setTotal(data.total);
    } catch {
      setError('Failed to load history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    if (user) fetchSessions();
  }, [user, fetchSessions]);

  const handleViewDetail = async (sessionId: string) => {
    setSelectedId(sessionId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/history/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch detail');
      const data = await res.json();
      setDetail(data.session);
    } catch {
      setError('Failed to load session detail.');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/history/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDeletingId(null);
      if (selectedId === sessionId) {
        setSelectedId(null);
        setDetail(null);
      }
      fetchSessions();
    } catch {
      setError('Failed to delete session.');
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-ed-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ed-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ed-surface text-ed-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-ed-surface/80 border-b border-ed-outline-variant/10">
        <div className="flex justify-between items-center px-6 md:px-8 py-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <a href="/" className="text-ed-on-surface-variant hover:text-ed-on-surface text-sm transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back
            </a>
            <span className="text-xl font-serif italic text-ed-primary tracking-tight">CopyFlow</span>
          </div>
          <span className="text-ed-on-surface-variant text-sm truncate max-w-[160px]">{user.email}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-8 py-10">
        {/* Detail View */}
        {selectedId && (
          <div className="mb-10">
            <button
              onClick={() => { setSelectedId(null); setDetail(null); }}
              className="text-ed-on-surface-variant hover:text-ed-on-surface text-sm transition-colors flex items-center gap-1.5 mb-6"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to History
            </button>

            {detailLoading && (
              <div className="space-y-6">
                <Skeleton className="h-8 w-2/3 bg-ed-surface-container" />
                <Skeleton className="h-48 w-full bg-ed-surface-container" />
                <Skeleton className="h-32 w-full bg-ed-surface-container-high" />
              </div>
            )}

            {detail && (
              <div className="space-y-8">
                {/* Video Info */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-full sm:w-64 shrink-0">
                    <div className="relative aspect-video rounded-xl overflow-hidden">
                      <Image
                        src={`https://img.youtube.com/vi/${detail.video_id}/mqdefault.jpg`}
                        alt={detail.video_title || 'Video thumbnail'}
                        fill
                        className="object-cover"
                        sizes="256px"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-serif text-2xl text-ed-on-background">
                      {detail.video_title || 'Untitled'}
                    </h2>
                    <a
                      href={detail.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ed-primary/60 text-sm hover:text-ed-primary transition-colors"
                    >
                      {detail.video_url}
                    </a>
                    <p className="text-ed-on-surface-variant text-xs">
                      {new Date(detail.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Transcript */}
                {detail.transcript && (
                  <DetailSection title="Transcript">
                    <pre className="font-sans text-sm text-ed-on-surface leading-7 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                      {(() => {
                        const content = detail.transcript!.content;
                        if (content?.snippets) {
                          return content.snippets
                            .map((s: any) => `[${s.start || ''}] ${s.text}`)
                            .join('\n');
                        }
                        return JSON.stringify(content, null, 2);
                      })()}
                    </pre>
                  </DetailSection>
                )}

                {/* Latest Copy */}
                {detail.copies.length > 0 && (
                  <DetailSection title="Xiaohongshu Copy">
                    <div className="space-y-3">
                      {detail.copies[0].copy?.title && (
                        <h4 className="font-medium text-ed-on-background">{detail.copies[0].copy.title}</h4>
                      )}
                      {detail.copies[0].copy?.body && (
                        <p className="text-sm text-ed-on-surface leading-relaxed whitespace-pre-wrap">
                          {detail.copies[0].copy.body}
                        </p>
                      )}
                      {detail.copies[0].copy?.hashtags && (
                        <p className="text-sm text-ed-primary/70">
                          {detail.copies[0].copy.hashtags.map((t: string) => `#${t}`).join(' ')}
                        </p>
                      )}
                    </div>
                  </DetailSection>
                )}

                {/* Latest Article */}
                {detail.articles.length > 0 && (
                  <DetailSection title="WeChat Article">
                    <div className="space-y-6">
                      {detail.articles[0].article?.title && (
                        <h4 className="font-serif text-xl font-medium text-ed-on-background">{detail.articles[0].article.title}</h4>
                      )}
                      {detail.articles[0].article?.subtitle && (
                        <p className="text-ed-on-surface-variant text-sm italic">{detail.articles[0].article.subtitle}</p>
                      )}
                      {detail.articles[0].article?.sections?.map((section: any, i: number) => (
                        <div key={i} className="space-y-2">
                          <h5 className="font-medium text-ed-on-background">{section.heading}</h5>
                          {section.paragraphs?.map((p: string, j: number) => (
                            <p key={j} className="text-sm text-ed-on-surface leading-relaxed">{p}</p>
                          ))}
                        </div>
                      ))}
                      {detail.articles[0].article?.conclusion && (
                        <div className="border-t border-ed-outline-variant/10 pt-4">
                          <p className="text-sm text-ed-on-surface leading-relaxed">{detail.articles[0].article.conclusion}</p>
                        </div>
                      )}
                    </div>
                  </DetailSection>
                )}

                {/* Images */}
                {detail.images.length > 0 && (
                  <DetailSection title={`Images (${detail.images.length})`}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {detail.images.map((img) => (
                        <div key={img.id} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-ed-surface-container">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={`Key point ${img.key_point_id}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )}
              </div>
            )}
          </div>
        )}

        {/* List View */}
        {!selectedId && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="font-serif text-3xl text-ed-on-background">History</h1>
                <p className="text-ed-on-surface-variant text-sm mt-1">
                  {total > 0 ? `${total} session${total !== 1 ? 's' : ''}` : ''}
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-ed-error-container/15 border border-ed-error/20 rounded-2xl p-5 mb-6">
                <p className="text-ed-error text-sm font-medium">{error}</p>
                <button onClick={fetchSessions} className="text-ed-error text-xs mt-2 underline">
                  Retry
                </button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl overflow-hidden">
                    <Skeleton className="aspect-video w-full bg-ed-surface-container" />
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4 bg-ed-surface-container" />
                      <Skeleton className="h-3 w-1/3 bg-ed-surface-container-high" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16 rounded-full bg-ed-surface-container-high" />
                        <Skeleton className="h-5 w-12 rounded-full bg-ed-surface-container-high" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && sessions.length === 0 && !error && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-ed-surface-container rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-ed-on-surface-variant/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-ed-on-background mb-2">No history yet</h3>
                <p className="text-ed-on-surface-variant text-sm mb-6">
                  Start by extracting a transcript from a YouTube video.
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 bg-gradient-to-b from-ed-primary to-ed-primary-dim text-ed-on-primary px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-all"
                >
                  Get Started
                </a>
              </div>
            )}

            {/* Session Cards */}
            {!loading && sessions.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="group bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl overflow-hidden hover:border-ed-primary/20 hover:shadow-[0_4px_24px_rgba(88,94,108,0.08)] transition-all cursor-pointer relative"
                      onClick={() => handleViewDetail(s.id)}
                    >
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(s.id); }}
                        className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/40 hover:bg-red-600 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>

                      {/* Thumbnail */}
                      <div className="relative aspect-video">
                        <Image
                          src={`https://img.youtube.com/vi/${s.video_id}/mqdefault.jpg`}
                          alt={s.video_title || 'Video thumbnail'}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      </div>

                      {/* Info */}
                      <div className="p-4 space-y-3">
                        <h3 className="text-sm font-medium text-ed-on-background line-clamp-2 leading-snug">
                          {s.video_title || 'Untitled'}
                        </h3>
                        <p className="text-ed-on-surface-variant text-xs">
                          {new Date(s.created_at).toLocaleDateString()}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {s.has_transcript && (
                            <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-ed-primary/10 text-ed-primary font-medium">
                              Transcript
                            </span>
                          )}
                          {s.has_copy && (
                            <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                              Copy
                            </span>
                          )}
                          {s.has_article && (
                            <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                              Article
                            </span>
                          )}
                          {s.image_count > 0 && (
                            <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                              {s.image_count} image{s.image_count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 text-sm text-ed-on-surface-variant hover:text-ed-on-surface border border-ed-outline-variant/20 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-ed-on-surface-variant px-3">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 text-sm text-ed-on-surface-variant hover:text-ed-on-surface border border-ed-outline-variant/20 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Delete Confirmation Dialog */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-ed-surface-container-lowest rounded-2xl p-6 max-w-sm mx-4 shadow-xl space-y-4">
              <h3 className="font-serif text-lg text-ed-on-background">Delete this session?</h3>
              <p className="text-ed-on-surface-variant text-sm">
                This will permanently remove the transcript, copies, articles, and images for this video. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2 text-sm text-ed-on-surface-variant hover:text-ed-on-surface border border-ed-outline-variant/20 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-ed-on-surface-variant tracking-wide uppercase">{title}</h3>
      <div className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl p-6">
        {children}
      </div>
    </div>
  );
}
