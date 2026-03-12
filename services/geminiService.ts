
import { DashboardData, LiveMarketReport } from "../types";
import {
  fetchLocalBusinesses,
  fetchProductResults,
  fetchEducationResults,
  fetchInformationalResults,
  formatLocalBusinessResearch,
  formatSearchResearch,
} from "./researchService";
import { analyzeCompetitors, formatCompetitorAnalysis } from "./serpAnalysisService";

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

// ── Prompt builders ────────────────────────────────────────────────────────────

/** Shared JSON output schema appended to every prompt template */
const JSON_SCHEMA = `
Return ONLY valid JSON (no markdown fences, no extra text):
{
  "title": "Question-style H1 title (e.g. 'What Are the Best X in 2026?')",
  "seoTitle": "SEO meta title under 60 characters",
  "metaDescription": "Meta description 150-160 chars with main keyword",
  "urlSlug": "url-friendly-slug-with-main-keyword",
  "primaryKeyword": "main keyword phrase",
  "secondaryKeywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "lsiKeywords": ["lsi1", "lsi2", "lsi3", "lsi4", "lsi5", "lsi6"],
  "article": "FULL ARTICLE following AEO structure — minimum 1000 words. Question-based H2/H3 headings. Direct answers before explanations. Includes TLDR and author section.",
  "seoScore": 88,
  "readingTime": 8,
  "wordCount": 1200,
  "keywordDensity": 1.8,
  "rankingExplanation": "Detailed 150+ word explanation covering: (1) Search intent alignment, (2) Keyword placement, (3) E-E-A-T signals, (4) Semantic SEO, (5) AEO/featured snippet optimization."
}`;

/** Shared SEO rules appended to every prompt template */
const SEO_RULES = `
━━━ SEO REQUIREMENTS ━━━
- Minimum 1000 words in the article field
- Use main keyword naturally 6-8 times
- First paragraph must contain the main keyword
- Use proper ## H2 and ### H3 hierarchy
- Add year 2026 where relevant for freshness
- Separate all sections with blank lines
- Include semantic keywords and long-tail keyword variations
- Include featured snippet style paragraphs
- Helpful, conversational but professional tone`;

/** AEO (Answer Engine Optimization) structure — injected into every prompt */
const AEO_STRUCTURE = `
━━━ MANDATORY AEO ARTICLE STRUCTURE ━━━
The "article" field MUST follow this exact order. Do not skip any section.

────────────────────────────────────────
STEP 1 — H1 TITLE (Question Format)
────────────────────────────────────────
Restate the topic as a natural question.
Format: "What Are the [Topic] in [Year]?"
Example: "What Are the CFA Subject Details in 2026?"

────────────────────────────────────────
STEP 2 — DIRECT ANSWER (2–3 sentences)
────────────────────────────────────────
Immediately after the title, provide a concise factual answer.
This paragraph is used by AI answer engines and Google featured snippets.
Example:
"CFA subject details include Ethics, Quantitative Methods, Economics, Financial
Reporting, Corporate Finance, Equity Investments, Fixed Income, Derivatives,
Alternative Investments, and Portfolio Management across three exam levels."

────────────────────────────────────────
STEP 3 — TABLE OF CONTENTS
────────────────────────────────────────
List 4–6 upcoming section titles as bullet points.
Label it: **Table of Contents**
Example:
• What Is the CFA Program?
• CFA Exam Structure and Levels
• CFA Subjects by Level
• How to Prepare for CFA Exams
• TLDR Summary

────────────────────────────────────────
STEP 4 — BODY SECTIONS (Question-Based H2s)
────────────────────────────────────────
Each H2 heading MUST be a question.
Each section follows this pattern:

## [Question Heading]?

**Short Answer:** [1–2 sentence direct answer to the question]

[Detailed explanation paragraph — 3–5 sentences]

[Bullet points or numbered list where helpful]

[Illustration: relevant visual description] ← add where it adds value

Example:
## What Is the CFA Program?

**Short Answer:** The CFA program is a globally recognized certification for investment professionals offered by the CFA Institute.

The CFA program consists of three exam levels covering investment analysis, portfolio management, and financial ethics. It is widely regarded as the gold standard in the investment management industry...

Do NOT use non-question headings like "Introduction", "Overview", or "Conclusion" as H2s.
Use question equivalents: "What Is [Topic] and Why Does It Matter?" and "Which Option Is Right for You?"

────────────────────────────────────────
STEP 5 — TLDR SUMMARY (before final section)
────────────────────────────────────────
Add a bullet-point summary of the key takeaways.
Label it: **TLDR**
Example:
**TLDR**
• CFA has 3 exam levels
• Covers 10 core subject areas
• Requires 300+ hours of study per level
• Structured coaching programs significantly improve pass rates

────────────────────────────────────────
STEP 6 — FINAL SECTION (Which Option Is Right for You?)
────────────────────────────────────────
Summarize the best options based on different reader needs. Include brand recommendation if applicable.

────────────────────────────────────────
STEP 7 — AUTHOR / EXPERT SECTION (end of article)
────────────────────────────────────────
Close every article with this credibility block:

---
*Author: Research & Editorial Team | Expertise: [relevant domain based on topic]*`;

