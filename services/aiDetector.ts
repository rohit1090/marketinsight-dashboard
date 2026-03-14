/**
 * services/aiDetector.ts  v2
 *
 * Recalibrated AI content detection engine.
 *
 * Calibration targets (SEO blog content):
 *   Fresh LLM output  → 65–85% AI probability  (High Risk)
 *   Humanized output  → 30–52% AI probability  (Medium Risk)
 *   Genuine human     → 10–28% AI probability  (Low Risk)
 *
 * Five independent signals feed into a weighted composite score.
 * Each signal is also exposed individually for the UI.
 */

export interface AiDetectionResult {
  aiProbability: number;     // 0–100
  humanProbability: number;  // 0–100
  perplexity: number;        // 0–100  display: AI vocabulary predictability (higher = more AI-like)
  burstiness: number;        // 0–100  display: sentence variation (higher = more human)
  repetition: number;        // 0–100  display: phrase repetition  (higher = more AI-like)
  riskLevel: 'low' | 'medium' | 'high';
}

// ─── Word lists ────────────────────────────────────────────────────────────────

/** Words used disproportionately more by LLMs than humans in blog writing */
const AI_VOCABULARY = new Set([
  'comprehensive', 'crucial', 'pivotal', 'significant', 'leverage', 'facilitate',
  'ensure', 'robust', 'streamlined', 'innovative', 'seamless', 'efficient',
  'effective', 'essential', 'fundamental', 'remarkable', 'exceptional',
  'outstanding', 'implemented', 'utilized', 'optimized', 'strategically',
  'proactively', 'holistic', 'encompass', 'pertaining', 'aforementioned',
  'commence', 'endeavor', 'prioritize', 'transformative', 'groundbreaking',
  'navigate', 'landscape', 'ecosystem', 'stakeholder', 'elevate', 'harness',
  'unlock', 'delve', 'tailored', 'bespoke', 'empowers', 'actionable',
  'scalable', 'synergy', 'paradigm', 'multifaceted', 'nuanced', 'holistically',
  'importantly', 'ultimately', 'essentially', 'fundamentally', 'critically',
  'notably', 'significantly', 'subsequently', 'consequently', 'accordingly',
]);

/** Formal transition words used far more by LLMs than humans */
const FORMAL_TRANSITIONS = [
  'furthermore', 'moreover', 'additionally', 'consequently', 'therefore',
  'thus', 'nevertheless', 'nonetheless', 'subsequently', 'accordingly',
  'whereas', 'whereby', 'hence', 'notwithstanding', 'predominantly',
  'therein', 'henceforth',
];

/** Hedging / meta-commentary phrases unique to LLM writing style */
const HEDGING_PHRASES = [
  'it is important to', 'it is essential to', 'it is crucial to',
  'it is worth noting', 'it should be noted', 'it is worth mentioning',
  'one should consider', 'keep in mind that', 'it goes without saying',
  'needless to say', 'it is clear that', 'it is evident that',
  'it is undeniable that', 'rest assured', 'without a doubt',
  'first and foremost', 'last but not least', 'with that being said',
  'having said that', 'in today\'s world', 'in today\'s digital',
  'in conclusion', 'to summarize', 'in summary', 'in essence',
  'as mentioned above', 'as stated earlier', 'as we have seen',
  'it is important that', 'it is necessary to',
];

/** Passive-voice constructions overused in AI formal writing */
const PASSIVE_MARKERS = [
  'is designed to', 'are designed to', 'is intended to', 'are intended to',
  'can be found', 'can be used', 'can be seen', 'can be considered',
  'should be noted', 'should be considered', 'should be used',
  'is provided', 'are provided', 'is offered', 'are offered',
  'is considered', 'are considered', 'is known', 'are known',
  'is used', 'are used', 'is required', 'are required',
];

/** List-opener phrases LLMs use to introduce bullet/numbered lists */
const LIST_OPENERS = [
  'here are', 'the following', 'below are', 'these include', 'some of the',
  'there are several', 'there are many', 'there are various', 'there are numerous',
  'key factors', 'key benefits', 'key features', 'key points',
  'main advantages', 'main benefits', 'main features', 'main reasons',
  'top reasons', 'top benefits', 'important factors',
];

/** Informal markers found in genuinely human text */
const INFORMAL_MARKERS = [
  "don't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't",
  "i've", "i'm", "i'll", "i'd", "you've", "you're", "you'll",
  "it's", "that's", "what's", "here's", "there's", "let's",
  "doesn't", "didn't", "couldn't", "wouldn't", "shouldn't",
  "they're", "they've", "they'll", "we're", "we've", "we'll",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function tokenizeSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 3);
}

