import { promises as fs } from 'fs';
import path from 'path';
import type { GenerationResult, GenerationRecord } from '@/lib/types/generation';

const DATA_DIR = path.join(process.cwd(), 'data');
const GENERATIONS_DIR = path.join(DATA_DIR, 'generations');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveGeneration(
  result: GenerationResult,
  videoUrl: string,
  config: GenerationRecord['config']
): Promise<string> {
  const id = crypto.randomUUID();
  const generationDir = path.join(IMAGES_DIR, id);

  await ensureDir(GENERATIONS_DIR);
  await ensureDir(generationDir);

  // Save images as PNG files
  const imageEntries: GenerationRecord['images'] = [];
  for (const image of result.images) {
    const filename = `keypoint-${image.keyPointId}.png`;
    const filePath = path.join(generationDir, filename);
    const buffer = Buffer.from(image.base64Data, 'base64');
    await fs.writeFile(filePath, buffer);
    imageEntries.push({
      keypoint_id: image.keyPointId,
      filename,
      prompt: image.prompt,
    });
  }

  // Save JSON record
  const record: GenerationRecord = {
    id,
    created_at: new Date().toISOString(),
    video_id: result.videoId,
    video_url: videoUrl,
    key_points: result.keyPoints,
    copy: result.copy,
    images: imageEntries,
    config,
  };

  const jsonPath = path.join(GENERATIONS_DIR, `${id}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(record, null, 2), 'utf-8');

  return id;
}

export async function loadGeneration(id: string): Promise<GenerationRecord | null> {
  try {
    const jsonPath = path.join(GENERATIONS_DIR, `${id}.json`);
    const content = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function listGenerations(): Promise<GenerationRecord[]> {
  try {
    await ensureDir(GENERATIONS_DIR);
    const files = await fs.readdir(GENERATIONS_DIR);
    const records: GenerationRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const content = await fs.readFile(
        path.join(GENERATIONS_DIR, file),
        'utf-8'
      );
      records.push(JSON.parse(content));
    }

    return records.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch {
    return [];
  }
}
