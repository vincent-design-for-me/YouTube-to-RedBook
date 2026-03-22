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
