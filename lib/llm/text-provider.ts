import { GoogleGenAI } from '@google/genai';
import { getEnvConfig } from '@/lib/config/env';

interface GenerateTextOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options: GenerateTextOptions = {}
): Promise<string> {
  const config = getEnvConfig();

  if (config.llmBaseUrl) {
    return generateViaOpenAICompat(config, systemPrompt, userPrompt, options);
  }

  return generateViaGemini(config, systemPrompt, userPrompt, options);
}

async function generateViaGemini(
  config: ReturnType<typeof getEnvConfig>,
  systemPrompt: string,
  userPrompt: string,
  options: GenerateTextOptions
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: config.llmApiKey });

  const response = await ai.models.generateContent({
    model: config.llmModel,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: systemPrompt,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 4096,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned empty response');
  }
  return text;
}

async function generateViaOpenAICompat(
  config: ReturnType<typeof getEnvConfig>,
  systemPrompt: string,
  userPrompt: string,
  options: GenerateTextOptions
): Promise<string> {
  const url = `${config.llmBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.llmApiKey}`,
    },
    body: JSON.stringify({
      model: config.llmModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
