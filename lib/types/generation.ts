export interface KeyPoint {
  id: number;
  title: string;
  summary: string;
  relevantQuotes: string[];
}

export interface XiaohongshuCopy {
  title: string;
  hook: string;
  sections: { keyPointId: number; heading: string; body: string }[];
  callToAction: string;
  hashtags: string[];
}

export interface WeChatArticle {
  title: string;
  subtitle: string;
  sections: { heading: string; paragraphs: string[] }[];
  conclusion: string;
}

export interface GeneratedImage {
  keyPointId: number;
  prompt: string;
  base64Data: string;
}

export interface GenerationResult {
  videoId: string;
  keyPoints: KeyPoint[];
  copy: XiaohongshuCopy;
  images: GeneratedImage[];
}

export type PipelineStage =
  | 'extracting_keypoints'
  | 'generating_copy'
  | 'generating_article'
  | 'generating_images'
  | 'image_ready'
  | 'complete'
  | 'error';

export interface PipelineProgress {
  stage: PipelineStage;
  progress: number;
  message: string;
  data?: Partial<GenerationResult>;
  image?: GeneratedImage;
}

export interface GenerationRecord {
  id: string;
  created_at: string;
  video_id: string;
  video_url: string;
  key_points: KeyPoint[];
  copy: XiaohongshuCopy;
  images: {
    keypoint_id: number;
    filename: string;
    prompt: string;
  }[];
  config: {
    llm_model: string;
    image_model: string;
    prompt_version: string;
    image_aspect_ratio: string;
    image_size: string;
  };
}
