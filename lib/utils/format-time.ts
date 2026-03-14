/**
 * 将秒数格式化为 MM:SS 格式
 * @param seconds - 秒数
 * @returns 格式化的时间字符串（如 "3:45"）
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
