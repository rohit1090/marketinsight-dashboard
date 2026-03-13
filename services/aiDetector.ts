/**
 * services/aiDetector.ts
 *
 * Client-side AI content detection engine.
 * Analyses text patterns to estimate AI vs human authorship probability
 * using three orthogonal signals: Burstiness, Perplexity, and Repetition.
 */

export interface AiDetectionResult {
  aiProbability: number;    // 0–100
  humanProbability: number; // 0–100
  perplexity: number;       // 0–100  (higher = more human-like vocab variety)
  burstiness: number;       // 0–100  (higher = more human-like sentence variation)
  repetition: number;       // 0–100  (higher = more AI-like phrase repetition)
  riskLevel: 'low' | 'medium' | 'high';
}

// Phrases strongly associated with AI-generated text
const AI_PHRASE_PATTERNS = [
  'in conclusion', 'furthermore', 'moreover', 'it is important to note',
  'it is worth noting', 'in summary', 'to summarize', 'as mentioned above',
  'in addition', 'on the other hand', 'last but not least', 'without further ado',
  'it goes without saying', 'needless to say', 'at the end of the day',
  'it is crucial to', 'it is essential to', 'it should be noted',
  'delve into', 'dive deep', 'in today\'s digital', 'in today\'s world',
  'comprehensive guide', 'let\'s explore', 'let us explore',
  'when it comes to', 'having said that', 'with that being said',
  'first and foremost', 'rest assured', 'without a doubt',
];

/** Strip HTML tags and return clean plain text */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Tokenize text into sentences (strips empties / very short fragments) */
function tokenizeSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 4); // ignore ultra-short fragments
}

/** Tokenize text into word tokens (lowercase, alpha only) */
function tokenizeWords(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
}

/**
 * BURSTINESS — measures sentence-length variation.
 * Human writers mix very short and very long sentences (high CV).
 * AI writers produce uniform sentence lengths (low CV).
 * Returns 0–100, where 100 = very human-like variation.
 */
function computeBurstiness(sentences: string[]): number {
  if (sentences.length < 3) return 50;
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) return 50;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100; // Coefficient of Variation
  // CV > 40 → very human-like; CV < 15 → very AI-like
  return Math.min(100, Math.max(0, Math.round((cv / 40) * 100)));
}

/**
 * PERPLEXITY (approximated) — measures vocabulary diversity.
 * High Type–Token Ratio (TTR) and varied sentence starters → more human.
 * Returns 0–100, where 100 = highly varied and human-like.
 */
function computePerplexity(words: string[], sentences: string[]): number {
  if (words.length < 20) return 50;

  // Type-Token Ratio (unique words / total words), capped relevance at 200 words
  const sampleWords = words.slice(0, 200);
  const uniqueWords = new Set(sampleWords);
  const ttr = uniqueWords.size / sampleWords.length; // 0–1

  // Sentence-starter variety
  const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase() || '');
  const uniqueStarters = new Set(starters);
  const starterVariety = uniqueStarters.size / Math.max(starters.length, 1);

  // Average word length diversity (humans use more varied word lengths)
  const wordLengths = words.map(w => w.length);
  const avgLen = wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length;
  const lenVariance = wordLengths.reduce((s, l) => s + Math.pow(l - avgLen, 2), 0) / wordLengths.length;
  const lenSD = Math.sqrt(lenVariance);
  const lenDiversity = Math.min(1, lenSD / 2);

  const perplexity = Math.round((ttr * 50 + starterVariety * 30 + lenDiversity * 20) * 100);
  return Math.min(100, Math.max(0, perplexity));
}

/**
 * REPETITION — measures bigram and trigram repetition.
 * AI text reuses the same short phrases far more than humans do.
 * Returns 0–100, where 100 = highly repetitive (AI-like).
 */
function computeRepetition(words: string[]): number {
  if (words.length < 10) return 0;

  // Bigrams
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  const bigramCounts = new Map<string, number>();
  bigrams.forEach(bg => bigramCounts.set(bg, (bigramCounts.get(bg) || 0) + 1));
  const repeatedBigrams = [...bigramCounts.values()].filter(c => c > 1).length;
  const bigramRepRate = repeatedBigrams / Math.max(bigrams.length, 1);

  // Trigrams
  const trigrams: string[] = [];
  for (let i = 0; i < words.length - 2; i++) {
    trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  const trigramCounts = new Map<string, number>();
  trigrams.forEach(tg => trigramCounts.set(tg, (trigramCounts.get(tg) || 0) + 1));
  const repeatedTrigrams = [...trigramCounts.values()].filter(c => c > 1).length;
  const trigramRepRate = repeatedTrigrams / Math.max(trigrams.length, 1);

  const raw = (bigramRepRate * 0.4 + trigramRepRate * 0.6) * 400;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Main detection function.
 * Accepts raw HTML from the editor, strips tags, and returns detection scores.
 */
export function detectAiContent(html: string): AiDetectionResult {
  const text = stripHtml(html);
  if (text.length < 50) {
    return { aiProbability: 50, humanProbability: 50, perplexity: 50, burstiness: 50, repetition: 50, riskLevel: 'medium' };
  }

  const sentences = tokenizeSentences(text);
  const words = tokenizeWords(text);

  const burstiness  = computeBurstiness(sentences);
  const perplexity  = computePerplexity(words, sentences);
  const repetition  = computeRepetition(words);

  // AI-phrase bonus penalty (each detected phrase nudges AI probability up)
  const textLower = text.toLowerCase();
  const aiPhraseHits = AI_PHRASE_PATTERNS.filter(p => textLower.includes(p)).length;
  const phraseAiBoost = Math.min(25, aiPhraseHits * 4);

  // ── AI Probability Calculation ──────────────────────────────────────────────
  // Low burstiness  → more AI  (weight 35)
  // Low perplexity  → more AI  (weight 35)
  // High repetition → more AI  (weight 20)
  // AI phrase hits  → more AI  (weight 10 / phraseBoost)

  const aiBurstiness  = Math.max(0, (50 - burstiness)  / 50) * 35;
  const aiPerplexity  = Math.max(0, (50 - perplexity)  / 50) * 35;
  const aiRepetition  = (repetition / 100) * 20;

  const rawAi = aiBurstiness + aiPerplexity + aiRepetition + phraseAiBoost;

  // Clamp: we never claim 100% certainty
  const aiProbability    = Math.min(94, Math.max(6, Math.round(rawAi)));
  const humanProbability = 100 - aiProbability;

  const riskLevel: 'low' | 'medium' | 'high' =
    aiProbability >= 65 ? 'high' :
    aiProbability >= 35 ? 'medium' : 'low';

  return { aiProbability, humanProbability, perplexity, burstiness, repetition, riskLevel };
}
