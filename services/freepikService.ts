/**
 * services/freepikService.ts
 *
 * Freepik Mystic AI image generation service.
 *
 * Flow:
 *  1. generateImagePrompt()  — uses Groq to craft an image prompt from article content
 *  2. generateBlogImage()    — POST task → poll → return image URL
 */

// ─── Prompt generator ─────────────────────────────────────────────────────────

/** Strip HTML tags and truncate for prompt use */
function extractText(html: string, maxChars = 2000): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/**
 * Uses Groq to generate a focused, visual image prompt from the article content.
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

// ─── Image generation ──────────────────────────────────────────────────────────

export type FreepikStyle =
  | 'photo-realism'
  | 'digital-art'
  | 'anime'
  | 'painting'
  | 'sketch'
  | 'watercolor'
  | '3d';

/**
 * Creates a Freepik Mystic task and polls until completion.
 * Returns the URL of the generated image.
 *
 * @param prompt     Image description
 * @param style      Freepik style preset
 * @param onProgress Callback with 0–100 progress values
 */
export async function generateBlogImage(
  prompt: string,
  style: FreepikStyle = 'photo-realism',
  onProgress?: (progress: number) => void,
): Promise<string> {
  onProgress?.(5);

  // Step 1 — create task
  const createRes = await fetch('/api/freepik/v1/ai/mystic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image: { size: 'square_1_1' },
      styling: { style },
      num_images: 1,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.message || `Freepik API error ${createRes.status}`);
  }

  const createData = await createRes.json();
  // Freepik returns { data: { _id: "...", status: "PENDING", ... } }
  const taskId: string = createData.data?._id ?? createData.data?.task_id ?? createData._id;
  if (!taskId) throw new Error('No task ID returned by Freepik');

  onProgress?.(15);

  // Step 2 — poll every 2 s, up to 60 s
  const MAX_POLLS = 30;
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    await new Promise(r => setTimeout(r, 2000));

    const pollRes = await fetch(`/api/freepik/v1/ai/mystic/${taskId}`);
    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status: string = pollData.data?.status ?? pollData.status ?? '';

    if (status === 'COMPLETED') {
      onProgress?.(100);
      const url: string =
        pollData.data?.generated?.[0]?.url ??
        pollData.data?.images?.[0]?.url ??
        pollData.generated?.[0]?.url;
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
