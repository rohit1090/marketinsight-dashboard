/**
 * services/freepikService.ts
 *
 * Freepik Mystic AI image generation service.
 *
 * Flow:
 *  1. generateImagePrompt()  — uses Groq to craft an image prompt from article content
 *  2. createImageTask()      — POST to Freepik Mystic, returns task_id
 *  3. pollImageTask()        — GET /v1/ai/mystic/{task_id} until COMPLETED
 *  4. generateBlogImage()    — orchestrates 1–3, exposes progress callback
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FreepikStyle =
  | 'realistic'
  | 'digital_art'
  | 'minimalist'
  | 'cinematic'
  | 'infographic';

// ─── Prompt generator ─────────────────────────────────────────────────────────

function extractText(html: string, maxChars = 2000): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/**
 * Uses Groq to generate a focused, visual image prompt from article content.
 * Falls back to a generic prompt on any error.
 */
export async function generateImagePrompt(articleHtml: string): Promise<string> {
  const text = extractText(articleHtml);
  try {
    const res = await fetch('/api/ai/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You write concise, vivid image generation prompts for blog hero images. ' +
              'Focus on visual elements: setting, lighting, mood, colors. ' +
              'Never include text, logos, or readable words in the prompt. ' +
              'Avoid faces and specific people. Max 60 words. Return ONLY the prompt.',
          },
          {
            role: 'user',
            content: `Create an image prompt for a blog hero image based on this article:\n\n${text}`,
          },
        ],
        max_tokens: 120,
        temperature: 0.8,
      }),
    });
    const data = await res.json();
    const prompt = data.choices?.[0]?.message?.content?.trim();
    return prompt || 'A professional, modern blog hero image with clean composition and vibrant colors';
  } catch {
    return 'A professional, modern blog hero image with clean composition and vibrant colors';
  }
}

// ─── Task creation ─────────────────────────────────────────────────────────────

const STYLE_MAP: Record<string, string> = {
  digital_art: 'digital-art',
  minimalist: 'minimalist',
  cinematic: 'cinematic',
  infographic: 'infographic',
};

export async function createImageTask(
  prompt: string,
  style?: FreepikStyle,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    prompt,
    resolution: '2k',
    aspect_ratio: 'widescreen_16_9',
    model: 'realism',
    creative_detailing: 50,
    engine: 'automatic',
    fixed_generation: false,
    filter_nsfw: true,
  };

  if (style && style !== 'realistic') {
    body.styling = {
      styles: [
        {
          name: STYLE_MAP[style] || style,
          strength: 100,
        },
      ],
    };
  }

  const response = await fetch('/api/freepik/v1/ai/mystic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || `Freepik API error ${response.status}`);
  }

  const data = await response.json();

  if (!data.data?.task_id) {
    throw new Error('No task_id returned from Freepik');
  }

  console.log('[Freepik] Task created:', data.data.task_id);
  return data.data.task_id as string;
}

// ─── Polling ───────────────────────────────────────────────────────────────────

export async function pollImageTask(taskId: string): Promise<string> {
  const MAX_POLLS = 30;

  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    await new Promise(r => setTimeout(r, 2000));

    const pollRes = await fetch(`/api/freepik/v1/ai/mystic/${taskId}`);
    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status: string = pollData.data?.status ?? '';

    if (status === 'COMPLETED') {
      let url: string = pollData.data?.generated?.[0]?.url ?? '';

      // If generated array is empty, wait 2 s and retry once
      if (!url) {
        await new Promise(r => setTimeout(r, 2000));
        const retry = await fetch(`/api/freepik/v1/ai/mystic/${taskId}`);
        if (retry.ok) {
          const retryData = await retry.json();
          url = retryData.data?.generated?.[0]?.url ?? '';
        }
      }

      if (!url) throw new Error('No image URL in Freepik response');
      return url;
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error('Freepik image generation failed');
    }
  }

  throw new Error('Freepik image generation timed out after 60 s');
}

// ─── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Generates a blog hero image end-to-end.
 *
 * @param prompt      Image description
 * @param style       Freepik style preset (omit or 'realistic' for no style filter)
 * @param onProgress  Callback with 0–100 progress values
 */
export async function generateBlogImage(
  prompt: string,
  style?: FreepikStyle,
  onProgress?: (progress: number) => void,
): Promise<string> {
  onProgress?.(5);

  const taskId = await createImageTask(prompt, style);

  onProgress?.(15);

  const MAX_POLLS = 30;
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    await new Promise(r => setTimeout(r, 2000));

    const pollRes = await fetch(`/api/freepik/v1/ai/mystic/${taskId}`);
    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status: string = pollData.data?.status ?? '';

    if (status === 'COMPLETED') {
      onProgress?.(100);
      let url: string = pollData.data?.generated?.[0]?.url ?? '';

      // If generated array is empty on first COMPLETED response, retry once
      if (!url) {
        await new Promise(r => setTimeout(r, 2000));
        const retry = await fetch(`/api/freepik/v1/ai/mystic/${taskId}`);
        if (retry.ok) {
          const retryData = await retry.json();
          url = retryData.data?.generated?.[0]?.url ?? '';
        }
      }

      if (!url) throw new Error('No image URL in Freepik response');
      return url;
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error('Freepik image generation failed');
    }

    // Progress 15 → 90 over 30 attempts
    onProgress?.(Math.min(90, 15 + attempt * 2.5));
  }

  throw new Error('Freepik image generation timed out after 60 s');
}
