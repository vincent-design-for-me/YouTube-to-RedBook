export function getEnvConfig() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required. Please set it in .env.local');
  }

  // 文本生成配置
  const llmBaseUrl = process.env.LLM_BASE_URL || '';
  const llmApiKey = process.env.LLM_API_KEY || geminiApiKey;
  const llmModel = process.env.LLM_MODEL || 'gemini-3.1-pro-preview';

  // 图片生成配置（独立于文本生成，可单独指向第三方服务）
  const imageBaseUrl = process.env.IMAGE_BASE_URL || '';
  const imageApiKey = process.env.IMAGE_API_KEY || geminiApiKey;
  const imageModel = process.env.IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
  // 图片生成 API 格式: 'gemini-native' | 'openai-compat' | 'wuai'
  const imageApiFormat = (process.env.IMAGE_API_FORMAT || 'gemini-native') as 'gemini-native' | 'openai-compat' | 'wuai';

  return {
    geminiApiKey,
    llmBaseUrl,
    llmApiKey,
    llmModel,
    imageBaseUrl,
    imageApiKey,
    imageModel,
    imageApiFormat,
  };
}
