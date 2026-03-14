/**
 * 字幕加载骨架屏
 * 在获取字幕时显示的占位动画
 */
export function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-l-4 border-gray-300 pl-4 py-2">
          <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mt-1"></div>
        </div>
      ))}
    </div>
  );
}
