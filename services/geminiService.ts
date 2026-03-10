
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
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

// Always use named parameter for apiKey
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const groq = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY, dangerouslyAllowBrowser: true });

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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro-preview-05-06',
      contents: prompt,
      config: {
        // Higher thinking budget for complex reasoning tasks
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });
    // Use .text property to get the generated content
    return response.text;
  } catch (error) {
    console.error("Agent reasoning failed:", error);
    return "Agent encountered a processing error. Retrying autonomous scan...";
  }
};

export const fetchAutonomousMarketScan = async (channel: string) => {
  const prompt = `Autonomous scan of ${channel} market trends. Identify one critical opportunity for an agent to execute today.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    return response.text;
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    return response.text || '';
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      uri: chunk.web?.uri || '',
      title: chunk.web?.title || 'Source'
    })).filter((s: any) => s.uri) || [];

    return {
      summary: response.text || 'No live data found.',
      sources: sources
    };
  } catch (groundingError) {
    const quotaMsg = parseQuotaError(groundingError);

    // If quota error, try without grounding (uses different quota bucket)
    if (quotaMsg) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });
        return {
          summary: response.text || 'No data found.',
          sources: []
        };
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      analysis: response.text || 'Audit analysis unavailable.',
      sources: sources
    };
  } catch (error) {
    console.error("SEO Audit failed:", error);
    throw error;
  }
};

/**
 * Added suggestSocialContent to fix export error in SocialHubPanel
 */
export const generateSeoBlogArticle = async (topic: string): Promise<SeoArticleResult> => {
  const prompt = `You are an expert SEO content strategist and writer. Generate a comprehensive, fully SEO-optimized blog article for this topic: "${topic}".

Return ONLY valid JSON with no markdown fences, no extra text, no explanation — just the raw JSON object.

Use this exact structure:
{
  "title": "Compelling, click-worthy article title",
  "seoTitle": "SEO-optimized title under 60 characters",
  "metaDescription": "Compelling meta description between 150-160 characters that includes the primary keyword",
  "urlSlug": "url-friendly-slug-using-primary-keyword",
  "primaryKeyword": "the single most important keyword phrase",
  "secondaryKeywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "lsiKeywords": ["lsi1", "lsi2", "lsi3", "lsi4", "lsi5", "lsi6"],
  "article": "FULL ARTICLE TEXT HERE — minimum 900 words. Use ## for H2 headings. Use ### for H3 sub-headings where appropriate. Structure: one intro paragraph (2-3 sentences with primary keyword in first 100 words), 5-6 H2 sections each with 2-3 paragraphs (150-200 words per section), and a ## Conclusion section. Separate paragraphs with blank lines. Naturally weave the primary keyword and secondary keywords throughout.",
  "seoScore": 87,
  "readingTime": 5,
  "wordCount": 1050,
  "keywordDensity": 1.6,
  "rankingExplanation": "Detailed paragraph (200+ words) explaining why this article can rank on Google's first page. Cover: (1) Search intent alignment — how the article matches what the user actually wants, (2) Keyword placement strategy — title, meta, first 100 words, H2s, throughout body, (3) Content depth & E-E-A-T signals — comprehensiveness, authority, expertise demonstrated, (4) Semantic SEO — LSI keywords, topical coverage, related entities covered, (5) Heading structure — logical H2/H3 hierarchy and how it helps both users and crawlers."
}

Requirements:
- article field must be 900+ words of real, useful content
- seoScore is integer 0-100
- readingTime is integer minutes (assume 200 words/min)
- wordCount is integer (actual count of article field)
- keywordDensity is float percentage (primary keyword occurrences / total words * 100)`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const text = response.choices[0]?.message?.content || '';
    return JSON.parse(text) as SeoArticleResult;
  } catch (error) {
    console.error('SEO Blog generation failed:', error);
    throw error;
  }
};

export const suggestSocialContent = async (topic: string, platforms: string): Promise<string> => {
  const prompt = `Suggest creative and engaging social media content ideas for the following topic: "${topic}" across these platforms: ${platforms}. Include hooks and call-to-actions.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    return response.text || '';
  } catch (error) {
    console.error("Social content suggestion failed:", error);
    return "Failed to generate suggestions.";
  }
};