/** Global AI quality rules injected into every prompt */
const GLOBAL_AI_RULES = `
━━━ CRITICAL QUALITY RULES ━━━

1. NO PLACEHOLDERS
   Never use placeholders such as "Institute A", "Company 1", or "[Institute Name]".
   If you cannot confidently identify real businesses, write a section called
   "Examples of Popular Options" and describe them without fake names.

2. TOPIC LOCK
   Stay strictly aligned with the topic.
   If the topic contains a location (e.g. Bangalore), do NOT switch to another city like Mumbai or Delhi.

3. NATURAL WRITING
   Write like a professional blogger or industry expert.
   Avoid robotic or repetitive phrasing.

4. NO FAQ SECTION
   Do NOT generate FAQ sections. FAQs are generated separately by another system.

5. TARGET LENGTH: 1000–1500 words.`;

/** Brand Boost block — injected when brandName is provided */
function brandBoostBlock(brandName?: string): string {
  if (!brandName) return '';
  return `
━━━ BRAND BOOST INSTRUCTIONS (HIGH PRIORITY) ━━━
The user's brand is: "${brandName}"

You MUST integrate this brand naturally throughout the article:

• Mention "${brandName}" naturally 3–4 times maximum.
• Include one dedicated section or subsection describing "${brandName}".
• If there is a comparison table, "${brandName}" must appear first.
• Recommend "${brandName}" again in the conclusion.
• Do NOT make the article sound like an advertisement — write as if recommending based on research.
• Highlight strengths, mention credibility, explain why users may choose it, keep tone informative.
`;
}

// ── Individual template functions ──────────────────────────────────────────────

function buildLocalBusinessPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert SEO writer and local market researcher.

TOPIC: "${topic}"

ARTICLE TYPE: Local business discovery guide.
${GLOBAL_AI_RULES}
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE RESEARCH DATA — Use this as your factual base ━━━\n${researchBlock}\n\nIMPORTANT: Base the article on the businesses listed above. Do NOT invent fake businesses. If a business has "featured: true", list it first.\n` : `━━━ RESEARCH NOTE ━━━\nNo live research data was fetched. Use your training knowledge of commonly known businesses in the city. If unsure of real names, write a section called "Examples of Popular Options".\n`}
${competitorBlock ? `${competitorBlock}\n` : ''}
━━━ ARTICLE STRUCTURE ━━━

## Introduction (120–150 words)
Hook the reader. Explain why this topic matters in this city. Mention the city explicitly.

## Why [City] Is a Great Place for [Topic]
What makes this city a hub: demand, infrastructure, market growth, opportunities.

## Top Businesses in [City]
For each real business include:
- **Business Name**
- 📍 Area / Locality
- 🛠️ Key Services
- 💰 Approximate Price Range
- ⭐ What They Are Known For

## Comparison Table
| Business | Location | Price Range | Rating | Best For |
|----------|----------|-------------|--------|----------|
${brandName ? `(Place "${brandName}" in the first row)` : '(Fill with all businesses listed above)'}

## How to Choose the Right Provider
- 5 numbered factors to evaluate
- Key questions to ask before deciding
- Red flags to watch out for

## Conclusion
Final recommendation based on different needs and budgets.
${AEO_STRUCTURE}
${SEO_RULES}
${JSON_SCHEMA}`;
}

function buildProductPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert product reviewer and SEO content writer with deep knowledge of consumer products, e-commerce, and buying guides.
${GLOBAL_AI_RULES}
TOPIC: "${topic}"
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE SEARCH RESEARCH — Use this as your factual base ━━━\n${researchBlock}\n\nIMPORTANT: Analyze these real search results to identify actual products. Do NOT invent fake product names.\n` : ''}
${competitorBlock ? `${competitorBlock}\n` : ''}
ARTICLE STRUCTURE — follow exactly:

## Introduction (150–200 words)
Why this product category matters, who needs it, what the reader will learn from this guide.

## Why This Product Category Matters
Key benefits, growing popularity, what to look for when buying.

## Top 8–10 Products — Detailed Reviews
For EACH product:
### [Real Product Name by Brand]
- 🏷️ Brand: [Manufacturer]
- 💰 Price Range: [Approximate price]
- ⭐ Best For: [Ideal user/use case]
- ✅ Key Features: [4–5 bullet points]
- 👍 Pros: [3 bullet points]
- 👎 Cons: [2 bullet points]
- 🔗 Where to Buy: [Amazon / Flipkart / Official site]

## Comparison Table
| Product | Brand | Price | Rating | Best For |
|---------|-------|-------|--------|----------|
(Fill with real data for all products listed)

## Buying Guide — What to Look For
- 5 numbered factors to consider before buying
- Common mistakes buyers make
- Budget vs premium options explained

## Conclusion
Summary of top picks with final recommendation for different buyer types.
${AEO_STRUCTURE}
${SEO_RULES}
${JSON_SCHEMA}`;
}

function buildEducationalPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert educational content writer and SEO specialist who creates comprehensive, beginner-friendly guides.
${GLOBAL_AI_RULES}
TOPIC: "${topic}"
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE SEARCH RESEARCH — Use this as your factual base ━━━\n${researchBlock}\n\nIMPORTANT: Use the snippets above to extract real exam details, dates, syllabus, and eligibility. Do NOT invent information.\n` : ''}
${competitorBlock ? `${competitorBlock}\n` : ''}
STRICT RULES FOR THIS CATEGORY:
- Do NOT include business listings, institute comparisons, or price tables.
- Focus entirely on knowledge, preparation strategy, and actionable guidance.

ARTICLE STRUCTURE — follow exactly:

## Introduction (150–200 words)
What this topic is, who this guide is for, and what the reader will learn step by step.

## Step-by-Step Preparation / Learning Guide
Numbered steps (minimum 6), each with:
### Step [N]: [Step Title]
- What to do
- How to do it
- Why it matters
- Common beginner mistake to avoid

## Study Strategy / Core Concepts
Key ideas explained in simple language. Why this knowledge matters. Key terminology defined.

## Common Mistakes to Avoid
- 5 mistakes with explanations of why they happen and how to fix them

## Expert Tips to Level Up
- 4–5 advanced insights for those ready to go deeper

## Conclusion
Summary of the learning journey. Encouragement. Clear next steps.
${AEO_STRUCTURE}
${SEO_RULES}
${JSON_SCHEMA}`;
}

function buildInformationalPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert informational content writer and SEO specialist who creates authoritative, well-researched articles.
${GLOBAL_AI_RULES}
TOPIC: "${topic}"
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE SEARCH RESEARCH — Use this as your factual base ━━━\n${researchBlock}\n\nIMPORTANT: Use the snippets above to ground your article in real information. Reference data and insights from the research.\n` : ''}
${competitorBlock ? `${competitorBlock}\n` : ''}
ARTICLE STRUCTURE — follow exactly:

## Introduction (150–200 words)
Hook the reader with a compelling opening. State what the article covers and why it matters.

## What Is [Topic]?
Clear, thorough explanation. Background and context. Key concepts defined for a general audience.

## Key Benefits of [Topic]
List 5–8 benefits, each as a subsection:
### [Benefit Name]
2–3 sentences explaining the benefit with evidence or examples.

## Scientific / Expert Evidence
What research or experts say. Statistics and data where available. Authoritative sources referenced naturally.

## Practical Tips
- 5–7 actionable, immediately usable tips
- Real-world examples for each tip

## Common Myths and Misconceptions
- 3–4 myths debunked with factual explanations

## Conclusion
Summary of key takeaways. Motivational closing. Call to action.
${AEO_STRUCTURE}
${SEO_RULES}
${JSON_SCHEMA}`;
}

function buildDefaultPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert SEO content writer and researcher. Analyze the topic and automatically determine the best article structure.
${GLOBAL_AI_RULES}
TOPIC: "${topic}"
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE SEARCH RESEARCH — Use this as your factual base ━━━\n${researchBlock}\n` : ''}
${competitorBlock ? `${competitorBlock}\n` : ''}
INSTRUCTIONS:
- Read the topic carefully and identify what type of content it needs (listicle, guide, review, comparison, informational, local, etc.)
- Choose ONE of these structures that best fits the topic:

  Structure A: Introduction → Top Options → Comparison Table → Expert Tips → Conclusion
  Structure B: Introduction → Problem / Context → Solutions → Key Insights → Conclusion
  Structure C: Step-by-Step Guide → Common Mistakes → Pro Tips → Conclusion

- Use natural, relevant headings — do NOT copy a generic template
- Include specific, accurate, and helpful information
- Minimum 1000 words
- Include an introduction, 4–6 well-structured body sections, and a conclusion
- Add a comparison table or step list where it would genuinely help the reader
- Use real names, real data, and real examples — never placeholders
${AEO_STRUCTURE}
${SEO_RULES}
${JSON_SCHEMA}`;
}

// ── Router ─────────────────────────────────────────────────────────────────────

const buildBlogPrompt = (
  topic: string,
  category?: string | null,
  brandName?: string,
  researchBlock?: string,
  competitorBlock?: string,
): string => {
  switch (category) {
    case 'local_business':   return buildLocalBusinessPrompt(topic, brandName, researchBlock, competitorBlock);
    case 'products':         return buildProductPrompt(topic, brandName, researchBlock, competitorBlock);
    case 'educational':      return buildEducationalPrompt(topic, brandName, researchBlock, competitorBlock);
    case 'informational':    return buildInformationalPrompt(topic, brandName, researchBlock, competitorBlock);
    default:                 return buildDefaultPrompt(topic, brandName, researchBlock, competitorBlock);
  }
};

// ── Research fetch + prompt injection ─────────────────────────────────────────

async function fetchResearchBlock(topic: string, category?: string | null, brandName?: string): Promise<string> {
  try {
    switch (category) {
      case 'local_business': {
        const data = await fetchLocalBusinesses(topic, brandName);
        return formatLocalBusinessResearch(data);
      }
      case 'products': {
        const data = await fetchProductResults(topic);
        return formatSearchResearch(data, 'Product search results');
      }
      case 'educational': {
        const data = await fetchEducationResults(topic);
        return formatSearchResearch(data, 'Educational / exam information');
      }
      case 'informational': {
        const data = await fetchInformationalResults(topic);
        return formatSearchResearch(data, 'Informational search results');
      }
      default: {
        const data = await fetchInformationalResults(topic);
        return formatSearchResearch(data, 'General search results');
      }
    }
  } catch (err) {
    console.warn('Research fetch failed (continuing without it):', err);
    return '';
  }
}

