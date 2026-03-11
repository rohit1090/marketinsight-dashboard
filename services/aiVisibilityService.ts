import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

const BRAND = 'MarketInsight';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

export interface VisibilityResult {
  id?: string;
  query: string;
  model: string;
  mentioned: boolean;
  rank: number;
  sentiment: string;
  context: string;
  timestamp: number;
}

export interface VisibilityMetrics {
  shareOfVoice: number;
  brandSentiment: string;
  totalCitations: number;
  byModel: { model: string; visibility: number; total: number }[];
  change: number;
}

export const AUTO_QUERIES = [
  'best SEO tools',
  'best marketing analytics dashboards',
  'semrush alternatives',
  'best seo reporting tools',
  'top analytics platforms',
  'marketing intelligence software',
  'competitor analysis tools',
];

// ── Groq API call ─────────────────────────────────────────────────────────────

async function callGroq(userQuery: string): Promise<string> {
  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `What are the best tools for ${userQuery}? List the top 10 with brief descriptions. Number each tool.`,
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Analysis helpers ──────────────────────────────────────────────────────────

function detectMention(text: string): boolean {
  return text.toLowerCase().includes(BRAND.toLowerCase());
}

function detectRank(text: string): number {
  // Primary: line-by-line scan — trim whitespace and strip bold markdown before matching
  // Handles: "3. MarketInsight", "  3. **MarketInsight**", "**3.** MarketInsight"
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\*{0,2}(\d+)[.)]\*{0,2}\s*(.*)/);
    if (match) {
      const content = match[2].replace(/\*/g, '').toLowerCase();
      if (content.includes(BRAND.toLowerCase())) {
        return parseInt(match[1], 10);
      }
    }
  }

  // Fallback: global scan for any "N. ... Brand ..." pattern across the full text
  for (const m of text.matchAll(/(\d+)[.)]\s*([^\n]*)/g)) {
    const content = m[2].replace(/\*/g, '').toLowerCase();
    if (content.includes(BRAND.toLowerCase())) {
      return parseInt(m[1], 10);
    }
  }

  return -1;
}

function detectSentiment(text: string, mentioned: boolean): string {
  if (!mentioned) return 'Neutral';
  const brandIdx = text.toLowerCase().indexOf(BRAND.toLowerCase());
  const window = text.slice(Math.max(0, brandIdx - 120), brandIdx + 240).toLowerCase();
  const pos = ['best', 'recommended', 'top', 'powerful', 'excellent', 'leading', 'popular', 'great'].filter(w => window.includes(w)).length;
  const neg = ['bad', 'weak', 'limited', 'poor', 'outdated', 'slow', 'expensive'].filter(w => window.includes(w)).length;
  if (pos > neg) return 'Positive';
  if (neg > pos) return 'Negative';
  return 'Neutral';
}

function extractContext(text: string, mentioned: boolean): string {
  if (!mentioned) return text.trim();
  const idx = text.toLowerCase().indexOf(BRAND.toLowerCase());
  return text.slice(Math.max(0, idx - 60), idx + 600).trim();
}

// ── Core check ────────────────────────────────────────────────────────────────

export async function checkVisibility(
  userQuery: string,
  model = 'groq',
): Promise<VisibilityResult> {
  let text = '';
  try {
    text = await callGroq(userQuery);
  } catch (err) {
    console.error('Groq call failed, retrying…', err);
    try {
      text = await callGroq(userQuery);
    } catch (err2) {
      console.error('Groq retry also failed:', err2);
      text = '';
    }
  }

  console.log('AI response:', text);

  const mentioned  = detectMention(text);
  const rank       = detectRank(text);
  const sentiment  = detectSentiment(text, mentioned);
  const context    = extractContext(text, mentioned);

  console.log('Detected rank:', rank);

  const result: VisibilityResult = {
    query: userQuery,
    model,
    mentioned,
    rank,
    sentiment,
    context,
    timestamp: Date.now(),
  };

  try {
    // Explicitly write each field so rank is always saved as a number (never undefined/string)
    const ref = await addDoc(collection(db, 'ai_visibility_queries'), {
      query:     result.query,
      model:     result.model,
      mentioned: result.mentioned,
      rank:      Number(result.rank),
      sentiment: result.sentiment,
      context:   result.context,
      timestamp: result.timestamp,
    });
    result.id = ref.id;
  } catch (e) {
    console.error('Firestore write failed:', e);
  }

  return result;
}

// ── Auto batch run ────────────────────────────────────────────────────────────

export async function runAutoVisibilityCheck(
  onProgress?: (result: VisibilityResult, done: number, total: number) => void,
): Promise<VisibilityResult[]> {
  const results: VisibilityResult[] = [];
  for (let i = 0; i < AUTO_QUERIES.length; i++) {
    const result = await checkVisibility(AUTO_QUERIES[i], 'groq');
    results.push(result);
    onProgress?.(result, i + 1, AUTO_QUERIES.length);
    // small delay to avoid rate limiting
    if (i < AUTO_QUERIES.length - 1) await new Promise(r => setTimeout(r, 800));
  }
  return results;
}

// ── Load from Firestore ───────────────────────────────────────────────────────

export async function loadVisibilityData(): Promise<VisibilityResult[]> {
  const snap = await getDocs(
    query(collection(db, 'ai_visibility_queries'), orderBy('timestamp', 'desc'), limit(100)),
  );
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VisibilityResult));
}

// ── Metrics calculation ───────────────────────────────────────────────────────

export function calculateMetrics(data: VisibilityResult[]): VisibilityMetrics {
  const total     = data.length;
  const mentioned = data.filter(d => d.mentioned);
  const shareOfVoice   = total > 0 ? Math.round((mentioned.length / total) * 100) : 0;
  const posCount       = mentioned.filter(d => d.sentiment === 'Positive').length;
  const brandSentiment = mentioned.length === 0 ? 'Neutral'
    : posCount >= mentioned.length * 0.6 ? 'Positive'
    : posCount <= mentioned.length * 0.3 ? 'Negative'
    : 'Mixed';
  const totalCitations = mentioned.length;

  // Group by model for chart
  const modelNames = [...new Set(data.map(d => d.model))];
  const byModel = modelNames.map(m => {
    const md = data.filter(d => d.model === m);
    const mm = md.filter(d => d.mentioned).length;
    return { model: m, visibility: md.length > 0 ? Math.round((mm / md.length) * 100) : 0, total: md.length };
  });

  return { shareOfVoice, brandSentiment, totalCitations, byModel, change: 0 };
}