function tokenizeWords(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z']{2,}\b/g) || [];
}

// ─── Signal computers ─────────────────────────────────────────────────────────

/**
 * AI Vocabulary Density — what fraction of words are LLM-preferred formal words.
 * Returns 0–100 (higher = more AI-like). Used in composite scoring.
 */
function computeAiVocabDensity(words: string[]): number {
  if (words.length < 20) return 50;
  const aiWordCount = words.filter(w => AI_VOCABULARY.has(w)).length;
  const density = aiWordCount / words.length;
  // 0% → 0, 3%+ → 100
  return Math.min(100, Math.round((density / 0.03) * 100));
}

const AI_PERPLEXITY_WORDS = [
  'utilize', 'leverage', 'furthermore', 'additionally',
  'moreover', 'nevertheless', 'consequently', 'therefore',
  'significant', 'comprehensive', 'facilitate', 'demonstrate',
  'subsequently', 'aforementioned', 'optimal', 'paradigm',
  'implement', 'endeavor', 'prioritize', 'streamline',
];

/**
 * Perplexity — vocabulary unpredictability.
 * Higher unique-word ratio + fewer AI buzzwords = higher perplexity (more human).
 * Returns 0–100 (higher = more unpredictable = more human-like).
 */
function calculatePerplexity(text: string): number {
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  if (words.length === 0) return 0;

  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  const totalWords = words.length;
  const uniqueWords = Object.keys(freq).length;
  const aiWordCount = words.filter(w => AI_PERPLEXITY_WORDS.includes(w)).length;

  const uniqueRatio = uniqueWords / totalWords;
  const aiPenalty = aiWordCount / totalWords;

  const score = Math.round((uniqueRatio * 100) - (aiPenalty * 200));
  return Math.max(0, Math.min(100, score));
}

/**
 * BURSTINESS — sentence-length variation.
 * Higher CV = more varied = more human-like.
 * Returns 0–100 (higher = more human).
 */
