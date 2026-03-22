/**
 * YouTube 字幕片段
 */
export interface TranscriptSnippet {
  /** 开始时间（秒） */
  start: number;
  /** 持续时间（秒） */
  duration: number;
  /** 字幕文本 */
  text: string;
}

/**
 * 字幕 API 成功响应
 */
export interface TranscriptResponse {
  /** YouTube 视频 ID */
  video_id: string;
  /** 视频标题 */
  title: string;
  /** 视频缩略图 URL */
  thumbnail_url: string;
  /** 字幕片段列表 */
  snippets: TranscriptSnippet[];
}

/**
 * API 错误响应
 */
export interface ErrorResponse {
  /** 错误信息 */
  error: string;
}
