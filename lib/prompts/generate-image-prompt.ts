import type { KeyPoint } from '@/lib/types/generation';

// ============================================================
// 图片 Prompt 配置
// 每个变量独立控制一个维度，按需修改，互不影响
// ============================================================

/**
 * 角色设定
 * 告诉模型它是谁、在做什么任务
 * 改这里 → 改变模型对自身任务的理解
 */
const ROLE = `You are generating a clean, modern Chinese informational poster based on provided key ideas. You are creating original standalone content — never mention or attribute any external source.`;

/**
 * 语言设定
 * 控制海报上所有文字的语言
 * 改这里 → 换语言，例如改成 "All visible text must be in English"
 */
const LANGUAGE = `All visible text must be in Simplified Chinese.`;

/**
 * 海报定位
 * 告诉模型这张图的目的是什么
 * 改这里 → 换海报类型，例如改成"产品发布公告"、"学习笔记"、"营销横幅"
 */
const POSTER_PURPOSE = `Create a highly structured "Key insight poster" that explains the key idea in a clear and visually organized way.`;

/**
 * 内容结构
 * 控制海报里有哪些信息区块、每个区块放什么内容
 * 改这里 → 增减信息层级，例如去掉"关键结论"、加入"二维码区域"
 */
const INFORMATION_STRUCTURE = `
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
`.trim();

/**
 * 视觉风格
 * 控制整体美学：是极简还是丰富、是科技感还是温暖、配色倾向
 * 改这里 → 换风格，例如改成深色模式、插画风、日系扁平风
 *
 * 常用替换示例：
 * - 深色科技风："Dark background, neon accent colors, cyberpunk aesthetic"
 * - 温暖插画风："Warm pastel colors, hand-drawn illustration style, friendly and approachable"
 * - 日系简约风："Japanese minimalism, lots of white space, subtle ink textures"
 */
const VISUAL_STYLE = `
STRICT VISUAL SPEC — every poster in this series MUST follow these exact rules:

BACKGROUND: Solid white (#FFFFFF) or very light warm gray (#F9F7F4), NO textures, NO patterns, NO illustrations in background
COLOR PALETTE (use ONLY these):
- Headlines: Dark brown (#8B2500)
- Section titles: Same dark brown (#8B2500)
- Body text: Dark charcoal (#333333)
- Accent/highlight: Warm orange (#E8762B)
- Background: White or off-white only

TYPOGRAPHY:
- Headline: Bold, large Chinese text, top-left aligned
- Section titles: Bold, medium size, left-aligned with orange accent
- Body: Regular weight, dark charcoal, left-aligned bullet points
- NO decorative fonts, NO handwritten fonts

LAYOUT:
- Clean vertical single-column layout
- Left-aligned text throughout
- Generous whitespace between sections
- NO icons, NO illustrations, NO images, NO decorative shapes
- NO sidebar text, NO vertical text on the right side
- Pure text-based infographic only

STYLE: Minimalist editorial. Think Apple keynote slide meets Chinese reading app.
NO colorful gradients, NO 3D elements, NO cartoon icons, NO stock imagery.
`.trim();

/**
 * 构图方式
 * 控制元素的排列方式：竖版还是横版、文字在左还是居中、装饰在哪里
 * 改这里 → 换排版，例如改成横版、文字居中、图片在上
 *
 * 注意：如果改成横版，记得同步修改 lib/config/image.ts 里的 ratio
 */
const COMPOSITION = `
Vertical poster (3:4 aspect ratio)
ALL text left-aligned, NO centered text
NO right-side decorations or sidebars
Sections stacked vertically with clear dividers (whitespace only, no lines)
Headline at the very top, taking up roughly 20% of poster height
3-5 content sections below, each with a bold title and 1-2 bullet points
Bottom section: "关键结论" with key takeaway
NO footer, NO attribution, NO source line at the bottom
`.trim();

/**
 * 设计目标
 * 描述这张图要达到的用户体验目标
 * 改这里 → 调整侧重点，例如"更强调情感共鸣"、"更强调行动引导"
 */
const DESIGN_GOALS = `
The poster must feel like a structured visual summary of a technical video.
Information should be scannable in under 10 seconds.
Hierarchy must be obvious:
headline > section titles > bullet points.
`.trim();

/**
 * 输出要求
 * 告诉模型最终输出物的质量和格式要求
 * 改这里 → 调整输出规格，例如加入"模拟手机截图边框"、"添加品牌 Logo 占位"
 */
const OUTPUT_SPEC = `
Generate a polished Chinese tech poster that communicates the insights clearly and visually.
High resolution
Professional infographic style
Aspect ratio 3:4

CRITICAL: Do NOT include any footer, source attribution, credit line, watermark, or origin reference anywhere on the poster.
No text like "基于视频整理", "来源：XXX", "视频摘要", "recorded from video", or any similar attribution.
The poster must look like an original standalone infographic with NO reference to any video or content creator.
`.trim();

// ============================================================
// Prompt 组装（一般不需要改这里）
// ============================================================

export function buildImagePrompt(keyPoint: KeyPoint, transcriptText: string, stylePrompt?: string): string {
  const keyPointBlock = [
    `Title: ${keyPoint.title}`,
    `Summary: ${keyPoint.summary}`,
    `Relevant quotes: ${keyPoint.relevantQuotes.join(' | ')}`,
  ].join('\n');

  return `${ROLE}

INPUT
Below is background context:

${transcriptText}

And here is the specific key insight to visualize:

${keyPointBlock}

Your task is to transform this insight into a visually clear Chinese poster with strong information hierarchy. This is original content — do NOT add any source attribution, footer, or credit line.

LANGUAGE
${LANGUAGE}

POSTER PURPOSE
${POSTER_PURPOSE}

INFORMATION STRUCTURE

${INFORMATION_STRUCTURE}

VISUAL STYLE

${stylePrompt ? `IMPORTANT — Follow this reference style closely:\n${stylePrompt}\n\nFallback defaults (use only if the reference style does not specify):\n${VISUAL_STYLE}` : VISUAL_STYLE}

COMPOSITION

${COMPOSITION}

DESIGN GOALS

${DESIGN_GOALS}

OUTPUT
${OUTPUT_SPEC}`;
}
