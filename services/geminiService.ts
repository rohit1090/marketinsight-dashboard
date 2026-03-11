
import { DashboardData, LiveMarketReport } from "../types";

export interface SeoArticleResult {
  title: string;
  seoTitle: string;
  metaDescription: string;
  urlSlug: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  lsiKeywords: string[];
  article: string;
  seoScore: number;
  readingTime: number;
  wordCount: number;
  keywordDensity: number;
  rankingExplanation: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

// ── Secure proxy helpers ──────────────────────────────────────────────────────
// All AI API keys live server-side in /api/ai/gemini.js and /api/ai/groq.js.
// The browser only ever sees requests to /api/ai/*.

interface GeminiProxyResponse {
  text: string;
  candidates: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri: string; title: string } }>;
    };
  }>;
  error?: string;
}

interface GroqProxyResponse {
  choices: Array<{ message: { content: string } }>;
  error?: string;
}

async function callGemini(
  model: string,
  contents: string,
  config?: Record<string, unknown>,
): Promise<GeminiProxyResponse> {
  const res = await fetch('/api/ai/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, contents, config }),
  });
  const data: GeminiProxyResponse = await res.json();
  if (!res.ok) throw new Error(data.error || `Gemini proxy error ${res.status}`);
  return data;
}

async function callGroq(
  messages: Array<{ role: string; content: string }>,
  options: Record<string, unknown> = {},
): Promise<GroqProxyResponse> {
  const res = await fetch('/api/ai/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      ...options,
    }),
  });
  const data: GroqProxyResponse = await res.json();
  if (!res.ok) throw new Error(data.error || `Groq proxy error ${res.status}`);
  return data;
}

export const runAgenticReasoning = async (data: DashboardData, goal: string) => {
  const prompt = `
    You are the "MarketInsight Autonomous Agent". 
    Current Goal: ${goal}
    Current Data State: ${JSON.stringify(data)}
    
    Perform a deep reasoning step. 
    1. Identify 3 anomalies in the data.
    2. Propose 3 specific 'Interventions' (actions the user should approve).
    3. Explain the projected impact of each intervention.
    
    Formatting: Return a clear, actionable strategy.
  `;

  try {
    const { text } = await callGemini(
      'gemini-2.5-pro-preview-05-06',
      prompt,
      { thinkingConfig: { thinkingBudget: 4000 } },
    );
    return text;
  } catch (error) {
    console.error("Agent reasoning failed:", error);
    return "Agent encountered a processing error. Retrying autonomous scan...";
  }
};

export const fetchAutonomousMarketScan = async (channel: string) => {
  const prompt = `Autonomous scan of ${channel} market trends. Identify one critical opportunity for an agent to execute today.`;
  try {
    const { text } = await callGemini('gemini-2.0-flash', prompt, { tools: [{ googleSearch: {} }] });
    return text;
  } catch (error) {
    return "Scan failed.";
  }
};

/**
 * Added getMarketingInsights to fix export error in AiInsightsPanel
 */
export const getMarketingInsights = async (data: DashboardData): Promise<string> => {
  const prompt = `Analyze this marketing dashboard data and provide strategic insights: ${JSON.stringify(data)}. Focus on ROI and channel optimization.`;
  try {
    const { text } = await callGemini('gemini-2.0-flash', prompt);
    return text;
  } catch (error) {
    console.error("Marketing Insights failed:", error);
    return "Could not generate insights at this time.";
  }
};

/**
 * Added fetchLiveMarketIntel to fix export error in MarketIntelPanel
 */