function computeBurstiness(sentences: string[]): number {
  if (sentences.length < 4) return 40;
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) return 40;
  const variance = lengths.reduce((s, l) => s + Math.pow(l - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;
  // AI SEO content: CV ≈ 20–40. Human: CV > 45 or has extreme outliers.
  // Extreme short sentences (<6 words) are strongly human
  const shortCount = lengths.filter(l => l < 6).length;
  const shortBonus = Math.min(20, (shortCount / lengths.length) * 60);
  return Math.min(100, Math.max(0, Math.round((cv / 45) * 80 + shortBonus)));
}

/**
 * REPETITION — phrase-level repetition rate.
 * Returns 0–100 (higher = more repetitive = more AI-like).
 */
function computeRepetition(words: string[]): number {
  if (words.length < 15) return 20;
  // Trigrams (most distinctive)
  const trigrams: string[] = [];
  for (let i = 0; i < words.length - 2; i++) {
    const w = words[i];
    // Skip common stop-word trigrams
    if (['the', 'and', 'for', 'are', 'was', 'with', 'this', 'that', 'you', 'not', 'from', 'has'].includes(w)) continue;
    trigrams.push(`${w} ${words[i + 1]} ${words[i + 2]}`);
  }
  if (trigrams.length === 0) return 20;
  const counts = new Map<string, number>();
  trigrams.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  const repeated = [...counts.values()].filter(c => c > 1).length;
  const rate = repeated / trigrams.length;
  return Math.min(100, Math.max(0, Math.round(rate * 500)));
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

/**
 * detectAiContent
 *
 * Returns an AiDetectionResult. Score breakdown:
 *
 *   Base score         = 38  (slight AI prior for generated web content)
 *   + Transition rate  max +20
 *   + Hedging density  max +18
 *   + AI vocabulary    max +15
 *   + Passive markers  max +10
 *   + Repetition       max +10  ← phrase repetition is a strong AI signal
 *   + List openers     max +8
 *   + Uniformity       max +8
 *   - Informality      max -12  (capped so contractions can't dominate)
 *   - Short sentences  max -7
 *   - Extreme variety  max -6
 */
export function detectAiContent(html: string): AiDetectionResult {
  const text = stripHtml(html);

  if (text.split(/\s+/).length < 30) {
    return { aiProbability: 50, humanProbability: 50, perplexity: 50, burstiness: 50, repetition: 50, riskLevel: 'medium' };
  }

  const sentences   = tokenizeSentences(text);
  const words       = tokenizeWords(text);
  const textLower   = text.toLowerCase();
  const wordCount   = words.length;

  // ── Signal: formal transition word rate (per 100 words) ──────────────────
  const transitionCount = FORMAL_TRANSITIONS.reduce((n, t) => {
    let pos = 0, count = 0;
    while ((pos = textLower.indexOf(t, pos)) !== -1) { count++; pos += t.length; }
    return n + count;
  }, 0);
  const transitionRate = (transitionCount / wordCount) * 100;
  const transitionScore = Math.min(20, Math.round(transitionRate * 8)); // 2.5 per 100 → 20pts

  // ── Signal: hedging phrase density (per 500 words) ───────────────────────
  const hedgeCount = HEDGING_PHRASES.reduce((n, p) => {
    let pos = 0, count = 0;
    while ((pos = textLower.indexOf(p, pos)) !== -1) { count++; pos += p.length; }
    return n + count;
  }, 0);
  const hedgeDensity = (hedgeCount / wordCount) * 500;
  const hedgeScore = Math.min(18, Math.round(hedgeDensity * 7)); // 2.5 per 500 → 18pts

  // ── Signal: AI vocabulary density ────────────────────────────────────────
  const aiVocabScore = Math.round(computeAiVocabDensity(words) * 0.15); // max 15

  // ── Signal: passive voice markers ────────────────────────────────────────
  const passiveCount = PASSIVE_MARKERS.reduce((n, p) => {
    let pos = 0, count = 0;
    while ((pos = textLower.indexOf(p, pos)) !== -1) { count++; pos += p.length; }
    return n + count;
  }, 0);
  const passiveRate = (passiveCount / Math.max(sentences.length, 1));
  const passiveScore = Math.min(10, Math.round(passiveRate * 12));

  // ── Signal: phrase repetition (higher = more AI-like) ────────────────────
  const repetition = computeRepetition(words);
  const repetitionScore = Math.min(10, Math.round(repetition * 0.13)); // 77 → 10pts

  // ── Signal: list openers ─────────────────────────────────────────────────
  const listOpenerCount = LIST_OPENERS.reduce((n, p) => textLower.includes(p) ? n + 1 : n, 0);
  const listOpenerScore = Math.min(8, listOpenerCount * 2);

  // ── Signal: sentence length uniformity (inverse burstiness → AI signal) ──
  const burstiness = computeBurstiness(sentences);
  const uniformityScore = Math.max(0, Math.round(((100 - burstiness) / 100) * 8)); // max 8

  // ── Counter-signal: informality / contractions ───────────────────────────
  // Capped at 12 (not 18) so heavy contraction use can't overwhelm all AI signals
  const informalCount = INFORMAL_MARKERS.reduce((n, m) => textLower.includes(m) ? n + 1 : n, 0);
  const informalScore = Math.min(12, informalCount * 2);

  // ── Counter-signal: short burst sentences (< 6 words) → human signal ─────
  const shortSentences = sentences.filter(s => s.split(/\s+/).length < 6).length;
  const shortRatio = shortSentences / Math.max(sentences.length, 1);
  const shortScore = Math.min(7, Math.round(shortRatio * 40));

  // ── Counter-signal: extreme length variety ────────────────────────────────
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const hasVeryLong = lengths.some(l => l > 40);
  const extremeScore = (burstiness > 70 && hasVeryLong) ? 6 : 0;

  // ── Composite ────────────────────────────────────────────────────────────
  const base = 38;
  const rawAi = base
    + transitionScore
    + hedgeScore
    + aiVocabScore
    + passiveScore
    + repetitionScore
    + listOpenerScore
    + uniformityScore
    - informalScore
    - shortScore
    - extremeScore;

  const aiProbability    = Math.min(92, Math.max(8, Math.round(rawAi)));
  const humanProbability = 100 - aiProbability;

  const riskLevel: 'low' | 'medium' | 'high' =
    aiProbability >= 60 ? 'high' :
    aiProbability >= 35 ? 'medium' : 'low';

  // ── Display signals ───────────────────────────────────────────────────────
  // perplexity = vocabulary unpredictability (higher = more human-like)
  const perplexity = calculatePerplexity(text);

  return {
    aiProbability,
    humanProbability,
    perplexity,
    burstiness,
    repetition,
    riskLevel,
  };
}
