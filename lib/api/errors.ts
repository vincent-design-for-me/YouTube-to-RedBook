/**
 * 字幕错误类型枚举
 */
export enum TranscriptErrorType {
  /** 无效的 URL 或视频 ID */
  INVALID_URL = 'INVALID_URL',
  /** 找不到字幕 */
  NO_TRANSCRIPT = 'NO_TRANSCRIPT',
  /** 字幕已禁用 */
  DISABLED = 'DISABLED',
  /** 视频不可用 */
  UNAVAILABLE = 'UNAVAILABLE',
  /** 网络错误 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 未知错误 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 自定义字幕错误类
 */
export class TranscriptError extends Error {
  constructor(
    public type: TranscriptErrorType,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TranscriptError';
  }
}
