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

// ─── Groq helper ──────────────────────────────────────────────────────────────

/** Minimal Groq caller — returns the assistant message text. */
async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('/api/ai/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 200,
      temperature: 0.8,
    }),
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Groq');
  return text;
}

// ─── Banner text generator ────────────────────────────────────────────────────

/** Generates a short punchy headline for the image banner overlay. */
export async function generateBannerText(topic: string): Promise<string> {
  try {
    const result = await callGroq(
      `Generate a short punchy banner text for a blog featured image about this topic.

Rules:
- Maximum 8 words
- Bold, catchy, headline style
- No punctuation except !
- Like a magazine cover headline
- Examples:
  "Master CA in 4 Years Complete Guide"
  "Top 10 Gaming Laptops That Dominate 2026"
  "Best CA Coaching Your Success Starts Here"

Output ONLY the banner text. Nothing else.`,
      `Topic: ${topic}`,
    );
    return result.replace(/^["']|["']$/g, '').trim();
  } catch {
    return topic;
  }
}

// ─── Prompt generator ─────────────────────────────────────────────────────────

export async function generateImagePrompt(
  topic: string,
  articleContent?: string,
): Promise<string> {
  const cleanContent = articleContent
    ? articleContent.replace(/<[^>]*>/g, '').slice(0, 1000)
    : '';

  try {
    const result = await callGroq(
      `You are a world-class AI image prompt engineer specializing in Freepik Mystic AI generation.

Your job is to analyze ANY blog article and create the most relevant, specific, and visually stunning image prompt possible.

━━━ STEP 1: IDENTIFY CONTENT CATEGORY ━━━
First determine which category the content belongs to:

EDUCATION & COURSES (CA, MBA, ACCA, coaching, online courses, degrees)
→ Show: students studying, books, classrooms, certificates, campus, teachers

TECHNOLOGY & GADGETS (laptops, phones, software, AI, apps, gaming)
→ Show: the actual device/product, tech workspace, screens with UI, modern setup

FINANCE & BUSINESS (stocks, investing, banking, startups, economy)
→ Show: charts, graphs, money, office, business people, financial data screens

HEALTH & FITNESS (diet, workout, yoga, mental health, medicine)
→ Show: the actual exercise/food/activity, gym, healthy meals, medical setting

FOOD & COOKING (recipes, restaurants, cuisine, nutrition)
→ Show: the actual dish beautifully plated, kitchen, cooking process, ingredients

TRAVEL & PLACES (cities, countries, hotels, tourism)
→ Show: the actual landmark/destination, scenic views, local culture, architecture

CAREER & JOBS (resume, interview, salary, skills, hiring)
→ Show: professional office, interview scene, handshake, workplace, laptop with work

FASHION & LIFESTYLE (clothes, beauty, home decor, luxury)
→ Show: the actual product/style, lifestyle setting, model, interior

SPORTS & GAMING (cricket, football, esports, gaming)
→ Show: the actual sport/game in action, stadium, gaming setup, players

MARKETING & SEO (digital marketing, social media, SEO, content)
→ Show: analytics dashboard, marketing team, social media screens, growth charts

LEGAL & GOVERNMENT (laws, taxes, compliance, government schemes)
→ Show: legal documents, courthouse, official setting, professional advisor

REAL ESTATE & HOME (property, rent, interior, construction)
→ Show: beautiful property, interior design, architecture, home setting

PARENTING & KIDS (children, school, toys, family)
→ Show: happy children, family moments, school setting, learning activities

ENVIRONMENT & NATURE (climate, sustainability, plants, animals)
→ Show: nature scenes, wildlife, eco-friendly settings, green energy

ANY OTHER TOPIC → Extract the main subject and show the most visually representative scene for that topic

━━━ STEP 2: DETECT LOCATION/REGION ━━━
If content mentions India/Indian cities → Use Indian setting, Indian people, Indian context
If content mentions specific country/city → Use that location's visual elements
If content is global/generic → Use universal/neutral setting

━━━ STEP 3: BUILD THE PERFECT PROMPT ━━━
Combine these elements:
[MAIN SUBJECT from content analysis] + [SPECIFIC DETAILS from article — brand names, product names, course names] + [PEOPLE if topic involves humans] + [SETTING/LOCATION] + [LIGHTING: always bright, natural or studio] + [STYLE: photorealistic, professional photography] + [QUALITY: sharp focus, 8K, high resolution] + [COMPOSITION: wide horizontal, rule of thirds]

━━━ STRICT RULES ━━━
✅ Always bright, well-lit images
✅ Always photorealistic unless topic needs illustration
✅ Always sharp focus, high resolution
✅ Always horizontal/widescreen composition
✅ Include people when topic is about humans (courses, careers, lifestyle etc)
✅ Show actual products for tech/gadget topics
✅ Use location context from article
❌ Never dark or moody lighting
❌ Never empty rooms with no subject
❌ Never text, words, signs in image
❌ Never generic stock photo feel
❌ Never watermarks or logos
❌ Never abstract when specific is possible
❌ Never ignore the actual topic

━━━ OUTPUT FORMAT ━━━
Output ONLY the final image prompt. Maximum 120 words.
No explanations, no labels, no categories. Just the pure image generation prompt.
Make it detailed, specific, and vivid.`,

      `Analyze this blog content and generate the perfect image prompt:

TOPIC: ${topic}

CONTENT:
${cleanContent || topic}

Generate the most relevant and visually stunning image prompt for this content.`,
    );

    return result
      .replace(/^["']|["']$/g, '')  // remove wrapping quotes
      .replace(/^prompt:/i, '')      // remove "Prompt:" prefix
      .trim();
  } catch {
    return `${topic}, professional blog hero image, bright natural lighting, photorealistic, high resolution, widescreen 16:9`;
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

        // generated is array of strings e.g. ["https://..."]
        if (generated?.[0]) {
          return typeof generated[0] === 'string'
            ? generated[0]        // plain string URL
            : generated[0]?.url;  // object with url property
        }
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
    const cleanContent = articleHtml.replace(/<[^>]*>/g, '').slice(0, 400);
    const keyPoints = await callGroq(
      `Look at this blog content and identify the main visual concept that would make a great infographic illustration.

Describe 3-4 visual elements/icons that represent the topic — NO text descriptions, only visual concepts.

Example for CA Course: "graduation cap, accounting calculator, certificate scroll, rupee coin stack"
Example for Gaming Laptops: "gaming laptop with RGB, GPU chip, fps counter display, cooling fan"

Output ONLY comma separated visual elements. Max 4 elements. No sentences.`,
      `Topic: ${topic}\nContent: ${cleanContent}`,
    );
    finalPrompt = `Clean professional infographic illustration about ${topic}, featuring icons of: ${keyPoints}, flat design vector art style, vibrant colors on white background, modern minimal design, circular and grid layout, professional business infographic style, colorful geometric shapes, NO text NO words NO letters NO numbers, clean icons only, high resolution, 8K quality, Adobe Illustrator style flat design`;
  } else {
    // featured
    finalPrompt = await generateImagePrompt(topic, articleHtml);
  }

  const taskId = await createImageTask(finalPrompt);
  const url = await pollImageTask(taskId, onProgress);

  return { url, promptUsed: finalPrompt };
}