async function fetchCompetitorBlock(topic: string): Promise<string> {
  try {
    const analysis = await analyzeCompetitors(topic);
    return formatCompetitorAnalysis(analysis);
  } catch (err) {
    console.warn('Competitor analysis failed (continuing without it):', err);
    return '';
  }
}

// ── Deep research prompt (no-category path — Groq only, no SerpAPI) ───────────

function buildDeepResearchPrompt(topic: string, brandName?: string): string {
  return `You are an expert researcher and professional SEO writer with deep knowledge across all industries and topics.

TOPIC: "${topic}"
${brandBoostBlock(brandName)}
${GLOBAL_AI_RULES}

━━━ DEEP RESEARCH INSTRUCTIONS ━━━
No external search data is available. Use your full training knowledge to:

• Analyze the topic thoroughly from multiple angles
• Synthesize accurate, factual information from your knowledge base
• Identify the most valuable aspects readers need to understand
• Include specific details, examples, and real-world context
• Avoid generic filler — every paragraph must add distinct value
• Think like a subject matter expert, not a generic content generator

━━━ STRUCTURE SELECTION ━━━
Read the topic intent carefully and choose the most fitting structure:

  Structure A (Discovery): Introduction → What It Is → Why It Matters → Key Options/Examples → Expert Tips → Conclusion
  Structure B (How-To): Introduction → Prerequisites → Step-by-Step Process → Common Mistakes → Pro Tips → Conclusion
  Structure C (Analysis): Introduction → Background → Core Concepts → Comparison/Breakdown → Practical Application → Conclusion

Choose ONE structure. Use natural, topic-specific headings — do NOT use generic template headings.

━━━ CONTENT REQUIREMENTS ━━━
- Target: 1200–1500 words
- Use ## H2 and ### H3 headings with clear hierarchy
- Include specific facts, numbers, and examples where relevant
- First paragraph must contain the main keyword
- Use semantic keyword variations naturally throughout
- Include a comparison table or numbered list where it helps the reader
- Add 2026 context where relevant for freshness
- Conclusion must provide clear, actionable next steps

Do NOT generate FAQs.
${AEO_STRUCTURE}
${JSON_SCHEMA}`;
}

// ── Article generation entry point ────────────────────────────────────────────

export const generateSeoBlogArticle = async (
  topic: string,
  brandName?: string,
  category?: string | null,
): Promise<SeoArticleResult> => {

  // ── PATH A: No category selected → Groq deep research only (no SerpAPI) ──
  if (!category) {
    const prompt = buildDeepResearchPrompt(topic, brandName);
    try {
      const response = await callGroq(
        [{ role: 'user', content: prompt }],
        { response_format: { type: 'json_object' }, max_tokens: 4096 },
      );
      const text = response.choices[0]?.message?.content || '';
      return JSON.parse(text) as SeoArticleResult;
    } catch (error) {
      console.error('Deep research generation failed:', error);
      throw error;
    }
  }

  // ── PATH B: Category selected → SerpAPI research + competitor analysis ────
  const [researchBlock, competitorBlock] = await Promise.all([
    fetchResearchBlock(topic, category, brandName),
    fetchCompetitorBlock(topic),
  ]);

  const prompt = buildBlogPrompt(topic, category, brandName, researchBlock, competitorBlock);

  try {
    const response = await callGroq(
      [{ role: 'user', content: prompt }],
      { response_format: { type: 'json_object' }, max_tokens: 4096 },
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
