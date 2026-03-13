
import { DashboardData, LiveMarketReport } from "../types";
import {
  fetchLocalBusinessesCombined,
  fetchProductResults,
  fetchEducationResults,
  fetchInformationalResults,
  formatCombinedLocalResearch,
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

// ── Article cleanup (post-Groq formatting step) ───────────────────────────────

/** Convert a markdown table block to an HTML table */
function convertMarkdownTablesToHtml(s: string): string {
  // Matches: header row | separator row | 1+ data rows
  return s.replace(
    /((?:\|.+\|\n?){2,})/g,
    (block) => {
      const lines = block.trim().split('\n').filter(l => l.trim() && l.trim() !== '|');
      if (lines.length < 2) return block;
      // Separator line: |---|---|
      const sepIdx = lines.findIndex(l => /^\|[-| :]+\|$/.test(l.trim()));
      if (sepIdx === -1) return block;
      const headers = lines[0].split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());
      const rows = lines.slice(sepIdx + 1);
      const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map(row => {
        const cells = row.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());
        return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
      }).join('')}</tbody>`;
      return `<table>${thead}${tbody}</table>`;
    },
  );
}

/** Convert consecutive loose markdown bullet lines to <ul><li> blocks */
function convertLooseBulletsToHtml(s: string): string {
  const lines = s.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const isBullet = /^[-*•]\s+/.test(line) && !line.trim().startsWith('<');
    if (isBullet) {
      if (!inList) { out.push('<ul>'); inList = true; }
      const text = line.replace(/^[-*•]\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      out.push(`<li>${text}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(line);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

/**
 * Post-process the Groq article output:
 * 1. Remove emojis and icon characters
 * 2. Convert any residual Markdown headings → HTML
 * 3. Convert residual **bold** → <strong>
 * 4. Convert Markdown tables → HTML tables
 * 5. Convert loose Markdown bullet lines → <ul><li>
 */
function cleanArticleHtml(raw: string): string {
  if (!raw) return '';
  let s = raw;

  // 1. Strip Unicode emoji blocks and common icon chars
  s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '');
  // Strip any residual named emoji that slipped through
  s = s.replace(/[📍🛠️💰⭐✅👍👎🏷️📞🌐📝⚡✦►▸▶✓]/g, '');

  // 2. Markdown headings → HTML (lines starting with #)
  s = s.replace(/^#### (.+)$/gm, '<h4><strong>$1</strong></h4>');
  s = s.replace(/^### (.+)$/gm, '<h3><strong>$1</strong></h3>');
  s = s.replace(/^## (.+)$/gm, '<h2><strong>$1</strong></h2>');
  s = s.replace(/^# (.+)$/gm, '<h1><strong>$1</strong></h1>');

  // 3. Residual **bold** and __bold__ → <strong>
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // 4. Markdown tables → HTML tables
  s = convertMarkdownTablesToHtml(s);

  // 5. Loose markdown bullets → <ul><li>
  s = convertLooseBulletsToHtml(s);

  // 6. Collapse excess blank lines
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────

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
  "article": "FULL HTML ARTICLE following AEO structure — minimum 1200 words, target 1200–1400. Valid HTML only (no Markdown). 5–8 question-based H2 headings, H3 subsections, featured snippet Short Answer in each H2, TLDR, Conclusion, author block.",
  "seoScore": 88,
  "readingTime": 8,
  "wordCount": 1250,
  "keywordDensity": 1.8,
  "rankingExplanation": "Detailed 150+ word explanation covering: (1) Search intent alignment, (2) Keyword placement, (3) E-E-A-T signals, (4) Semantic SEO, (5) AEO/featured snippet optimization."
}`;

/** Shared SEO rules appended to every prompt template */
const SEO_RULES = `
━━━ SEO REQUIREMENTS ━━━
- Minimum 1200 words in the article field (target 1200–1400)
- Use main keyword naturally 6–8 times throughout the article
- First paragraph must contain the main keyword
- Use proper <h2> and <h3> HTML hierarchy — NO Markdown headings (#, ##, ###)
- Add year 2026 where relevant for freshness signals
- Include semantic keywords and long-tail keyword variations
- Every <h2> section MUST open with <p><strong>Short Answer:</strong> …</p> (featured snippet format)
- Helpful, conversational but professional tone
- Include at least one internal contextual reference (comparison or related topic mention)
- Include at least one external reference (named official source, publication, or governing body)`;


/** Global AI quality rules injected into every prompt */
const GLOBAL_AI_RULES = `
━━━ CRITICAL QUALITY RULES ━━━

1. FACTUAL ACCURACY (HIGHEST PRIORITY)
   If the topic involves professional exams, certifications, academic syllabus, or government exams:
   • Use ONLY verified, accurate information from your training knowledge.
   • Verify the official exam structure, subject list, exam format, and governing organization before writing.
   • Do NOT invent syllabus topics, fabricate exam structure, or guess pass marks.
   • If unsure about specific details, explain the concept accurately rather than fabricating specifics.
   Example: For CMA exam — Part 1 is Financial Planning, Performance, and Analytics;
   Part 2 is Strategic Financial Management. Never invent different parts.

2. NO PLACEHOLDERS
   Never use placeholders such as "Institute A", "Company 1", or "[Institute Name]".
   If you cannot confidently identify real businesses, write a section called
   "Examples of Popular Options" and describe them without fake names.

3. TOPIC LOCK
   Stay strictly aligned with the topic.
   If the topic contains a location (e.g. Bangalore), do NOT switch to another city like Mumbai or Delhi.

4. NATURAL WRITING
   Write like a professional blogger or industry expert.
   Avoid robotic or repetitive phrasing.

5. NO FAQ SECTION
   Do NOT generate FAQ sections. FAQs are generated separately by another system.

6. TARGET LENGTH: 1200–1400 words. Hit this range precisely — never under 1200, never over 1400.
   High-value, tight content scores higher than padding.
   FINAL VALIDATION — before returning JSON, verify:
   ✓ Word count ≥ 1200
   ✓ At least 5 <h2> headings
   ✓ At least 3 <h3> subsections
   ✓ At least 3 <ul> or <ol> lists
   ✓ At least 1 internal contextual reference (comparison or related topic mention)
   ✓ At least 1 external reference (named source, publication, or official body)
   ✓ TLDR section present
   ✓ Conclusion section present
   ✓ Brand section present (if brandName was provided)`;

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
━━━ MANDATORY HTML OUTPUT — NO MARKDOWN ALLOWED ━━━
The "article" field MUST contain valid HTML ONLY.
NEVER output: #, ##, ###, **, __, or any Markdown syntax.
Allowed tags: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <hr> <table> <thead> <tbody> <tr> <th> <td> <a>

━━━ REQUIRED HTML ARTICLE STRUCTURE ━━━

STEP 1 — TITLE
<h1><strong>[Question-style title — e.g. "What Are the Best [Topic] in [City] in 2026?"]</strong></h1>

STEP 2 — DIRECT ANSWER
<p><strong>Direct Answer:</strong> [2–3 sentence factual answer with main keyword. Optimized for AI featured snippets.]</p>

STEP 3 — TABLE OF CONTENTS
<h2><strong>Table of Contents</strong></h2>
<ul>
  <li>Why [City] Is a Hub for [Topic]</li>
  <li>Top [Topic] Businesses in [City]</li>
  <li>Detailed Comparison Table</li>
  <li>How to Choose the Right Provider</li>
  <li>What Are the Key Questions to Ask?</li>
  <li>TLDR Summary</li>
  <li>Conclusion</li>
</ul>

STEP 4 — BODY SECTIONS (5–7 question-based H2 sections, each following this pattern):

<h2><strong>Why Is [City] a Great Place for [Topic]?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence direct answer about the city's market for this topic.]</p>
<p>[4–6 sentence explanation — market size, demand, infrastructure, growth. Mention year 2026.]</p>
<h3><strong>Key Market Factors</strong></h3>
<ul>
  <li>[Specific factor 1]</li>
  <li>[Specific factor 2]</li>
  <li>[Specific factor 3]</li>
</ul>
<p>[Include a contextual reference — e.g. "According to industry reports, this sector has grown by X% in major Indian metros." or compare with another city.]</p>

<h2><strong>Who Are the Top [Topic] Providers in [City]?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence summary of top options available.]</p>
<p>[Overview paragraph — 3–4 sentences introducing the businesses.]</p>
<h3>[Business 1 Name]</h3>
<ul>
  <li><strong>Location:</strong> [Locality]</li>
  <li><strong>Services:</strong> [Key services offered]</li>
  <li><strong>Price Range:</strong> [Price range or tier]</li>
  <li><strong>Known For:</strong> [Unique strengths or reputation]</li>
</ul>
<h3>[Business 2 Name]</h3>
<ul>
  <li><strong>Location:</strong> [Locality]</li>
  <li><strong>Services:</strong> [Key services offered]</li>
  <li><strong>Price Range:</strong> [Price range or tier]</li>
  <li><strong>Known For:</strong> [Unique strengths or reputation]</li>
</ul>
[Repeat <h3>/<ul> blocks for EVERY business in the research data — minimum 7 businesses]
${brandName ? `<h3><strong>About ${brandName}</strong></h3>\n<p>[2–3 sentences naturally describing ${brandName}, its location, services, and why customers choose it.]</p>` : ''}

<h2><strong>How Do These Providers Compare?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence summary of what differentiates the options.]</p>
<table>
  <thead><tr><th>Provider</th><th>Location</th><th>Price Range</th><th>Best For</th></tr></thead>
  <tbody>
    ${brandName ? `<tr><td><strong>${brandName}</strong></td><td>[Location]</td><td>[Price]</td><td>[Best for]</td></tr>` : ''}
    <tr><td>[Business 2]</td><td>[Location]</td><td>[Price]</td><td>[Best for]</td></tr>
    <tr><td>[Business 3]</td><td>[Location]</td><td>[Price]</td><td>[Best for]</td></tr>
    <tr><td>[Business 4]</td><td>[Location]</td><td>[Price]</td><td>[Best for]</td></tr>
    <tr><td>[Business 5]</td><td>[Location]</td><td>[Price]</td><td>[Best for]</td></tr>
    <tr><td>[Business 6]</td><td>[Location]</td><td>[Price]</td><td>[Best for]</td></tr>
    <tr><td>[Business 7]</td><td>[Location]</td><td>[Price]</td><td>[Best for]</td></tr>
  </tbody>
</table>
[IMPORTANT: Include ALL businesses from research data. Minimum 7 rows required.]

<h2><strong>How Do You Choose the Right Provider?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence summary of key selection criteria.]</p>
<p>[3–4 sentence explanation of what matters most when choosing.]</p>
<h3><strong>5 Factors to Evaluate</strong></h3>
<ol>
  <li><strong>[Factor 1]:</strong> [Explanation]</li>
  <li><strong>[Factor 2]:</strong> [Explanation]</li>
  <li><strong>[Factor 3]:</strong> [Explanation]</li>
  <li><strong>[Factor 4]:</strong> [Explanation]</li>
  <li><strong>[Factor 5]:</strong> [Explanation]</li>
</ol>
<h3><strong>Red Flags to Watch Out For</strong></h3>
<ul>
  <li>[Red flag 1]</li>
  <li>[Red flag 2]</li>
  <li>[Red flag 3]</li>
</ul>
<p>[Include an external reference — e.g. "Consumer forums like JustDial and Google Reviews are reliable sources to verify credibility before committing."]</p>

<h2><strong>What Are the Key Questions to Ask Before Hiring?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer about what to clarify upfront.]</p>
<ul>
  <li>[Question 1 with brief explanation]</li>
  <li>[Question 2 with brief explanation]</li>
  <li>[Question 3 with brief explanation]</li>
  <li>[Question 4 with brief explanation]</li>
  <li>[Question 5 with brief explanation]</li>
</ul>

STEP 5 — TLDR SUMMARY
<h2><strong>TLDR Summary</strong></h2>
<ul>
  <li>[Most important takeaway about this market]</li>
  <li>[Top recommended option and why]</li>
  <li>[Key pricing insight]</li>
  <li>[Most important selection factor]</li>
  <li>[Final actionable tip]</li>
</ul>

STEP 6 — CONCLUSION
<h2><strong>Conclusion</strong></h2>
<p>[3–4 sentences summarizing the guide. Include main keyword. Give clear next steps. ${brandName ? `Recommend ${brandName} for readers looking for a trusted option.` : ''}]</p>

STEP 7 — AUTHOR BLOCK
<hr>
<p><strong>Author:</strong> Research &amp; Editorial Team</p>
<p><strong>Expertise:</strong> Local Business &amp; Market Research</p>

${SEO_RULES}
${JSON_SCHEMA}`;
}

function buildProductPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert product reviewer and SEO content writer with deep knowledge of consumer products, e-commerce, and buying guides.

TOPIC: "${topic}"
ARTICLE TYPE: Product review and buying guide.

${GLOBAL_AI_RULES}
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE SEARCH RESEARCH — Use this as your factual base ━━━\n${researchBlock}\n\nIMPORTANT: Analyze these real search results to identify actual products. Do NOT invent fake product names.\n` : ''}
${competitorBlock ? `${competitorBlock}\n` : ''}
━━━ MANDATORY HTML OUTPUT — NO MARKDOWN ALLOWED ━━━
The "article" field MUST contain valid HTML ONLY.
NEVER output: #, ##, ###, **, __, or any Markdown syntax.
Allowed tags: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <hr> <table> <thead> <tbody> <tr> <th> <td> <a>

━━━ REQUIRED HTML ARTICLE STRUCTURE ━━━

STEP 1 — TITLE
<h1><strong>[Question-style title — e.g. "What Are the Best [Topic] to Buy in 2026?"]</strong></h1>

STEP 2 — DIRECT ANSWER
<p><strong>Direct Answer:</strong> [2–3 sentence factual answer naming top 2–3 products and what makes them stand out. Contains main keyword.]</p>

STEP 3 — TABLE OF CONTENTS
<h2><strong>Table of Contents</strong></h2>
<ul>
  <li>Why [Topic] Matters in 2026</li>
  <li>Top Products — Detailed Reviews</li>
  <li>Comparison Table</li>
  <li>What Should You Look for Before Buying?</li>
  <li>Which Product Is Right for You?</li>
  <li>TLDR Summary</li>
  <li>Conclusion</li>
</ul>

STEP 4 — BODY SECTIONS (5–8 question-based H2 sections):

<h2><strong>Why Does [Topic Category] Matter in 2026?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence direct answer about why this product category is important today.]</p>
<p>[4–6 sentence explanation — market trends, consumer demand, why buying the right one matters.]</p>
<h3><strong>Key Trends in This Category</strong></h3>
<ul>
  <li>[Trend 1 with explanation]</li>
  <li>[Trend 2 with explanation]</li>
  <li>[Trend 3 with explanation]</li>
</ul>
<p>[Include an external reference — e.g. "According to industry analysts, this segment grew by X% in 2025 driven by…"]</p>

<h2><strong>What Are the Top [Topic] Products Available?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence overview of top picks.]</p>
<p>[Overview paragraph — 3–4 sentences introducing product landscape.]</p>
${brandName ? `<h3>${brandName}</h3>
<ul>
  <li><strong>Brand:</strong> ${brandName}</li>
  <li><strong>Price Range:</strong> [Price]</li>
  <li><strong>Best For:</strong> [Ideal user]</li>
  <li><strong>Key Features:</strong> [Feature 1], [Feature 2], [Feature 3]</li>
  <li><strong>Pros:</strong> [Pro 1] | [Pro 2] | [Pro 3]</li>
  <li><strong>Cons:</strong> [Con 1] | [Con 2]</li>
</ul>` : ''}
<h3>[Product 1 Name by Brand]</h3>
<ul>
  <li><strong>Brand:</strong> [Manufacturer]</li>
  <li><strong>Price Range:</strong> [Approximate price]</li>
  <li><strong>Best For:</strong> [Ideal user/use case]</li>
  <li><strong>Key Features:</strong> [Feature 1], [Feature 2], [Feature 3], [Feature 4]</li>
  <li><strong>Pros:</strong> [Pro 1] | [Pro 2] | [Pro 3]</li>
  <li><strong>Cons:</strong> [Con 1] | [Con 2]</li>
</ul>
<h3>[Product 2 Name by Brand]</h3>
<ul>
  <li><strong>Brand:</strong> [Manufacturer]</li>
  <li><strong>Price Range:</strong> [Approximate price]</li>
  <li><strong>Best For:</strong> [Ideal user/use case]</li>
  <li><strong>Key Features:</strong> [Feature 1], [Feature 2], [Feature 3], [Feature 4]</li>
  <li><strong>Pros:</strong> [Pro 1] | [Pro 2] | [Pro 3]</li>
  <li><strong>Cons:</strong> [Con 1] | [Con 2]</li>
</ul>
[Repeat <h3>/<ul> blocks for 6–8 total products — minimum 7 required]

<h2><strong>How Do These Products Compare?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence summary of how options differ by price, features, and use case.]</p>
<table>
  <thead><tr><th>Product</th><th>Brand</th><th>Price Range</th><th>Best For</th><th>Rating</th></tr></thead>
  <tbody>
    ${brandName ? `<tr><td><strong>${brandName}</strong></td><td>${brandName}</td><td>[Price]</td><td>[Best for]</td><td>5/5</td></tr>` : ''}
    <tr><td>[Product 1]</td><td>[Brand]</td><td>[Price]</td><td>[Best for]</td><td>[Rating]</td></tr>
    <tr><td>[Product 2]</td><td>[Brand]</td><td>[Price]</td><td>[Best for]</td><td>[Rating]</td></tr>
    <tr><td>[Product 3]</td><td>[Brand]</td><td>[Price]</td><td>[Best for]</td><td>[Rating]</td></tr>
    <tr><td>[Product 4]</td><td>[Brand]</td><td>[Price]</td><td>[Best for]</td><td>[Rating]</td></tr>
    <tr><td>[Product 5]</td><td>[Brand]</td><td>[Price]</td><td>[Best for]</td><td>[Rating]</td></tr>
    <tr><td>[Product 6]</td><td>[Brand]</td><td>[Price]</td><td>[Best for]</td><td>[Rating]</td></tr>
  </tbody>
</table>
[IMPORTANT: Table must have minimum 7 rows — include all products reviewed above]

<h2><strong>What Should You Look for Before Buying [Topic]?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer covering the most critical buying factor.]</p>
<p>[3–4 sentence buying guide intro.]</p>
<h3><strong>5 Key Factors to Consider</strong></h3>
<ol>
  <li><strong>[Factor 1]:</strong> [Explanation — 2 sentences]</li>
  <li><strong>[Factor 2]:</strong> [Explanation — 2 sentences]</li>
  <li><strong>[Factor 3]:</strong> [Explanation — 2 sentences]</li>
  <li><strong>[Factor 4]:</strong> [Explanation — 2 sentences]</li>
  <li><strong>[Factor 5]:</strong> [Explanation — 2 sentences]</li>
</ol>
<h3><strong>Common Buying Mistakes to Avoid</strong></h3>
<ul>
  <li>[Mistake 1 with explanation]</li>
  <li>[Mistake 2 with explanation]</li>
  <li>[Mistake 3 with explanation]</li>
</ul>
<p>[Include an internal contextual reference — e.g. "Buyers comparing [Product A] vs [Product B] often overlook X, which significantly impacts long-term value."]</p>

<h2><strong>Which [Topic] Product Is Right for You?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer based on different buyer profiles.]</p>
<ul>
  <li><strong>Best for Budget Buyers:</strong> [Product name + reason]</li>
  <li><strong>Best for Power Users:</strong> [Product name + reason]</li>
  <li><strong>Best Overall Value:</strong> [Product name + reason]</li>
  <li><strong>Best for Beginners:</strong> [Product name + reason]</li>
</ul>

STEP 5 — TLDR SUMMARY
<h2><strong>TLDR Summary</strong></h2>
<ul>
  <li>[Best overall pick and why]</li>
  <li>[Best budget pick and why]</li>
  <li>[Most important buying factor]</li>
  <li>[Key price insight]</li>
  <li>[Final recommendation tip]</li>
</ul>

STEP 6 — CONCLUSION
<h2><strong>Conclusion</strong></h2>
<p>[3–4 sentences summarizing the guide. Include main keyword. Clear next steps for the reader. ${brandName ? `Recommend ${brandName} as a top choice.` : ''}]</p>

STEP 7 — AUTHOR BLOCK
<hr>
<p><strong>Author:</strong> Research &amp; Editorial Team</p>
<p><strong>Expertise:</strong> Product Reviews &amp; Consumer Buying Guides</p>

${SEO_RULES}
${JSON_SCHEMA}`;
}

function buildEducationalPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert educational content writer and SEO specialist who creates comprehensive, beginner-friendly guides.

TOPIC: "${topic}"
ARTICLE TYPE: Educational guide — exam prep, certification, academic syllabus, or learning content.

${GLOBAL_AI_RULES}
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE SEARCH RESEARCH — Use this as your factual base ━━━\n${researchBlock}\n\nIMPORTANT: Use the snippets above to extract real exam details, dates, syllabus, and eligibility. Do NOT invent information.\n` : ''}
${competitorBlock ? `${competitorBlock}\n` : ''}
STRICT RULES FOR THIS CATEGORY:
- Do NOT include business listings, institute comparisons, or price tables.
- Focus entirely on factual knowledge, syllabus details, preparation strategy, and actionable guidance.
- Verify ALL exam/syllabus details (official parts, subjects, governing body) — never fabricate.

━━━ MANDATORY HTML OUTPUT — NO MARKDOWN ALLOWED ━━━
The "article" field MUST contain valid HTML ONLY.
NEVER output: #, ##, ###, **, __, or any Markdown syntax.
Allowed tags: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <hr> <a>

━━━ REQUIRED HTML ARTICLE STRUCTURE ━━━

STEP 1 — TITLE
<h1><strong>[Question-style title — e.g. "What Is the Complete [Topic] Syllabus and Exam Pattern for 2026?"]</strong></h1>

STEP 2 — DIRECT ANSWER
<p><strong>Direct Answer:</strong> [2–3 sentence factual answer with verified details about the exam/topic. Contains main keyword. AI engines read this for featured snippets.]</p>

STEP 3 — TABLE OF CONTENTS
<h2><strong>Table of Contents</strong></h2>
<ul>
  <li>What Is [Topic] and Who Should Pursue It?</li>
  <li>What Is the Official Syllabus / Exam Structure?</li>
  <li>What Are the Eligibility Requirements?</li>
  <li>What Is the Exam Pattern and Marking Scheme?</li>
  <li>How Should You Prepare for [Topic]?</li>
  <li>What Are the Career Benefits?</li>
  <li>TLDR Summary</li>
  <li>Conclusion</li>
</ul>

STEP 4 — BODY SECTIONS (5–8 question-based H2 sections):

<h2><strong>What Is [Topic] and Who Should Pursue It?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence factual answer defining the topic and its target audience.]</p>
<p>[4–6 sentence explanation — what it is, governing body, global/national recognition, who benefits.]</p>
<h3><strong>Who Is This Designed For?</strong></h3>
<ul>
  <li>[Target audience 1 with explanation]</li>
  <li>[Target audience 2 with explanation]</li>
  <li>[Target audience 3 with explanation]</li>
</ul>
<p>[Include an external reference — e.g. "According to [Official Body/Publication], this certification is recognized in over X countries and held by Y+ professionals worldwide."]</p>

<h2><strong>What Is the Official Syllabus and Exam Structure?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence factual answer naming the official parts/subjects.]</p>
<p>[4–6 sentence explanation of the complete verified syllabus structure.]</p>
<h3><strong>Core Subject Areas</strong></h3>
<ul>
  <li><strong>[Subject/Part 1]:</strong> [Verified description — 1–2 sentences]</li>
  <li><strong>[Subject/Part 2]:</strong> [Verified description — 1–2 sentences]</li>
  <li><strong>[Subject/Part 3]:</strong> [Verified description — 1–2 sentences]</li>
  <li><strong>[Subject/Part 4]:</strong> [Verified description — 1–2 sentences]</li>
</ul>
<h3><strong>Topic-by-Topic Breakdown</strong></h3>
<ul>
  <li>[Specific topic 1 within Part 1]</li>
  <li>[Specific topic 2 within Part 1]</li>
  <li>[Specific topic 3 within Part 2]</li>
  <li>[Specific topic 4 within Part 2]</li>
</ul>

<h2><strong>What Are the Eligibility Requirements?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence factual answer about who can apply.]</p>
<p>[3–4 sentence explanation of official eligibility criteria.]</p>
<h3><strong>Minimum Qualifications Required</strong></h3>
<ul>
  <li>[Official requirement 1]</li>
  <li>[Official requirement 2]</li>
  <li>[Official requirement 3]</li>
</ul>
<h3><strong>Work Experience Requirements</strong></h3>
<ul>
  <li>[Experience requirement 1]</li>
  <li>[Experience requirement 2]</li>
</ul>

<h2><strong>What Is the Exam Pattern and Marking Scheme?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence factual answer about format and scoring.]</p>
<p>[3–4 sentence explanation of the official exam format.]</p>
<h3><strong>Exam Format Details</strong></h3>
<ul>
  <li><strong>Number of Parts/Sections:</strong> [Verified number]</li>
  <li><strong>Question Types:</strong> [MCQ / Essay / Case Study — verified]</li>
  <li><strong>Duration:</strong> [Official exam duration]</li>
  <li><strong>Pass Mark:</strong> [Official pass percentage or score — verified]</li>
  <li><strong>Exam Window:</strong> [When exams are held — verified]</li>
</ul>
<p>[Include an internal contextual reference — e.g. "Candidates often compare [Topic] with [Related Certification] — both require rigorous preparation but differ in focus areas."]</p>

<h2><strong>How Should You Prepare for [Topic]?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer about the most effective preparation approach.]</p>
<p>[3–4 sentence intro to preparation strategy.]</p>
<h3><strong>Step-by-Step Study Plan</strong></h3>
<ol>
  <li><strong>Step 1 — [Action]:</strong> [What to do, why it matters, time allocation]</li>
  <li><strong>Step 2 — [Action]:</strong> [What to do, why it matters, time allocation]</li>
  <li><strong>Step 3 — [Action]:</strong> [What to do, why it matters, time allocation]</li>
  <li><strong>Step 4 — [Action]:</strong> [What to do, why it matters, time allocation]</li>
  <li><strong>Step 5 — [Action]:</strong> [What to do, why it matters, time allocation]</li>
  <li><strong>Step 6 — [Action]:</strong> [Mock tests and revision strategy]</li>
</ol>
<h3><strong>Common Preparation Mistakes to Avoid</strong></h3>
<ul>
  <li>[Mistake 1 — explain why it happens and how to fix it]</li>
  <li>[Mistake 2 — explain why it happens and how to fix it]</li>
  <li>[Mistake 3 — explain why it happens and how to fix it]</li>
</ul>

<h2><strong>What Are the Career Benefits After Completing [Topic]?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer about career impact.]</p>
<p>[3–4 sentence overview of career opportunities and salary impact.]</p>
<h3><strong>Career Paths Available</strong></h3>
<ul>
  <li>[Career path 1 with description]</li>
  <li>[Career path 2 with description]</li>
  <li>[Career path 3 with description]</li>
</ul>
<h3><strong>Salary and Industry Demand</strong></h3>
<ul>
  <li>[Salary range or data point 1]</li>
  <li>[Industry demand insight 2]</li>
  <li>[Geography or sector insight 3]</li>
</ul>

${brandName ? `<h2><strong>How Does ${brandName} Help with [Topic] Preparation?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer about what ${brandName} offers for this topic.]</p>
<p>[2–3 sentences naturally describing ${brandName}'s program, instructors, materials, and success rates. Do not make it sound like an ad.]</p>
<h3><strong>What ${brandName} Offers</strong></h3>
<ul>
  <li>[Feature/offering 1]</li>
  <li>[Feature/offering 2]</li>
  <li>[Feature/offering 3]</li>
</ul>` : ''}

STEP 5 — TLDR SUMMARY
<h2><strong>TLDR Summary</strong></h2>
<ul>
  <li>[What [Topic] is and its governing body]</li>
  <li>[Number of parts/subjects — verified fact]</li>
  <li>[Eligibility requirement]</li>
  <li>[Most important preparation tip]</li>
  <li>[Career benefit or salary insight]</li>
</ul>

STEP 6 — CONCLUSION
<h2><strong>Conclusion</strong></h2>
<p>[3–4 sentences summarizing the guide. Include main keyword. Encourage the reader with clear next steps. ${brandName ? `Mention ${brandName} as a preparation resource.` : ''}]</p>

STEP 7 — AUTHOR BLOCK
<hr>
<p><strong>Author:</strong> Research &amp; Editorial Team</p>
<p><strong>Expertise:</strong> Educational Certifications &amp; Exam Preparation</p>

${SEO_RULES}
${JSON_SCHEMA}`;
}

function buildInformationalPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert informational content writer and SEO specialist who creates authoritative, well-researched articles.

TOPIC: "${topic}"
ARTICLE TYPE: Informational / educational article covering concepts, benefits, tips, and evidence.

${GLOBAL_AI_RULES}
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE SEARCH RESEARCH — Use this as your factual base ━━━\n${researchBlock}\n\nIMPORTANT: Use the snippets above to ground your article in real information. Reference data and insights from the research.\n` : ''}
${competitorBlock ? `${competitorBlock}\n` : ''}
━━━ MANDATORY HTML OUTPUT — NO MARKDOWN ALLOWED ━━━
The "article" field MUST contain valid HTML ONLY.
NEVER output: #, ##, ###, **, __, or any Markdown syntax.
Allowed tags: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <hr> <a>

━━━ REQUIRED HTML ARTICLE STRUCTURE ━━━

STEP 1 — TITLE
<h1><strong>[Question-style title — e.g. "What Is [Topic] and Why Does It Matter in 2026?"]</strong></h1>

STEP 2 — DIRECT ANSWER
<p><strong>Direct Answer:</strong> [2–3 sentence factual answer defining the topic and its primary importance. Contains main keyword.]</p>

STEP 3 — TABLE OF CONTENTS
<h2><strong>Table of Contents</strong></h2>
<ul>
  <li>What Is [Topic]?</li>
  <li>What Are the Key Benefits?</li>
  <li>What Does the Research Say?</li>
  <li>What Are the Practical Applications?</li>
  <li>What Are Common Myths?</li>
  <li>TLDR Summary</li>
  <li>Conclusion</li>
</ul>

STEP 4 — BODY SECTIONS (5–8 question-based H2 sections):

<h2><strong>What Is [Topic] and Why Does It Matter?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence direct definition with context.]</p>
<p>[4–6 sentence explanation — background, history, how it works, current relevance in 2026.]</p>
<h3><strong>Core Concepts Explained</strong></h3>
<ul>
  <li><strong>[Concept 1]:</strong> [Clear 1–2 sentence explanation]</li>
  <li><strong>[Concept 2]:</strong> [Clear 1–2 sentence explanation]</li>
  <li><strong>[Concept 3]:</strong> [Clear 1–2 sentence explanation]</li>
</ul>
<p>[Include an external reference — e.g. "Research published in [Journal/Organization] shows that X, reinforcing the importance of understanding this topic."]</p>

<h2><strong>What Are the Key Benefits of [Topic]?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence summary of top 2–3 benefits.]</p>
<p>[3–4 sentence overview of why these benefits matter.]</p>
<h3><strong>[Benefit 1 Name]</strong></h3>
<p>[2–3 sentences explaining this benefit with evidence or a real-world example.]</p>
<h3><strong>[Benefit 2 Name]</strong></h3>
<p>[2–3 sentences explaining this benefit with evidence or a real-world example.]</p>
<h3><strong>[Benefit 3 Name]</strong></h3>
<p>[2–3 sentences explaining this benefit with evidence or a real-world example.]</p>
<h3><strong>[Benefit 4 Name]</strong></h3>
<p>[2–3 sentences explaining this benefit with evidence or a real-world example.]</p>
<h3><strong>[Benefit 5 Name]</strong></h3>
<p>[2–3 sentences explaining this benefit with evidence or a real-world example.]</p>

<h2><strong>What Does the Research and Expert Evidence Say?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence summary of what experts/studies say about this topic.]</p>
<p>[4–6 sentence explanation of research findings, expert consensus, and verified statistics.]</p>
<h3><strong>Key Studies and Statistics</strong></h3>
<ul>
  <li>[Statistic or finding 1 — include source if known]</li>
  <li>[Statistic or finding 2 — include source if known]</li>
  <li>[Statistic or finding 3 — include source if known]</li>
  <li>[Expert opinion or recommendation]</li>
</ul>
<p>[Include an internal contextual reference — e.g. "This aligns with related research on [connected topic], which shows that X and Y are closely linked."]</p>

<h2><strong>How Can You Apply [Topic] Practically?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer about immediate, actionable ways to apply this knowledge.]</p>
<p>[3–4 sentence intro to practical applications.]</p>
<h3><strong>7 Actionable Tips for Immediate Results</strong></h3>
<ol>
  <li><strong>[Tip 1]:</strong> [What to do and why — 2 sentences]</li>
  <li><strong>[Tip 2]:</strong> [What to do and why — 2 sentences]</li>
  <li><strong>[Tip 3]:</strong> [What to do and why — 2 sentences]</li>
  <li><strong>[Tip 4]:</strong> [What to do and why — 2 sentences]</li>
  <li><strong>[Tip 5]:</strong> [What to do and why — 2 sentences]</li>
  <li><strong>[Tip 6]:</strong> [What to do and why — 2 sentences]</li>
  <li><strong>[Tip 7]:</strong> [What to do and why — 2 sentences]</li>
</ol>

<h2><strong>What Are the Common Myths About [Topic]?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer about the most widespread misconception.]</p>
<p>[2–3 sentence intro explaining why myths form around this topic.]</p>
<h3><strong>Myths vs Reality</strong></h3>
<ul>
  <li><strong>Myth 1:</strong> [Myth statement] → <strong>Reality:</strong> [Factual correction]</li>
  <li><strong>Myth 2:</strong> [Myth statement] → <strong>Reality:</strong> [Factual correction]</li>
  <li><strong>Myth 3:</strong> [Myth statement] → <strong>Reality:</strong> [Factual correction]</li>
  <li><strong>Myth 4:</strong> [Myth statement] → <strong>Reality:</strong> [Factual correction]</li>
</ul>

${brandName ? `<h2><strong>How Does ${brandName} Help with [Topic]?</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence answer about ${brandName}'s role in this topic area.]</p>
<p>[2–3 sentences naturally describing ${brandName}, its offerings, and why it is a credible resource. Informative, not promotional.]</p>
<h3><strong>What ${brandName} Provides</strong></h3>
<ul>
  <li>[Relevant service or feature 1]</li>
  <li>[Relevant service or feature 2]</li>
  <li>[Relevant service or feature 3]</li>
</ul>` : ''}

STEP 5 — TLDR SUMMARY
<h2><strong>TLDR Summary</strong></h2>
<ul>
  <li>[Core definition of [Topic] in one clear sentence]</li>
  <li>[Top benefit with brief reason]</li>
  <li>[Key research or expert finding]</li>
  <li>[Most actionable practical tip]</li>
  <li>[Final motivational or next-step insight]</li>
</ul>

STEP 6 — CONCLUSION
<h2><strong>Conclusion</strong></h2>
<p>[3–4 sentences summarizing the article. Include main keyword. Motivational closing. Clear call to action or next steps. ${brandName ? `Recommend ${brandName} as a resource.` : ''}]</p>

STEP 7 — AUTHOR BLOCK
<hr>
<p><strong>Author:</strong> Research &amp; Editorial Team</p>
<p><strong>Expertise:</strong> Informational Research &amp; SEO Content Strategy</p>

${SEO_RULES}
${JSON_SCHEMA}`;
}

function buildDefaultPrompt(topic: string, brandName?: string, researchBlock?: string, competitorBlock?: string): string {
  return `You are an expert SEO content writer and researcher. Analyze the topic and automatically determine the best article structure.

TOPIC: "${topic}"
ARTICLE TYPE: Auto-detect and write the best-fit article (listicle, guide, review, comparison, how-to, etc.)

${GLOBAL_AI_RULES}
${brandBoostBlock(brandName)}
${researchBlock ? `━━━ GOOGLE SEARCH RESEARCH — Use this as your factual base ━━━\n${researchBlock}\n` : ''}
${competitorBlock ? `${competitorBlock}\n` : ''}
━━━ MANDATORY HTML OUTPUT — NO MARKDOWN ALLOWED ━━━
The "article" field MUST contain valid HTML ONLY.
NEVER output: #, ##, ###, **, __, or any Markdown syntax.
Allowed tags: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <hr> <table> <thead> <tbody> <tr> <th> <td> <a>

━━━ INSTRUCTIONS ━━━
1. Read the topic carefully and identify the best article type (listicle, guide, review, how-to, comparison, informational, local, etc.)
2. Use natural, topic-specific headings — do NOT copy a generic template
3. Include specific, accurate, helpful information — real names, real data, real examples
4. Minimum 1200 words (target 1200–1400)

━━━ REQUIRED HTML ARTICLE STRUCTURE ━━━

STEP 1 — TITLE
<h1><strong>[Question-style title most relevant to the topic]</strong></h1>

STEP 2 — DIRECT ANSWER
<p><strong>Direct Answer:</strong> [2–3 sentence factual answer. Contains main keyword. Optimized for AI featured snippets.]</p>

STEP 3 — TABLE OF CONTENTS
<h2><strong>Table of Contents</strong></h2>
<ul>
  <li>[5–7 section titles matching your chosen structure]</li>
  <li>TLDR Summary</li>
  <li>Conclusion</li>
</ul>

STEP 4 — BODY SECTIONS
Choose the structure that best fits the topic, then write 5–7 question-based H2 sections.
Each section MUST follow this pattern:

<h2><strong>[Question heading ending with ?]</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence direct answer — featured snippet format]</p>
<p>[Detailed explanation — 4–6 sentences with verified facts and specific details]</p>
<h3><strong>[Relevant subsection]</strong></h3>
<ul>
  <li>[Specific verified point]</li>
  <li>[Specific verified point]</li>
  <li>[Specific verified point]</li>
</ul>
<p>[Add contextual reference here — comparison to related topic, named source, or expert opinion]</p>

CONTENT DEPTH REQUIREMENTS per section:
- Every section must add distinct value — no filler or generic statements
- Include at least one list (<ul> or <ol>) per H2 section
- Include at least one H3 subsection per H2 section
- Include at least one internal contextual reference (comparison or related topic)
- Include at least one external reference (named source, publication, official body, or platform)

${brandName ? `BRAND SECTION (required):
<h2><strong>About ${brandName}</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence intro to ${brandName} and its relevance to the topic.]</p>
<p>[2–3 sentences naturally describing ${brandName}, its offerings, and why users trust it. Informative, not promotional.]</p>
<h3><strong>Why Choose ${brandName}?</strong></h3>
<ul>
  <li>[Strength or feature 1]</li>
  <li>[Strength or feature 2]</li>
  <li>[Strength or feature 3]</li>
</ul>` : ''}

STEP 5 — TLDR SUMMARY
<h2><strong>TLDR Summary</strong></h2>
<ul>
  <li>[Most important takeaway]</li>
  <li>[Second key insight]</li>
  <li>[Third key point]</li>
  <li>[Fourth actionable tip]</li>
  <li>[Final recommendation or next step]</li>
</ul>

STEP 6 — CONCLUSION
<h2><strong>Conclusion</strong></h2>
<p>[3–4 sentences. Summarize the article. Include main keyword. Clear next steps or call to action. ${brandName ? `Recommend ${brandName}.` : ''}]</p>

STEP 7 — AUTHOR BLOCK
<hr>
<p><strong>Author:</strong> Research &amp; Editorial Team</p>
<p><strong>Expertise:</strong> [Auto-detect the most relevant domain for this topic]</p>

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
        const data = await fetchLocalBusinessesCombined(topic, brandName);
        return formatCombinedLocalResearch(data);
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
  return `You are a subject matter expert and professional SEO content writer with verified knowledge across all industries, certifications, and academic topics.

TOPIC: "${topic}"
${brandBoostBlock(brandName)}
${GLOBAL_AI_RULES}

━━━ DEEP RESEARCH INSTRUCTIONS ━━━
No external search data is available. Use your full verified training knowledge to:

• Research the topic thoroughly — especially if it involves exams, certifications, or syllabi
• Verify ALL factual details (exam parts, subject names, governing bodies, eligibility) before writing
• Include specific verified facts, official data, and real-world context
• Cover topic from multiple angles: what it is, why it matters, how to prepare/use it, career impact
• Every paragraph must add distinct value — no filler, no generic statements
• For exam/certification topics include: eligibility, syllabus breakdown, exam pattern, preparation tips, career benefits

━━━ MANDATORY HTML OUTPUT — NO MARKDOWN ALLOWED ━━━
The "article" field MUST contain valid HTML ONLY.
NEVER output: #, ##, ###, **, __, or any Markdown syntax.
Allowed tags: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <hr> <a>

━━━ REQUIRED HTML ARTICLE STRUCTURE (follow exactly in this order) ━━━

STEP 1 — TITLE
<h1><strong>[Question-style title containing main keyword — e.g. "What Is the CMA Syllabus for 2026?"]</strong></h1>

STEP 2 — DIRECT ANSWER (featured snippet target)
<p><strong>Direct Answer:</strong> [2–3 sentence factual answer. Must contain main keyword. This is what AI engines read for snippets.]</p>

STEP 3 — TABLE OF CONTENTS
<h2><strong>Table of Contents</strong></h2>
<ul>
  <li>[Section 1 title]</li>
  <li>[Section 2 title]</li>
  <li>[Section 3 title]</li>
  <li>[Section 4 title]</li>
  <li>[Section 5 title]</li>
  <li>TLDR Summary</li>
  <li>Conclusion</li>
</ul>

STEP 4 — BODY SECTIONS (minimum 5 H2 sections, each with H3 subsections)
Each H2 section MUST follow this exact pattern:

<h2><strong>[Question heading ending with ?]</strong></h2>
<p><strong>Short Answer:</strong> [1–2 sentence direct answer to the question]</p>
<p>[Detailed explanation paragraph — 4–6 sentences with verified facts]</p>
<h3><strong>[Subsection title]</strong></h3>
<ul>
  <li>[Specific verified point]</li>
  <li>[Specific verified point]</li>
  <li>[Specific verified point]</li>
</ul>
<p>[Additional explanation with contextual reference — e.g. "Students preparing for CMA often compare it with CPA or CFA certifications."]</p>

REQUIRED sections for exam/certification topics (adapt headings as questions):
• What Is [Topic] and Who Should Pursue It?
• What Is the Official Syllabus / Exam Structure?
• What Are the Eligibility Requirements?
• What Is the Exam Pattern and Marking Scheme?
• How Should You Prepare for [Topic]?
• What Are the Career Benefits After Completing [Topic]?

STEP 5 — BRAND SECTION (only if brand name provided)
<h2><strong>How ${brandName ? brandName : '[Brand Name]'} Helps You with [Topic]</strong></h2>
<p>[Explain naturally how the brand helps users prepare for or benefit from the topic. 2–3 sentences.]</p>

STEP 6 — TLDR SUMMARY
<h2><strong>TLDR Summary</strong></h2>
<ul>
  <li>[Key takeaway 1 — most important fact]</li>
  <li>[Key takeaway 2]</li>
  <li>[Key takeaway 3]</li>
  <li>[Key takeaway 4]</li>
  <li>[Key takeaway 5]</li>
</ul>

STEP 7 — CONCLUSION
<h2><strong>Conclusion</strong></h2>
<p>[Summary paragraph with actionable next steps. Include main keyword naturally. 3–4 sentences.]</p>

STEP 8 — AUTHOR BLOCK
<hr>
<p><strong>Author:</strong> Research &amp; Editorial Team</p>
<p><strong>Expertise:</strong> [relevant domain — e.g. Finance Certifications, Digital Marketing, etc.]</p>

━━━ SEO & CONTENT RULES ━━━
- Target 1000–1400 words exactly. Every section must earn its place.
- Include main keyword in: H1, first paragraph, at least 3 H2 headings, conclusion
- Use semantic keyword variations throughout
- Include at least one contextual comparison or reference link statement
- Add 2026 context where relevant
- Every section needs real content — no one-line sections
- Do NOT generate a FAQ section

${SEO_RULES}
${JSON_SCHEMA}`;
}

// ── Editor AI action entry point ──────────────────────────────────────────────

export type EditorActionType = 'faq' | 'list' | 'table' | 'edit';

function buildEditorPrompt(
  actionType: EditorActionType,
  articleTitle: string,
  articleContent: string,
  userInstruction?: string,
): string {
  // Strip HTML tags for a clean plain-text context snippet
  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const contextSnippet = stripHtml(articleContent).slice(0, 1500);

  switch (actionType) {
    case 'faq':
      return `You are an SEO content specialist. Generate a structured FAQ section for the article below.

Topic: "${articleTitle}"
Context: ${contextSnippet}

Rules:
- Create 5–7 questions that real users search for about this topic
- Answers must be 40–80 words each — direct and informative
- Output ONLY valid HTML — no Markdown whatsoever
- No introductory text, no commentary — just the HTML block

Required output structure:
<h2><strong>Frequently Asked Questions</strong></h2>
<h3>Question 1?</h3>
<p>Answer 1.</p>
<h3>Question 2?</h3>
<p>Answer 2.</p>
(repeat for all questions)`;

    case 'list':
      return `You are an SEO content specialist. Generate a helpful, informative list for the article below.

Topic: "${articleTitle}"
Context: ${contextSnippet}

Rules:
- Create 6–8 items with brief explanations (1–2 sentences each)
- Choose <ul> or <ol> based on what suits the topic
- Output ONLY valid HTML — no Markdown whatsoever
- No introductory text, no commentary — just the HTML block

Required output structure:
<h2><strong>[Descriptive List Title]</strong></h2>
<ul>
  <li><strong>[Item 1]:</strong> [Explanation sentence]</li>
  <li><strong>[Item 2]:</strong> [Explanation sentence]</li>
</ul>`;

    case 'table':
      return `You are an SEO content specialist. Generate a structured comparison or data table for the article below.

Topic: "${articleTitle}"
Context: ${contextSnippet}

Rules:
- Minimum 4 columns, minimum 5 data rows
- Make the table genuinely useful — use real, relevant data or categories
- Output ONLY valid HTML — no Markdown whatsoever
- No introductory text, no commentary — just the HTML block

Required output structure:
<h2><strong>[Descriptive Table Title]</strong></h2>
<table>
  <thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th><th>Column 4</th></tr></thead>
  <tbody>
    <tr><td>...</td><td>...</td><td>...</td><td>...</td></tr>
  </tbody>
</table>`;

    case 'edit':
      return `You are an expert HTML content editor.

Instruction: ${userInstruction || 'Improve the article quality, readability, and SEO.'}

Article HTML:
${articleContent.slice(0, 5000)}

Rules:
- Apply the instruction exactly as stated
- Return ONLY the updated HTML article — no explanations, no commentary
- Preserve all valid HTML structure
- Do NOT use Markdown — output valid HTML only`;

    default:
      throw new Error(`Unknown editor action: ${actionType}`);
  }
}

/**
 * Runs an AI editor action (FAQ / List / Table / Edit) using Groq.
 * Returns clean HTML ready to insert into the contentEditable editor.
 */
export const runEditorAction = async (
  actionType: EditorActionType,
  articleTitle: string,
  articleContent: string,
  userInstruction?: string,
): Promise<string> => {
  const prompt = buildEditorPrompt(actionType, articleTitle, articleContent, userInstruction);
  const maxTokens = actionType === 'edit' ? 6144 : 2048;

  const response = await callGroq(
    [{ role: 'user', content: prompt }],
    { max_tokens: maxTokens },
  );

  const raw = response.choices[0]?.message?.content || '';
  return cleanArticleHtml(raw.trim());
};

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
        { response_format: { type: 'json_object' }, max_tokens: 8192 },
      );
      const text = response.choices[0]?.message?.content || '';
      const result = JSON.parse(text) as SeoArticleResult;
      result.article = cleanArticleHtml(result.article);
      return result;
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
      { response_format: { type: 'json_object' }, max_tokens: 8192 },
    );
    const text = response.choices[0]?.message?.content || '';
    const result = JSON.parse(text) as SeoArticleResult;
    result.article = cleanArticleHtml(result.article);
    return result;
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
