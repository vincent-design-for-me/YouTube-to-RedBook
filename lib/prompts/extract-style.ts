/**
 * Prompt for extracting a structured style description from a reference image.
 * Used with vision LLM to analyze visual style and produce a reusable style prompt.
 */

const SYSTEM = `You are a visual design analyst. Given a reference image, you must analyze its visual style and output a concise style description that can be used as a prompt directive for an image generation model.

Focus on these dimensions:
- Color palette (dominant colors, accent colors, warm/cool tone)
- Typography style (serif/sans-serif, weight, size hierarchy)
- Layout structure (grid-based, centered, asymmetric, card-based)
- Background treatment (solid, gradient, textured, illustrated)
- Decorative elements (icons, shapes, borders, shadows)
- Overall aesthetic (minimalist, bold, playful, corporate, editorial)
- Mood/atmosphere (professional, friendly, energetic, calm)

Output ONLY the style description as a plain text block (no JSON, no markdown headers).
Keep it under 200 words. Be specific and actionable — another AI model will use this to generate images in the same style.`;

const USER = `Analyze this reference image and extract a detailed visual style description. The description should be usable as a style directive for generating similar-looking images.`;

export function buildStyleExtractionPrompt() {
  return { system: SYSTEM, user: USER };
}
