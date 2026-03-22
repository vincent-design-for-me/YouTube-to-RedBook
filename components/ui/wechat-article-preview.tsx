'use client';

import { useState } from 'react';
import type { WeChatArticle } from '@/lib/types/generation';

interface ArticlePreviewProps {
  article: WeChatArticle;
}

export function WeChatArticlePreview({ article }: ArticlePreviewProps) {
  const [copied, setCopied] = useState(false);

  const copyArticle = async () => {
    const parts: string[] = [];
    parts.push(article.title);
    if (article.subtitle) parts.push(article.subtitle);
    parts.push('');

    for (const section of article.sections) {
      parts.push(`## ${section.heading}`);
      parts.push('');
      for (const p of section.paragraphs) {
        parts.push(p);
        parts.push('');
      }
    }

    parts.push('---');
    parts.push(article.conclusion);

    await navigator.clipboard.writeText(parts.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-ed-primary/60 font-sans tracking-[0.15em] uppercase text-[0.6875rem] font-semibold">
            WeChat Article
          </span>
          <h2 className="font-serif text-2xl text-ed-on-background mt-1">公众号文章预览</h2>
        </div>
        <button
          onClick={copyArticle}
          className="flex items-center gap-2 bg-ed-surface-container-lowest text-ed-on-surface text-sm font-medium px-4 py-2 rounded-xl border border-ed-outline-variant/15 hover:bg-ed-surface-container transition-colors"
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
              <span>Copy Article</span>
            </>
          )}
        </button>
      </div>

      {/* Article Body — WeChat reading style */}
      <article className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl p-8 md:p-12 space-y-8">
        {/* Title Block */}
        <header className="text-center space-y-3 pb-6 border-b border-ed-outline-variant/10">
          <h1 className="font-serif text-2xl md:text-3xl text-ed-on-background leading-snug font-semibold">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="text-ed-on-surface-variant text-sm md:text-base italic">
              {article.subtitle}
            </p>
          )}
        </header>

        {/* Sections */}
        {article.sections.map((section, sIdx) => (
          <section key={sIdx} className="space-y-4">
            <h2 className="font-serif text-lg md:text-xl text-ed-on-background font-semibold border-l-3 border-ed-primary/40 pl-4">
              {section.heading}
            </h2>
            {section.paragraphs.map((p, pIdx) => (
              <p
                key={pIdx}
                className="text-ed-on-surface text-[0.9375rem] leading-[1.9] font-light"
              >
                {p}
              </p>
            ))}
          </section>
        ))}

        {/* Conclusion */}
        {article.conclusion && (
          <footer className="pt-6 border-t border-ed-outline-variant/10">
            <p className="text-ed-on-surface-variant text-base leading-relaxed italic text-center font-serif">
              {article.conclusion}
            </p>
          </footer>
        )}
      </article>
    </div>
  );
}