export const fetchLiveMarketIntel = async (channel: string): Promise<LiveMarketReport> => {
  const prompt = `Provide a market intelligence report for the ${channel} marketing channel. Include current benchmarks, key trends, competitor landscape, and strategic recommendations. Structure with sections: Overview, Key Trends, Benchmarks, Competitor Moves, and Recommendations.`;

  const parseQuotaError = (err: unknown): string | null => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      return 'Gemini API quota exceeded for this key. Please check your Google AI Studio quota at https://aistudio.google.com or enable billing, then try again.';
    }
    return null;
  };

  // Try with Google Search grounding first
  try {
    const { text, candidates } = await callGemini('gemini-2.0-flash', prompt, { tools: [{ googleSearch: {} }] });

    const sources = candidates[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk) => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || 'Source' }))
      .filter((s) => s.uri) || [];

    return { summary: text || 'No live data found.', sources };
  } catch (groundingError) {
    const quotaMsg = parseQuotaError(groundingError);

    // If quota error, try without grounding (uses different quota bucket)
    if (quotaMsg) {
      try {
        const { text } = await callGemini('gemini-2.0-flash', prompt);
        return { summary: text || 'No data found.', sources: [] };
      } catch (fallbackError) {
        const fallbackQuotaMsg = parseQuotaError(fallbackError);
        throw new Error(fallbackQuotaMsg || (fallbackError instanceof Error ? fallbackError.message : String(fallbackError)));
      }
    }

    console.error("Market Intel failed:", groundingError);
    throw groundingError;
  }
};

/**
 * Added runSeoAudit to fix export error in SeoSuitePanel
 */
export const runSeoAudit = async (domain: string): Promise<{ analysis: string; sources: any[] }> => {
  const prompt = `Perform a high-level SEO audit for the domain: ${domain}. Search for its search presence, technical health indicators, and backlink profile.`;
  try {
    const { text, candidates } = await callGemini('gemini-2.0-flash', prompt, { tools: [{ googleSearch: {} }] });

    const sources = candidates[0]?.groundingMetadata?.groundingChunks || [];

    return { analysis: text || 'Audit analysis unavailable.', sources };
  } catch (error) {
    console.error("SEO Audit failed:", error);
    throw error;
  }
};

// ── Enhanced prompt builder ────────────────────────────────────────────────────

const buildBlogPrompt = (topic: string, brandName?: string): string => {
  return `
You are an expert SEO content writer and local business researcher with deep knowledge of coaching institutes, service providers, and businesses across India.

TOPIC: "${topic}"
${brandName ? `
BRAND BOOST INSTRUCTIONS (HIGHEST PRIORITY):
The user's brand is: "${brandName}"

You MUST integrate this brand throughout the article:

1. FEATURED FIRST: When listing coaching centers or businesses, ALWAYS mention "${brandName}" as the FIRST option with the most detailed description (4-5 sentences minimum).

2. INTRODUCTION MENTION: Naturally mention "${brandName}" in the introduction paragraph as a top choice.

3. COMPARISON TABLE: "${brandName}" must appear in the first row of any comparison table with the best ratings.

4. RECOMMENDATION: In the conclusion, specifically recommend "${brandName}" as the top pick.

5. NATURAL INTEGRATION: Weave "${brandName}" naturally throughout — do not make it look like an advertisement. Write it as if it is genuinely the best option based on research.

6. FAQ MENTION: At least 1 FAQ answer should reference "${brandName}" as an example.

For "${brandName}" specifically write:
- Location: describe as conveniently located
- Faculty: highly experienced and qualified
- Results: excellent pass rates and student success
- Features: personalized attention, comprehensive study material, mock tests, doubt clearing sessions
- Fees: competitive and value for money
` : ''}
CRITICAL RULES — FOLLOW STRICTLY:

━━━ RULE 1: REAL BUSINESSES ONLY ━━━
- Always mention REAL, ACTUAL businesses/institutes/centers relevant to the topic and city mentioned
- Include real locality/area names within the city
- Include approximate fee ranges based on market research
- NEVER use placeholder names like "Institute A", "Coaching Center 1", "XYZ Academy" etc.
- If you are not sure about a specific institute, mention well-known national brands present in that city

━━━ RULE 2: ARTICLE STRUCTURE ━━━
Build the article field using this exact structure:

## Introduction (150-200 words)
- What the topic is about, why it matters, what the reader will learn

## Why [City Name] for [Topic] (100-150 words)
- Why this city is a hub: job market, demand, opportunities

## Top [8-10] [Topic] in [City] — Detailed Reviews
For EACH real institute/business:
### [Real Full Name of Institute]
- 📍 Location: [Specific area, City]
- ⭐ Best For: [Who should choose this]
- 📚 Courses Offered: [List relevant courses]
- 💰 Fee Range: [Approximate fees]
- ✅ Key Highlights: [3-4 bullet points]
- 🕒 Batch Timings: [Morning/Evening/Weekend]

## Fees Comparison Table
Include a markdown table:
| Institute Name | Location | Fee Range | Mode | Rating |
|----------------|----------|-----------|------|--------|
(real data for all institutes listed above)

## How to Choose the Right [Topic] in [City]
- 5 factors to consider (numbered list)
- Questions to ask before enrolling
- Red flags to avoid

## Conclusion
- Summary of top picks
- Final recommendation based on different needs

━━━ RULE 3: SEO REQUIREMENTS ━━━
- Minimum 1500 words in the article field
- Use main keyword naturally 8-10 times
- First paragraph must contain the main keyword
- Use proper ## H2 and ### H3 hierarchy
- Add year 2025 where relevant for freshness
- Separate all sections/paragraphs with blank lines

━━━ RULE 4: CONTENT QUALITY ━━━
- Helpful, conversational but professional tone
- Specific details that show genuine research
- Practical tips readers can use immediately
- Honest pros and cons when comparing options

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "title": "Compelling H1 title with city and year 2025",
  "seoTitle": "SEO meta title under 60 characters",
  "metaDescription": "Meta description 150-160 chars with main keyword",
  "urlSlug": "url-friendly-slug-with-main-keyword",
  "primaryKeyword": "main keyword phrase",
  "secondaryKeywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "lsiKeywords": ["lsi1", "lsi2", "lsi3", "lsi4", "lsi5", "lsi6"],
  "article": "FULL ARTICLE — minimum 1500 words using structure above. Real institute names only. Include comparison table.",
  "seoScore": 88,
  "readingTime": 8,
  "wordCount": 1500,
  "keywordDensity": 1.8,
  "rankingExplanation": "Detailed 200+ word explanation covering: (1) Search intent alignment, (2) Keyword placement, (3) E-E-A-T signals with real business data, (4) Semantic SEO, (5) Heading structure."
}`;
};

