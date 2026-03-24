import { GoogleGenAI } from '@google/genai';
import { getEnvConfig } from '@/lib/config/env';

interface GenerateImageOptions {
  aspectRatio?: string;
}

export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<string> {
  const config = getEnvConfig();

  // 有独立的图片服务地址时，走第三方 API
  if (config.imageBaseUrl) {
    if (config.imageApiFormat === 'openai-compat') {
      return generateViaOpenAICompat(config, prompt, options);
    }
    return generateViaGeminiNativeProxy(config, prompt, options);
  }

  // 默认走 Google Gemini 原生 SDK
  return generateViaGeminiSDK(config, prompt, options);
}

/**
 * Google Gemini 原生 SDK（默认，直连 Google）
 */
async function generateViaGeminiSDK(
  config: ReturnType<typeof getEnvConfig>,
  prompt: string,
  options: GenerateImageOptions
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  const response = await ai.models.generateContent({
    model: config.imageModel,
    contents: prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: options.aspectRatio ?? '3:4',
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }

  throw new Error('Image generation returned no image data');
}

/**
 * Gemini 原生格式代理（第三方服务，如 newapi）
 * POST {baseUrl}/v1beta/models/{model}:generateContent
 */
async function generateViaGeminiNativeProxy(
  config: ReturnType<typeof getEnvConfig>,
  prompt: string,
  options: GenerateImageOptions
): Promise<string> {
  const url = `${config.imageBaseUrl}/v1beta/models/${config.imageModel}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.imageApiKey}`,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: options.aspectRatio ?? '3:4',
          imageSize: '4K',
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }

  throw new Error('Image generation returned no image data');
}

/**
 * OpenAI 兼容格式（/openai/images/generations 或 /v1/images/generations）
 */
async function generateViaOpenAICompat(
  config: ReturnType<typeof getEnvConfig>,
  prompt: string,
  options: GenerateImageOptions
): Promise<string> {
  const url = `${config.imageBaseUrl}/v1/images/generations`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.imageApiKey}`,
    },
    body: JSON.stringify({
      model: config.imageModel,
      prompt: prompt,
      response_format: 'b64_json',
      n: 1,
      extra_body: {
        aspect_ratio: options.aspectRatio ?? '3:4',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (data.data?.[0]?.b64_json) {
    return data.data[0].b64_json;
  }

  throw new Error('Image generation returned no image data');
}
