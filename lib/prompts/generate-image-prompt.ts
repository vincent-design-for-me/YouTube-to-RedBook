// 🔧 Iteration 位置: 调整图片风格、构图、色彩

import type { KeyPoint } from '@/lib/types/generation';

export function buildImagePrompt(keyPoint: KeyPoint, transcriptText: string): string {
  const keyPointBlock = [
    `Title: ${keyPoint.title}`,
    `Summary: ${keyPoint.summary}`,
    `Relevant quotes: ${keyPoint.relevantQuotes.join(' | ')}`,
  ].join('\n');

  return `You are generating a clean, modern Chinese informational poster based on the key ideas extracted from a technology YouTube video.

INPUT
Below is the full transcript of the video for context:

${transcriptText}

And here is the specific key insight to visualize:

${keyPointBlock}

Your task is to transform this insight into a visually clear Chinese poster with strong information hierarchy.

LANGUAGE
All visible text must be in Simplified Chinese.

POSTER PURPOSE
Create a highly structured "Key insight poster" that explains the key idea in a clear and visually organized way.

INFORMATION STRUCTURE

1. HERO TITLE
Create a large bold Chinese headline summarizing the core idea.

2. CONTEXT LINE
Below the headline add a short subtitle explaining what the topic is about.

3. CORE IDEA SECTIONS
Break the key insight into 3–5 short sections.
Each section should contain:
• a short section title
• 1–2 concise bullet points

The sections must be derived from the video content, not predefined categories.

4. KEY TAKEAWAYS
Add a summary of the most important conclusions or practical insights.

5. OPTIONAL SECTION (only if relevant)
If the content discusses tools, workflow, architecture, or steps, visualize them as:
• workflow steps
• tool stack
• process stages
• system architecture

VISUAL STYLE

Clean modern tech poster
SaaS / AI product announcement style
Minimalist
Highly structured layout
Clear spacing
Grid-based design
Flat icons for sections
Soft geometric background shapes
Subtle gradient accents
White or light neutral background
Orange or warm accent color
Professional UI marketing aesthetic

COMPOSITION

Vertical poster
Text aligned mostly on the left
Decorative shapes or icons on the right
Clear section blocks stacked vertically
Consistent spacing between sections
Very readable Chinese typography

DESIGN GOALS

The poster must feel like a structured visual summary of a technical video.
Information should be scannable in under 10 seconds.
Hierarchy must be obvious:
headline > section titles > bullet points.

OUTPUT
Generate a polished Chinese tech poster that communicates the video's insights clearly and visually.
High resolution
Professional infographic style
Aspect ratio 3:4`;
}