export const generateSeoBlogArticle = async (topic: string, brandName?: string): Promise<SeoArticleResult> => {
  const prompt = buildBlogPrompt(topic, brandName);

  try {
    const response = await callGroq(
      [{ role: 'user', content: prompt }],
      { response_format: { type: 'json_object' }, max_tokens: 4000 },
    );
    const text = response.choices[0]?.message?.content || '';
    return JSON.parse(text) as SeoArticleResult;
  } catch (error) {
    console.error('SEO Blog generation failed:', error);
    throw error;
  }
};

export const generateFaqFromArticle = async (topic: string, articleText: string): Promise<FaqItem[]> => {
  const prompt = `You are an SEO expert. Based on this article about "${topic}", generate 8 SEO-friendly FAQ questions and detailed answers.

Article summary (first 800 chars): ${articleText.slice(0, 800)}

Requirements:
- Questions must be real queries people search for on Google (use natural language)
- Include long-tail keyword variations of the topic
- Answers must be 60-100 words each: concise, accurate, beginner-friendly
- Naturally include the topic keyword in answers
- Cover different angles: what/why/how/when/best/tips/comparison questions
- Make answers suitable for Google Featured Snippets (direct and clear)

Return ONLY valid JSON with no markdown fences:
{
  "faqs": [
    { "question": "Question here?", "answer": "Detailed answer here." }
  ]
}`;

  try {
    const response = await callGroq(
      [{ role: 'user', content: prompt }],
      { response_format: { type: 'json_object' } },
    );
    const text = response.choices[0]?.message?.content || '{"faqs":[]}';
    const parsed = JSON.parse(text);
    return parsed.faqs as FaqItem[];
  } catch (error) {
    console.error('FAQ generation failed:', error);
    throw error;
  }
};

export const suggestSocialContent = async (topic: string, platforms: string): Promise<string> => {
  const prompt = `Suggest creative and engaging social media content ideas for the following topic: "${topic}" across these platforms: ${platforms}. Include hooks and call-to-actions.`;
  try {
    const { text } = await callGemini('gemini-2.0-flash', prompt);
    return text;
  } catch (error) {
    console.error("Social content suggestion failed:", error);
    return "Failed to generate suggestions.";
  }
};
