/**
 * services/freepikService.ts
 *
 * Freepik Mystic AI image generation service.
 *
 * Flow:
 *  1. generateImagePrompt()  — uses Groq to craft a visual prompt from topic + content
 *  2. createImageTask()      — POST to Freepik Mystic, returns task_id
 *  3. pollImageTask()        — GET until COMPLETED, returns image URL
 *  4. generateBlogImage()    — orchestrates 1–3, returns { url, promptUsed }
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ImageMode = 'featured' | 'infographic' | 'custom';

export interface ImageResult {
  url: string;
  promptUsed: string;
}

// ─── Prompt generator ─────────────────────────────────────────────────────────

function extractText(html: string, maxChars = 2000): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/**
 * Uses Groq to generate a focused, visual image prompt from topic + article content.
 * Falls back to a generic prompt on any error.
 */
export async function generateImagePrompt(
  topic: string,
  articleHtml: string,
): Promise<string> {
  const text = extractText(articleHtml);
  const context = topic ? `Topic: ${topic}\n\n${text}` : text;
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
            content: `Create an image prompt for a blog hero image based on this article:\n\n${context}`,
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

export async function createImageTask(prompt: string): Promise<string> {
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
 * @param topic          Article topic / title
 * @param articleHtml    Full article HTML content
 * @param mode           'featured' | 'infographic' | 'custom'
 * @param customPrompt   Used only when mode === 'custom'
 * @param onProgress     Callback with attempt number (1–30)
 */
export async function generateBlogImage(
  topic: string,
  articleHtml: string,
  mode: ImageMode,
  customPrompt?: string,
  onProgress?: (attempt: number) => void,
): Promise<ImageResult> {
  let finalPrompt: string;

  if (mode === 'custom' && customPrompt?.trim()) {
    finalPrompt = `${customPrompt.trim()}, high quality, professional, blog image, widescreen 16:9, no text`;
  } else if (mode === 'infographic') {
    const base = await generateImagePrompt(topic, articleHtml);
    finalPrompt = `${base}, flat design infographic style, clean vector illustration, colorful icons, white background, professional business design, no photography, no realistic elements`;
  } else {
    // featured
    finalPrompt = await generateImagePrompt(topic, articleHtml);
  }

  const taskId = await createImageTask(finalPrompt);
  const url = await pollImageTask(taskId, onProgress);

  return { url, promptUsed: finalPrompt };
}
