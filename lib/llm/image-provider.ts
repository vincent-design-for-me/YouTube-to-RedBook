import { GoogleGenAI } from '@google/genai';
import { getEnvConfig } from '@/lib/config/env';
import { IMAGE_DEFAULTS, type ImageOptions } from '@/lib/config/image';

/**
 * @param referenceImageBase64 - optional reference image for style guidance (Gemini SDK only)
 */
export async function generateImage(
  prompt: string,
  options: Partial<ImageOptions> = {},
  referenceImageBase64?: string
): Promise<string> {
  const config = getEnvConfig();
  const opts: ImageOptions = { ...IMAGE_DEFAULTS, ...options };

  if (config.imageBaseUrl) {
    if (config.imageApiFormat === 'wuai') {
      return generateViaWuai(config, prompt, opts);
    }
    if (config.imageApiFormat === 'openai-compat') {
      return generateViaOpenAICompat(config, prompt, opts);
    }
    return generateViaGeminiNativeProxy(config, prompt, opts);
  }

  return generateViaGeminiSDK(config, prompt, opts, referenceImageBase64);
}

/**
 * Google Gemini 原生 SDK（默认，直连 Google）
 */
async function generateViaGeminiSDK(
  config: ReturnType<typeof getEnvConfig>,
  prompt: string,
  options: ImageOptions,
  referenceImageBase64?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  // Build content parts: optional reference image + text prompt
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (referenceImageBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: referenceImageBase64 } });
    parts.push({ text: `Use the above image as a visual style reference. Generate a new image following the same aesthetic.\n\n${prompt}` });
  } else {
    parts.push({ text: prompt });
  }

  const response = await ai.models.generateContent({
    model: config.imageModel,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: options.ratio,
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
 */
async function generateViaGeminiNativeProxy(
  config: ReturnType<typeof getEnvConfig>,
  prompt: string,
  options: ImageOptions
): Promise<string> {
  const url = `${config.imageBaseUrl}/v1beta/models/${config.imageModel}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.imageApiKey}`,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: options.ratio,
          imageSize: options.resolution.toUpperCase(), // '1k' → '1K'
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
 * OpenAI 兼容格式（/v1/images/generations）
 */
async function generateViaOpenAICompat(
  config: ReturnType<typeof getEnvConfig>,
  prompt: string,
  options: ImageOptions
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
      prompt,
      response_format: 'b64_json',
      n: 1,
      extra_body: {
        aspect_ratio: options.ratio,
        image_size: options.resolution.toUpperCase(),
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

/**
 * wuaiapi 任务制接口
 * POST /api/tasks/generate → 轮询 POST /api/tasks/{id}/poll → 下载图片转 base64
 */
async function generateViaWuai(
  config: ReturnType<typeof getEnvConfig>,
  prompt: string,
  options: ImageOptions
): Promise<string> {
  const baseUrl = config.imageBaseUrl;
  const token = config.imageApiKey;

  if (!token) {
    throw new Error('IMAGE_API_KEY is required for wuai API');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. 提交任务
  const submitRes = await fetch(`${baseUrl}/api/tasks/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      ratio: options.ratio,
      resolution: options.resolution, // '1k' | '2k' | '4k'
    }),
  });

  const submitData = await submitRes.json();

  if (submitData.code !== 200) {
    throw new Error(`wuai submit failed: ${submitData.msg}`);
  }

  const taskId: number = submitData.data.id;

  // 2. 轮询直到完成（最多 40 次，每次等 3 秒，共 2 分钟）
  const MAX_POLLS = 40;
  const POLL_INTERVAL_MS = 3000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${baseUrl}/api/tasks/${taskId}/poll`, {
      method: 'POST',
      headers,
    });

    const pollData = await pollRes.json();

    if (pollData.code !== 200) {
      throw new Error(`wuai poll failed: ${pollData.msg}`);
    }

    const { status, result_images } = pollData.data;

    if (status === 'SUCCEEDED' && result_images?.length > 0) {
      // 3. 下载图片并转为 base64，保持下游不变
      const imgRes = await fetch(result_images[0]);
      if (!imgRes.ok) {
        throw new Error(`Failed to download wuai image: ${imgRes.status}`);
      }
      const arrayBuffer = await imgRes.arrayBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    }

    if (status === 'FAILED' || status === 'VIOLATION') {
      throw new Error(`wuai task ${status}`);
    }

    // PENDING / PROCESSING → 继续轮询
  }

  throw new Error('wuai task timed out after 2 minutes');
}
