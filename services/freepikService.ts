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

export async function pollImageTask(
  taskId: string,
  onProgress?: (attempt: number) => void,
): Promise<string> {
  const maxAttempts = 30;
  const intervalMs = 4000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    onProgress?.(i + 1);

    try {
      const response = await fetch(`/api/freepik/v1/ai/mystic/${taskId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      console.log('[Freepik] Poll response:', JSON.stringify(data, null, 2));

      const status = data?.data?.status;
      console.log(`[Freepik] Attempt ${i + 1} status: ${status}`);

      if (status === 'COMPLETED') {
        const generated = data?.data?.generated;

        if (generated?.[0]?.url) return generated[0].url;
        if (generated?.[0]?.base64) return `data:image/jpeg;base64,${generated[0].base64}`;
        if (data?.data?.url) return data.data.url;
        if (data?.data?.image) return data.data.image;

        console.error('[Freepik] COMPLETED but no URL found. Full response:', data);
        throw new Error('Image completed but no URL found in response');
      }

      if (status === 'FAILED') {
        console.error('[Freepik] Task failed:', data);
        throw new Error(data?.data?.error || 'Freepik image generation failed');
      }

      console.log(`[Freepik] Still processing... attempt ${i + 1}/${maxAttempts}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('no URL') || msg.includes('failed')) throw err;
      console.warn(`[Freepik] Poll attempt ${i + 1} error:`, msg);
    }
  }

  throw new Error('Image generation timed out after 2 minutes');
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

  // Delegate polling to pollImageTask; map attempt count to 15→90% progress
  const url = await pollImageTask(taskId, (attempt) => {
    onProgress?.(Math.min(90, 15 + attempt * 2.5));
  });

  onProgress?.(100);
  return url;
}
