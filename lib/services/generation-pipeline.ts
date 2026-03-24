import { generateText } from '@/lib/llm/text-provider';
import { generateImage } from '@/lib/llm/image-provider';
import { buildKeypointExtractionPrompt } from '@/lib/prompts/extract-keypoints';
import { buildCopyGenerationPrompt } from '@/lib/prompts/generate-copy';
import { buildWeChatArticlePrompt } from '@/lib/prompts/generate-wechat-article';
import { buildImagePrompt } from '@/lib/prompts/generate-image-prompt';
import type {
  PipelineProgress,
  KeyPoint,
  XiaohongshuCopy,
  WeChatArticle,
  GeneratedImage,
} from '@/lib/types/generation';
import type { TranscriptResponse } from '@/lib/types/transcript';

function parseJsonResponse<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return JSON.parse(cleaned);
}

export interface CopyResult {
  videoId: string;
  keyPoints: KeyPoint[];
  copy: XiaohongshuCopy;
}

/**
 * Phase 1: Extract key points + generate copy (no images)
 */
export async function runCopyPipeline(
  transcript: TranscriptResponse,
  onProgress: (progress: PipelineProgress) => void
): Promise<CopyResult> {
  const videoId = transcript.video_id;
  const fullText = transcript.snippets.map((s) => s.text).join(' ');

  // 1. Extract key points
  onProgress({
    stage: 'extracting_keypoints',
    progress: 15,
    message: '正在分析视频内容，提取关键知识点...',
  });

  const keypointPrompt = buildKeypointExtractionPrompt(fullText);
  const keypointResponse = await generateText(keypointPrompt.system, keypointPrompt.user);
  const keyPoints: KeyPoint[] = parseJsonResponse(keypointResponse);

  onProgress({
    stage: 'extracting_keypoints',
    progress: 40,
    message: `已提取 ${keyPoints.length} 个关键知识点`,
  });

  // 2. Generate copy
  onProgress({
    stage: 'generating_copy',
    progress: 50,
    message: '正在生成小红书文案...',
  });

  const copyPrompt = buildCopyGenerationPrompt(keyPoints);
  const copyResponse = await generateText(copyPrompt.system, copyPrompt.user);
  const copy: XiaohongshuCopy = parseJsonResponse(copyResponse);

  const result: CopyResult = { videoId, keyPoints, copy };

  onProgress({
    stage: 'complete',
    progress: 100,
    message: '文案生成完成！请查看效果，满意后可生成配图。',
    data: result,
  });

  return result;
}

export interface ArticleResult {
  videoId: string;
  keyPoints: KeyPoint[];
  article: WeChatArticle;
}

/**
 * WeChat Article Pipeline: Extract key points + generate long-form article
 */
export async function runArticlePipeline(
  transcript: TranscriptResponse,
  onProgress: (progress: PipelineProgress) => void
): Promise<ArticleResult> {
  const videoId = transcript.video_id;
  const fullText = transcript.snippets.map((s) => s.text).join(' ');

  // 1. Extract key points
  onProgress({
    stage: 'extracting_keypoints',
    progress: 15,
    message: '正在分析视频内容，提取关键知识点...',
  });

  const keypointPrompt = buildKeypointExtractionPrompt(fullText);
  const keypointResponse = await generateText(keypointPrompt.system, keypointPrompt.user);
  const keyPoints: KeyPoint[] = parseJsonResponse(keypointResponse);

  onProgress({
    stage: 'extracting_keypoints',
    progress: 40,
    message: `已提取 ${keyPoints.length} 个关键知识点`,
  });

  // 2. Generate article
  onProgress({
    stage: 'generating_article',
    progress: 50,
    message: '正在撰写公众号文章...',
  });

  const articlePrompt = buildWeChatArticlePrompt(keyPoints, fullText);
  const articleResponse = await generateText(articlePrompt.system, articlePrompt.user);
  const article: WeChatArticle = parseJsonResponse(articleResponse);

  const result: ArticleResult = { videoId, keyPoints, article };

  onProgress({
    stage: 'complete',
    progress: 100,
    message: '公众号文章生成完成！',
    data: result,
  });

  return result;
}

/**
 * Phase 2: Generate images for key points
 */
export async function runImagePipeline(
  keyPoints: KeyPoint[],
  transcriptText: string,
  onProgress: (progress: PipelineProgress) => void
): Promise<GeneratedImage[]> {
  onProgress({
    stage: 'generating_images',
    progress: 5,
    message: `正在生成配图 [0/${keyPoints.length}]...`,
  });

  let completedCount = 0;
  const images: GeneratedImage[] = [];

  const imagePromises = keyPoints.map(async (kp) => {
    const prompt = buildImagePrompt(kp, transcriptText);
    try {
      const base64Data = await generateImage(prompt);
      const image: GeneratedImage = { keyPointId: kp.id, prompt, base64Data };
      images.push(image);
      completedCount++;

      // 每张图生成后立即推送给前端
      onProgress({
        stage: 'image_ready',
        progress: Math.round((completedCount / keyPoints.length) * 95),
        message: `正在生成配图 [${completedCount}/${keyPoints.length}]...`,
        image,
      });

      return image;
    } catch (error) {
      completedCount++;
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to generate image for keypoint ${kp.id}:`, errMsg);
      onProgress({
        stage: 'generating_images',
        progress: Math.round((completedCount / keyPoints.length) * 95),
        message: `配图 #${kp.id} 生成失败: ${errMsg.slice(0, 80)}`,
      });
      return null;
    }
  });

  await Promise.allSettled(imagePromises);

  onProgress({
    stage: 'complete',
    progress: 100,
    message: `配图生成完成！成功 ${images.length}/${keyPoints.length} 张`,
  });

  return images;
}
