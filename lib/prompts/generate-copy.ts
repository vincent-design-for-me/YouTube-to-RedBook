// 🔧 Iteration 位置: 调整文案风格、格式、语气

import type { KeyPoint } from '@/lib/types/generation';

export function buildCopyGenerationPrompt(keyPoints: KeyPoint[]) {
  const system = `你是一个资深小红书内容创作者，擅长将知识型内容转化为高互动的小红书图文笔记。

写作风格要求：
- 标题：带 emoji，制造好奇心，控制在 20 字以内
- 开头 hook：用提问或惊人事实开场，让读者想继续看
- 正文：每个段落短小精悍（3-4 行），多用 emoji 分隔
- 语气：像朋友分享发现，不要太正式，适当用口语化表达
- 结尾：引导互动（提问/投票/求分享）
- Hashtag：5-8 个相关标签，包含热门标签和垂直标签

必须以纯 JSON 格式输出，不要包含 markdown 代码块标记，格式如下：
{
  "title": "emoji + 标题",
  "hook": "开头 hook 文案",
  "sections": [
    {
      "keyPointId": 1,
      "heading": "段落小标题",
      "body": "段落正文"
    }
  ],
  "callToAction": "互动引导文案",
  "hashtags": ["标签1", "标签2"]
}`;

  const user = `请基于以下关键知识点，生成一篇小红书风格的图文笔记文案：

${JSON.stringify(keyPoints, null, 2)}`;

  return { system, user };
}
