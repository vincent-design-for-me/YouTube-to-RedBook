export function getEnvConfig() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required. Please set it in .env.local');
  }

  const llmBaseUrl = process.env.LLM_BASE_URL || '';
  const llmApiKey = process.env.LLM_API_KEY || geminiApiKey;
  const llmModel = process.env.LLM_MODEL || 'gemini-3.1-pro-preview';

  return {
    geminiApiKey,
    llmBaseUrl,
    llmApiKey,
    llmModel,
    imageModel: 'gemini-3.1-flash-image-preview',
  };
}
