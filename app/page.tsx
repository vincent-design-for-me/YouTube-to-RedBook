'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { WeChatArticlePreview } from '@/components/ui/wechat-article-preview';
import { useAuth } from '@/lib/context/auth-context';
import { formatTime } from '@/lib/utils/format-time';
import type { TranscriptResponse, ErrorResponse } from '@/lib/types/transcript';
import type { WeChatArticle, KeyPoint, XiaohongshuCopy, GeneratedImage } from '@/lib/types/generation';
import { CopyView, ImageView } from '@/components/ui/xiaohongshu-preview';
import { readSSEStream } from '@/lib/utils/sse';

export default function Home() {
  const { user, isLoading: authLoading, openSignIn, openSignUp, signOut } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState<TranscriptResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const transcriptTopRef = useRef<HTMLDivElement>(null);

  // Xiaohongshu generation state
  const [keyPoints, setKeyPoints] = useState<KeyPoint[] | null>(null);
  const [copy, setCopy] = useState<XiaohongshuCopy | null>(null);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [copyProgress, setCopyProgress] = useState('');

  // Image generation state
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [regeneratingImageIds, setRegeneratingImageIds] = useState<Set<number>>(new Set());

  // Reference image for style
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [stylePrompt, setStylePrompt] = useState<string | null>(null);
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);
  const [styleConfirmed, setStyleConfirmed] = useState(false);

  // Article generation state
  const [article, setArticle] = useState<WeChatArticle | null>(null);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [articleProgress, setArticleProgress] = useState('');

  // Session tracking
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setReferenceImagePreview(dataUrl);
      // Strip data URI prefix to get raw base64
      setReferenceImage(dataUrl.replace(/^data:image\/\w+;base64,/, ''));
    };
    reader.readAsDataURL(file);
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setStylePrompt(null);
    setStyleConfirmed(false);
    if (referenceInputRef.current) referenceInputRef.current.value = '';
  };

  const handleExtractStyle = async () => {
    if (!referenceImage) return;
    setIsExtractingStyle(true);
    setStylePrompt(null);
    setStyleConfirmed(false);
    setError('');

    try {
      const response = await fetch('/api/extract-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceImage }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Style extraction failed');
        return;
      }

      setStylePrompt(data.stylePrompt);
    } catch {
      setError('风格提取失败，请重试');
    } finally {
      setIsExtractingStyle(false);
    }
  };

  // Scroll to results when transcript loads
  useEffect(() => {
    if (transcript && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [transcript]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTranscript(null);
    setTranscriptExpanded(false);
    setKeyPoints(null);
    setCopy(null);
    setImages([]);
    setImageErrors([]);
    setArticle(null);
    setSessionId(null);

    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, lang: 'en' }),
      });

      const data: TranscriptResponse | ErrorResponse = await response.json();

      if (!response.ok) {
        setError((data as ErrorResponse).error || 'Failed to extract transcript');
        return;
      }

      setTranscript(data as TranscriptResponse);
      if ((data as any).sessionId) setSessionId((data as any).sessionId);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyFullTranscript = async () => {
    if (!transcript) return;
    const text = transcript.snippets
      .map((s) => `[${formatTime(s.start)}] ${s.text}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateCopy = async () => {
    setIsGeneratingCopy(true);
    setError('');
    setKeyPoints(null);
    setCopy(null);
    setCopyProgress('Starting...');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, lang: 'en', sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Generation failed');
        setIsGeneratingCopy(false);
        return;
      }

      await readSSEStream(response, (progress) => {
        setCopyProgress(progress.message);

        if (progress.stage === 'complete' && progress.data) {
          const d = progress.data as { keyPoints?: KeyPoint[]; copy?: XiaohongshuCopy };
          if (d.keyPoints) setKeyPoints(d.keyPoints);
          if (d.copy) setCopy(d.copy);
        } else if (progress.stage === 'error') {
          setError(progress.message);
        }
      });
    } catch {
      setError('Content generation failed. Please try again.');
    } finally {
      setIsGeneratingCopy(false);
      setCopyProgress('');
    }
  };

  const handleGenerateImages = async () => {
    if (!keyPoints || !transcript) return;
    setIsGeneratingImages(true);
    setError('');
    setImages([]);
    setImageErrors([]);

    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyPoints,
          transcriptText: transcript.snippets.map((s) => s.text).join(' '),
          sessionId,
          stylePrompt: styleConfirmed ? stylePrompt : undefined,
          referenceImage: styleConfirmed ? referenceImage : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Image generation failed');
        setIsGeneratingImages(false);
        return;
      }

      const errors: string[] = [];

      await readSSEStream(response, (progress) => {
        if (progress.message.includes('生成失败:')) {
          errors.push(progress.message);
        }

        if (progress.stage === 'image_ready' && progress.image) {
          setImages((prev) => [...prev, progress.image as GeneratedImage]);
        } else if (progress.stage === 'complete') {
          setImageErrors(errors);
        } else if (progress.stage === 'error') {
          setError(progress.message);
        }
      });
    } catch {
      setError('Image generation failed. Please try again.');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleRegenerateImage = async (keyPointId: number) => {
    if (!keyPoints || !transcript) return;
    const keyPoint = keyPoints.find((kp) => kp.id === keyPointId);
    if (!keyPoint) return;

    setRegeneratingImageIds((prev) => new Set(prev).add(keyPointId));

    try {
      const response = await fetch('/api/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyPoint,
          transcriptText: transcript.snippets.map((s) => s.text).join(' '),
          sessionId,
          stylePrompt: styleConfirmed ? stylePrompt : undefined,
          referenceImage: styleConfirmed ? referenceImage : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || `图片 #${keyPointId} 重新生成失败`);
        return;
      }

      const newImage: GeneratedImage = await response.json();
      setImages((prev) => {
        const filtered = prev.filter((img) => img.keyPointId !== keyPointId);
        return [...filtered, newImage];
      });
    } catch {
      setError(`图片 #${keyPointId} 重新生成失败，请重试`);
    } finally {
      setRegeneratingImageIds((prev) => {
        const next = new Set(prev);
        next.delete(keyPointId);
        return next;
      });
    }
  };

  const handleGenerateArticle = async () => {
    setIsGeneratingArticle(true);
    setError('');
    setArticle(null);
    setArticleProgress('Starting...');

    try {
      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, lang: 'en', sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Article generation failed');
        setIsGeneratingArticle(false);
        return;
      }

      await readSSEStream(response, (progress) => {
        setArticleProgress(progress.message);

        if (progress.stage === 'complete' && progress.data) {
          const d = progress.data as { article?: WeChatArticle };
          if (d.article) setArticle(d.article);
        } else if (progress.stage === 'error') {
          setError(progress.message);
        }
      });
    } catch {
      setError('Article generation failed. Please try again.');
    } finally {
      setIsGeneratingArticle(false);
      setArticleProgress('');
    }
  };

  // Build markdown-style transcript text
  const transcriptMarkdown = transcript
    ? transcript.snippets
        .map((s) => `[${formatTime(s.start)}] ${s.text}`)
        .join('\n')
    : '';

  // Logged-out users see first 30 lines; logged-in see 30 by default, expandable
  const PREVIEW_LINES = 30;
  const allLines = transcriptMarkdown.split('\n');
  const isLoggedIn = !!user;
  const canExpand = allLines.length > PREVIEW_LINES;
  const showPaywall = !isLoggedIn && canExpand;
  const visibleLines = (!isLoggedIn || !transcriptExpanded) && canExpand
    ? allLines.slice(0, PREVIEW_LINES)
    : allLines;
  const showExpandButton = isLoggedIn && canExpand && !transcriptExpanded;
  const showCollapseControls = isLoggedIn && canExpand && transcriptExpanded;

  const scrollToTranscriptTop = useCallback(() => {
    transcriptTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const collapseTranscript = useCallback(() => {
    setTranscriptExpanded(false);
    // Scroll back to top after collapsing
    setTimeout(() => {
      transcriptTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  return (
    <div className="min-h-screen bg-ed-surface text-ed-on-surface selection:bg-ed-primary-container selection:text-ed-on-primary-container">

      {/* Minimal Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-ed-surface/80 border-b border-ed-outline-variant/10">
        <div className="flex justify-between items-center px-6 md:px-8 py-4 max-w-5xl mx-auto">
          <span className="text-xl font-serif italic text-ed-primary tracking-tight">CopyFlow</span>
          {!authLoading && (
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <>
                  <span className="text-ed-on-surface-variant text-sm truncate max-w-[160px]">{user?.email}</span>
                  <a href="/history" className="text-ed-on-surface-variant hover:text-ed-on-surface text-sm font-medium transition-colors">
                    History
                  </a>
                  <button
                    onClick={signOut}
                    className="text-ed-primary/70 hover:text-ed-primary text-sm font-medium transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={openSignIn}
                    className="text-ed-primary/70 hover:text-ed-primary text-sm font-medium transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={openSignUp}
                    className="bg-gradient-to-b from-ed-primary to-ed-primary-dim text-ed-on-primary px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 active:scale-95 transition-all duration-150"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-8">

        {/* Hero */}
        <section className="pt-20 md:pt-32 pb-12 text-center">
          <h1 className="font-serif text-4xl md:text-5xl text-ed-on-background leading-tight -tracking-[0.02em]">
            Extract YouTube <span className="italic">Transcripts</span>
          </h1>
          <p className="text-ed-on-surface-variant text-base md:text-lg mt-4 max-w-lg mx-auto leading-relaxed font-light">
            Paste a YouTube link and get the full transcript in seconds. Copy it, or turn it into Xiaohongshu or WeChat content.
          </p>
        </section>

        {/* URL Input + CTA */}
        <section className="pb-16">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                required
                disabled={loading}
                className="w-full bg-ed-surface-container-lowest border border-ed-outline-variant/20 rounded-2xl py-5 px-6 text-ed-on-background text-base placeholder:text-ed-outline-variant/50 focus:ring-2 focus:ring-ed-primary/20 focus:border-ed-primary/30 shadow-[0_2px_20px_rgba(40,52,57,0.04)] transition-all duration-300 font-light h-auto pr-14"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-ed-outline-variant/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-b from-ed-primary to-ed-primary-dim text-ed-on-primary px-10 py-4 rounded-2xl text-base font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_24px_rgba(88,94,108,0.2)] flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center md:w-auto"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <span>Extract Transcript</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Error */}
        {error && (
          <section className="pb-8">
            <div className="bg-ed-error-container/15 border border-ed-error/20 rounded-2xl p-5">
              <p className="text-ed-error text-sm font-medium">{error}</p>
            </div>
          </section>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <section className="pb-16 space-y-8">
            <div className="flex justify-center">
              <Skeleton className="w-full max-w-md aspect-video rounded-2xl bg-ed-surface-container" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3 mx-auto bg-ed-surface-container" />
              <Skeleton className="h-4 w-1/3 mx-auto bg-ed-surface-container-high" />
            </div>
            <div className="space-y-3 pt-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <Skeleton className="h-3 w-14 bg-ed-surface-container-high shrink-0 mt-1" />
                  <Skeleton className="h-3 w-full bg-ed-surface-container" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* === RESULTS === */}
        {transcript && !loading && (
          <section ref={resultRef} className="pb-16 space-y-10">

            {/* 1. Video Thumbnail */}
            <div className="flex justify-center">
              <a
                href={`https://www.youtube.com/watch?v=${transcript.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full max-w-md group"
              >
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-[0_4px_32px_rgba(40,52,57,0.1)] group-hover:shadow-[0_8px_40px_rgba(40,52,57,0.18)] transition-shadow duration-300">
                  <Image
                    src={transcript.thumbnail_url}
                    alt={transcript.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 448px"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                    <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-ed-on-background ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </a>
            </div>

            {/* 2. Video Info */}
            <div className="text-center space-y-2">
              <h2 className="font-serif text-xl md:text-2xl text-ed-on-background leading-snug">
                {transcript.title}
              </h2>
              <a
                href={`https://www.youtube.com/watch?v=${transcript.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ed-primary/60 text-sm hover:text-ed-primary transition-colors inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.5 8.25" />
                </svg>
                youtube.com/watch?v={transcript.video_id}
              </a>
            </div>

            <div className="border-t border-ed-outline-variant/15" />

            {/* 3. Transcript Content */}
            <div ref={transcriptTopRef}>
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-4 h-4 text-ed-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <h3 className="text-sm font-medium text-ed-on-surface-variant tracking-wide uppercase">Transcript</h3>
                <span className="text-ed-outline-variant text-xs ml-auto">
                  {transcript.snippets.length} segments
                </span>
              </div>

              <div className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl p-6 md:p-8 relative">
                <pre className="font-sans text-sm text-ed-on-surface leading-7 whitespace-pre-wrap break-words">
                  {visibleLines.map((line, i) => {
                    const match = line.match(/^\[(.+?)\]\s(.+)$/);
                    if (!match) return <span key={i}>{line}{'\n'}</span>;
                    return (
                      <span key={i}>
                        <span className="text-ed-primary/40 font-mono text-xs select-none">{match[1]}</span>
                        {'  '}
                        <span>{match[2]}</span>
                        {'\n'}
                      </span>
                    );
                  })}
                </pre>

                {(showPaywall || showExpandButton) && (
                  <div className="absolute bottom-0 left-0 right-0 h-[480px] max-h-[80%] bg-gradient-to-t from-ed-surface-container-lowest via-ed-surface-container-lowest/60 to-transparent rounded-b-2xl pointer-events-none" />
                )}

                {showExpandButton && (
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                    <button
                      onClick={() => setTranscriptExpanded(true)}
                      className="text-ed-on-surface-variant hover:text-ed-on-surface border border-ed-outline-variant/30 hover:border-ed-outline-variant/50 bg-ed-surface-container-lowest hover:bg-ed-surface-container-low px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm"
                    >
                      Expand More
                    </button>
                  </div>
                )}

                {showCollapseControls && (
                  <div className="flex justify-center gap-3 pt-6">
                    <button
                      onClick={scrollToTranscriptTop}
                      className="text-ed-on-surface-variant hover:text-ed-on-surface border border-ed-outline-variant/20 hover:border-ed-outline-variant/40 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-ed-surface-container-low inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                      Back to Top
                    </button>
                    <button
                      onClick={collapseTranscript}
                      className="text-ed-on-surface-variant hover:text-ed-on-surface border border-ed-outline-variant/20 hover:border-ed-outline-variant/40 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-ed-surface-container-low inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 15.75l-7.5-7.5-7.5 7.5" />
                      </svg>
                      Collapse
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 4a. Paywall (logged out) */}
            {showPaywall && (
              <div className="relative">
                <div className="bg-gradient-to-br from-ed-surface-container-low to-ed-surface-container rounded-3xl p-8 md:p-12 text-center space-y-6 border border-ed-outline-variant/10">
                  <div className="w-12 h-12 bg-ed-primary-container rounded-2xl flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-ed-on-primary-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-serif text-2xl md:text-3xl text-ed-on-background">
                      Sign up to unlock the full transcript
                    </h3>
                    <p className="text-ed-on-surface-variant text-sm md:text-base max-w-md mx-auto leading-relaxed">
                      Create a free account to copy the complete transcript, or go further — generate Xiaohongshu posts, WeChat articles, and matching images with AI.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <span className="bg-ed-surface-container-lowest text-ed-on-surface-variant text-xs font-medium px-3 py-1.5 rounded-full border border-ed-outline-variant/10">
                      Copy full transcript
                    </span>
                    <span className="bg-ed-surface-container-lowest text-ed-on-surface-variant text-xs font-medium px-3 py-1.5 rounded-full border border-ed-outline-variant/10">
                      Xiaohongshu posts
                    </span>
                    <span className="bg-ed-surface-container-lowest text-ed-on-surface-variant text-xs font-medium px-3 py-1.5 rounded-full border border-ed-outline-variant/10">
                      WeChat articles
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                    <button
                      onClick={openSignUp}
                      className="bg-gradient-to-b from-ed-primary to-ed-primary-dim text-ed-on-primary px-8 py-3.5 rounded-2xl text-base font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_24px_rgba(88,94,108,0.2)] w-full sm:w-auto"
                    >
                      Sign Up Free
                    </button>
                    <button
                      onClick={openSignIn}
                      className="text-ed-primary/70 hover:text-ed-primary text-sm font-medium transition-colors px-4 py-3.5"
                    >
                      Already have an account? Sign in
                    </button>
                  </div>

                  <p className="text-ed-outline-variant text-xs">
                    No credit card required
                  </p>
                </div>
              </div>
            )}

            {/* 4b. Actions toolbar (logged in) */}
            {isLoggedIn && !article && !isGeneratingArticle && !copy && !isGeneratingCopy && (
              <div className="space-y-4">
                {/* Copy button */}
                <div className="flex justify-center">
                  <button
                    onClick={copyFullTranscript}
                    className="flex items-center gap-2 bg-ed-surface-container-lowest text-ed-on-surface text-sm font-medium px-5 py-3 rounded-xl border border-ed-outline-variant/15 hover:bg-ed-surface-container transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        <span>Copy Transcript</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Workflow choice */}
                <div className="border-t border-ed-outline-variant/15 pt-6">
                  <p className="text-center text-ed-on-surface-variant text-sm mb-4">Next step: choose a content format</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Xiaohongshu option */}
                    <button
                      onClick={handleGenerateCopy}
                      className="group bg-ed-surface-container-lowest border border-ed-outline-variant/15 rounded-2xl p-6 text-left hover:border-ed-primary/30 hover:shadow-[0_4px_24px_rgba(88,94,108,0.08)] transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-ed-error-container/20 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-ed-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                          </svg>
                        </div>
                        <h4 className="font-medium text-ed-on-background text-sm">Xiaohongshu Post</h4>
                      </div>
                      <p className="text-ed-on-surface-variant text-xs leading-relaxed">
                        Short-form visual content with emoji, hashtags, and matching AI images.
                      </p>
                      <span className="text-ed-primary text-xs mt-3 block font-medium group-hover:underline">Generate now &rarr;</span>
                    </button>

                    {/* WeChat Article option */}
                    <button
                      onClick={handleGenerateArticle}
                      className="group bg-ed-surface-container-lowest border border-ed-outline-variant/15 rounded-2xl p-6 text-left hover:border-ed-primary/30 hover:shadow-[0_4px_24px_rgba(88,94,108,0.08)] transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                        <h4 className="font-medium text-ed-on-background text-sm">WeChat Article</h4>
                      </div>
                      <p className="text-ed-on-surface-variant text-xs leading-relaxed">
                        Long-form editorial article with depth, storytelling, and structured analysis.
                      </p>
                      <span className="text-ed-primary text-xs mt-3 block font-medium group-hover:underline">Generate now &rarr;</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Xiaohongshu generating skeleton */}
            {isGeneratingCopy && !copy && (
              <div className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl p-8 md:p-12 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5 animate-spin text-ed-primary" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-ed-on-surface-variant text-sm">{copyProgress}</span>
                </div>
                <Skeleton className="h-7 w-2/3 bg-ed-surface-container" />
                <Skeleton className="h-4 w-full bg-ed-surface-container-high" />
                <div className="pt-2 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-5 w-1/3 bg-ed-surface-container" />
                      <Skeleton className="h-4 w-full bg-ed-surface-container-high" />
                      <Skeleton className="h-4 w-5/6 bg-ed-surface-container-high" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Xiaohongshu result */}
            {keyPoints && copy && (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-ed-primary/60 font-sans tracking-[0.15em] uppercase text-[0.6875rem] font-semibold">
                      Xiaohongshu
                    </span>
                    <h2 className="font-serif text-2xl text-ed-on-background mt-1">小红书内容预览</h2>
                  </div>
                  {images.length === 0 && !isGeneratingImages && (
                    <button
                      onClick={handleGenerateImages}
                      className="flex items-center gap-2 bg-gradient-to-b from-ed-primary to-ed-primary-dim text-ed-on-primary text-sm font-medium px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      Generate Images ({keyPoints.length})
                    </button>
                  )}
                </div>

                {images.length === 0 && !isGeneratingImages && (
                  <div className="space-y-4">
                    <p className="text-ed-on-surface-variant/70 text-sm leading-relaxed">
                      Copy is ready. Click &quot;Generate Images&quot; when you&apos;re happy with the copy. Optionally upload a reference image to control the visual style.
                    </p>

                    {/* Step 1: Reference image upload */}
                    <div className="rounded-xl border border-dashed border-ed-outline-variant/30 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-ed-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                        </svg>
                        <span className="text-sm font-medium text-ed-on-surface-variant">Style Reference (Optional)</span>
                      </div>

                      {referenceImagePreview ? (
                        <div className="flex items-start gap-3">
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-ed-outline-variant/20 flex-shrink-0">
                            <Image src={referenceImagePreview} alt="Style reference" fill className="object-cover" />
                          </div>
                          <div className="flex flex-col gap-1.5 flex-1">
                            <span className="text-xs text-ed-on-surface-variant/60">Reference uploaded</span>
                            <div className="flex gap-2">
                              {!stylePrompt && !isExtractingStyle && (
                                <button
                                  onClick={handleExtractStyle}
                                  className="text-xs bg-ed-primary/10 text-ed-primary px-3 py-1.5 rounded-lg hover:bg-ed-primary/20 transition-colors font-medium"
                                >
                                  Extract Style
                                </button>
                              )}
                              <button
                                onClick={clearReferenceImage}
                                className="text-xs text-red-400 hover:text-red-500 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => referenceInputRef.current?.click()}
                          className="w-full py-2.5 rounded-lg border border-ed-outline-variant/20 text-ed-on-surface-variant/60 text-sm hover:border-ed-primary/30 hover:text-ed-primary/60 transition-all"
                        >
                          Click to upload reference image
                        </button>
                      )}
                      <input
                        ref={referenceInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleReferenceImageUpload}
                        className="hidden"
                      />

                      {/* Step 2: Extracting style indicator */}
                      {isExtractingStyle && (
                        <div className="flex items-center gap-2 text-ed-on-surface-variant/70 text-sm py-2">
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Analyzing style...
                        </div>
                      )}

                      {/* Step 3: Show extracted style for confirmation */}
                      {stylePrompt && !styleConfirmed && (
                        <div className="space-y-2 pt-2 border-t border-ed-outline-variant/15">
                          <label className="text-xs font-medium text-ed-on-surface-variant">
                            Extracted Style Prompt (you can edit)
                          </label>
                          <textarea
                            value={stylePrompt}
                            onChange={(e) => setStylePrompt(e.target.value)}
                            rows={5}
                            className="w-full text-xs bg-ed-surface-container-lowest border border-ed-outline-variant/20 rounded-lg p-3 text-ed-on-background focus:ring-2 focus:ring-ed-primary/20 focus:border-ed-primary/30 resize-y font-mono leading-relaxed"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setStyleConfirmed(true)}
                              className="text-xs bg-ed-primary text-ed-on-primary px-4 py-1.5 rounded-lg hover:opacity-90 transition-all font-medium"
                            >
                              Confirm Style
                            </button>
                            <button
                              onClick={handleExtractStyle}
                              className="text-xs text-ed-on-surface-variant/60 hover:text-ed-on-surface-variant px-3 py-1.5 rounded-lg border border-ed-outline-variant/20 hover:border-ed-outline-variant/40 transition-all"
                            >
                              Re-extract
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step 4: Confirmed style badge */}
                      {styleConfirmed && (
                        <div className="flex items-center justify-between pt-2 border-t border-ed-outline-variant/15">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span className="text-xs text-green-600 font-medium">Style confirmed</span>
                          </div>
                          <button
                            onClick={() => setStyleConfirmed(false)}
                            className="text-xs text-ed-on-surface-variant/50 hover:text-ed-on-surface-variant transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <CopyView
                  keyPoints={keyPoints}
                  copy={copy}
                  images={images}
                  onRegenerateCopy={handleGenerateCopy}
                  isRegenerating={isGeneratingCopy}
                />

                {/* Image generation section */}
                {(isGeneratingImages || images.length > 0) && (
                  <div className="pt-6 border-t border-ed-outline-variant/15 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-ed-primary/60 font-sans tracking-[0.15em] uppercase text-[0.6875rem] font-semibold">
                          Images
                        </span>
                        <h3 className="font-serif text-xl text-ed-on-background mt-1">配图预览</h3>
                      </div>
                      <span className="text-ed-on-surface-variant text-sm mt-2">
                        {isGeneratingImages ? 'Generating...' : `${images.length}/${keyPoints.length}`}
                      </span>
                    </div>
                    <ImageView
                      keyPoints={keyPoints}
                      images={images}
                      isGenerating={isGeneratingImages}
                      imageErrors={imageErrors}
                      onRegenerateImage={handleRegenerateImage}
                      regeneratingImageIds={regeneratingImageIds}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Article generating skeleton */}
            {isGeneratingArticle && !article && (
              <div className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl p-8 md:p-12 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5 animate-spin text-ed-primary" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-ed-on-surface-variant text-sm">{articleProgress}</span>
                </div>
                <Skeleton className="h-8 w-2/3 bg-ed-surface-container" />
                <Skeleton className="h-4 w-1/3 bg-ed-surface-container-high" />
                <div className="pt-4 space-y-4">
                  <Skeleton className="h-5 w-1/2 bg-ed-surface-container" />
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full bg-ed-surface-container-high" />
                  ))}
                  <Skeleton className="h-4 w-3/4 bg-ed-surface-container-high" />
                </div>
                <div className="pt-4 space-y-4">
                  <Skeleton className="h-5 w-2/5 bg-ed-surface-container" />
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full bg-ed-surface-container-high" />
                  ))}
                </div>
              </div>
            )}

            {/* Article result */}
            {article && (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-ed-primary/60 font-sans tracking-[0.15em] uppercase text-[0.6875rem] font-semibold">
                      WeChat
                    </span>
                    <h2 className="font-serif text-2xl text-ed-on-background mt-1">公众号文章预览</h2>
                  </div>
                  <button
                    onClick={handleGenerateArticle}
                    disabled={isGeneratingArticle}
                    className="flex items-center gap-2 text-ed-primary/70 hover:text-ed-primary text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Regenerate
                  </button>
                </div>
                <WeChatArticlePreview article={article} />
              </div>
            )}
          </section>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-ed-outline-variant/10 py-8 mt-16">
        <div className="max-w-3xl mx-auto px-6 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-serif text-sm text-ed-primary/60 italic">CopyFlow</span>
          <p className="text-ed-outline-variant text-xs">&copy; 2024 CopyFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
