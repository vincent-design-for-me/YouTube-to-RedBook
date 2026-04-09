import type { TranscriptSnippet } from '@/lib/types/transcript';

const MAX_SENTENCE_DURATION = 24; // seconds
const MAX_WORDS = 80;
const MAX_CHARS = 500;

interface MergedSentence {
  text: string;
  segments: TranscriptSnippet[];
}

// Matches any sentence-ending punctuation (optionally followed by closing quote)
const SENT_PUNCT_RE = /[.!?。！？‼⁇⁈]["']?/;
const SENT_END_RE = /[.!?。！？‼⁇⁈]["']?\s*$/;
const ABBREV_RE = /\b(?:Dr|Mr|Mrs|Ms|Prof|vs|etc|Inc|Ltd|St)\.\s*["']?\s*$/i;

/**
 * Returns true if `text` ends with a genuine sentence-ending punctuation mark.
 * Excludes abbreviations (Dr., Mr., etc.).
 */
function endsWithSentence(text: string): boolean {
  if (!SENT_END_RE.test(text.trimEnd())) return false;
  if (ABBREV_RE.test(text)) return false;
  return true;
}

/**
 * Returns the char index immediately after the first sentence-ending punctuation
 * if it appears within the first 2 words of `text`. Otherwise returns -1.
 *
 * Used to detect orphaned punctuation at the start of a segment that belongs
 * to the previous sentence (e.g. ". And then we..." → period belongs to prev).
 */
function findEarlyPunctuation(text: string): number {
  const tokens = text.split(/(\s+)/);
  let pos = 0;
  let wordCount = 0;

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      pos += token.length;
      continue;
    }
    const m = SENT_PUNCT_RE.exec(token);
    if (m) {
      return pos + m.index + m[0].length;
    }
    wordCount++;
    pos += token.length;
    if (wordCount >= 2) break;
  }
  return -1;
}

/**
 * Returns the char index immediately after the last sentence-ending punctuation
 * if 1–2 words trail after it (but it's not at the very end of the string).
 * Returns -1 otherwise.
 *
 * Used to detect mid-segment sentence boundaries like "thank you. Welcome",
 * where "Welcome" should carry over to the next sentence.
 */
function findLatePunctuation(text: string): number {
  const matches = [...text.matchAll(/[.!?。！？‼⁇⁈]["']?/g)];
  if (matches.length === 0) return -1;

  const last = matches[matches.length - 1];
  const afterPos = last.index! + last[0].length;
  const trailing = text.slice(afterPos).trim();

  if (!trailing) return -1; // ends with punctuation — handled by endsWithSentence

  const trailingWords = trailing.split(/\s+/).filter(Boolean);
  if (trailingWords.length >= 1 && trailingWords.length <= 2) {
    return afterPos;
  }
  return -1;
}

function buildSentenceText(parts: string[]): string {
  return parts
    .join(' ')
    .replace(/\s+([.!?。！？‼⁇⁈]["']?)/g, '$1') // fix stray spaces before punctuation
    .trim();
}

function doFlush(
  merged: MergedSentence[],
  currentSentence: string[],
  currentSegments: TranscriptSnippet[],
): void {
  if (currentSentence.length === 0) return;
  merged.push({
    text: buildSentenceText(currentSentence),
    segments: [...currentSegments],
  });
}

/**
 * Splits a sentence that exceeds any of the 3 hard limits into smaller pieces,
 * cutting at segment boundaries regardless of punctuation.
 */
function splitLongSentence(sentence: MergedSentence): MergedSentence[] {
  const totalDuration = sentence.segments.reduce((s, seg) => s + seg.duration, 0);
  const wordCount = sentence.text.split(/\s+/).filter(Boolean).length;

  if (
    totalDuration <= MAX_SENTENCE_DURATION &&
    wordCount <= MAX_WORDS &&
    sentence.text.length <= MAX_CHARS
  ) {
    return [sentence];
  }

  const result: MergedSentence[] = [];
  let current: MergedSentence = { text: '', segments: [] };

  for (const seg of sentence.segments) {
    const testText = current.text ? `${current.text} ${seg.text}` : seg.text.trim();
    const testDuration = current.segments.reduce((s, s2) => s + s2.duration, 0) + seg.duration;
    const testWords = testText.split(/\s+/).filter(Boolean).length;

    if (
      current.segments.length > 0 &&
      (testDuration > MAX_SENTENCE_DURATION ||
        testWords > MAX_WORDS ||
        testText.length > MAX_CHARS)
    ) {
      result.push(current);
      current = { text: seg.text.trim(), segments: [seg] };
    } else {
      current = { text: testText.trim(), segments: [...current.segments, seg] };
    }
  }

  if (current.segments.length > 0) result.push(current);

  return result.length > 0 ? result : [sentence];
}

/**
 * Merges raw YouTube caption fragments (which are split word-by-word or
 * phrase-by-phrase) into complete sentences using punctuation heuristics.
 *
 * Strategy (per segment, in order):
 *   A. Prepend any carryover text from the previous segment
 *   B. If sentence-ending punctuation appears in the first 2 words,
 *      flush previous sentence up to that point, continue with remainder
 *   C. If sentence-ending punctuation appears with 1–2 words trailing after it,
 *      flush up to punctuation, carry trailing words to next segment
 *   D. If text ends with sentence-ending punctuation, flush immediately
 *   (else) Accumulate into current sentence buffer
 *
 * After the loop, a safety pass splits any sentence exceeding:
 *   - 24 seconds, 80 words, or 500 characters
 */
export function mergeTranscriptSegmentsIntoSentences(
  raw: TranscriptSnippet[],
): TranscriptSnippet[] {
  const merged: MergedSentence[] = [];
  let currentSentence: string[] = [];
  let currentSegments: TranscriptSnippet[] = [];
  let carryoverText = '';

  for (const segment of raw) {
    // A: prepend carryover from previous iteration
    let text = segment.text.trim();
    if (carryoverText) {
      text = `${carryoverText} ${text}`;
      carryoverText = '';
    }

    // B: early punctuation — belongs to the sentence already being built
    const earlyPos = findEarlyPunctuation(text);
    if (earlyPos > 0 && currentSentence.length > 0) {
      const beforePunct = text.slice(0, earlyPos).trim();
      if (beforePunct) currentSentence.push(beforePunct);
      currentSegments.push(segment);
      doFlush(merged, currentSentence, currentSegments);
      currentSentence = [];
      currentSegments = [];
      text = text.slice(earlyPos).trim();
      if (!text) continue;
    }

    // C: late punctuation — sentence ends mid-segment, carry remainder forward
    const latePos = findLatePunctuation(text);
    if (latePos > 0) {
      const beforePunct = text.slice(0, latePos).trim();
      const afterPunct = text.slice(latePos).trim();
      if (beforePunct) currentSentence.push(beforePunct);
      currentSegments.push(segment);
      doFlush(merged, currentSentence, currentSegments);
      currentSentence = [];
      currentSegments = [];
      carryoverText = afterPunct;
      continue;
    }

    // D: segment ends with a genuine sentence-ending punctuation
    if (endsWithSentence(text)) {
      currentSentence.push(text);
      currentSegments.push(segment);
      doFlush(merged, currentSentence, currentSegments);
      currentSentence = [];
      currentSegments = [];
      continue;
    }

    // No boundary found — accumulate
    currentSentence.push(text);
    currentSegments.push(segment);
  }

  // Step 2: flush anything remaining in the buffer
  if (currentSentence.length > 0) {
    doFlush(merged, currentSentence, currentSegments);
  }
  if (carryoverText) {
    merged.push({ text: carryoverText.trim(), segments: [] });
  }

  // Step 3: safety net — split sentences exceeding hard limits
  return merged
    .flatMap(splitLongSentence)
    .filter((s) => s.text.length > 0)
    .map((sentence) => ({
      text: sentence.text,
      start: sentence.segments[0]?.start ?? 0,
      duration: sentence.segments.reduce((sum, s) => sum + s.duration, 0),
    }));
}
