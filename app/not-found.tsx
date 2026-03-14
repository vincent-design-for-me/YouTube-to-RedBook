export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="mb-4">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white">404</h1>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          页面未找到
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          抱歉，您访问的页面不存在
        </p>
        <a
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
