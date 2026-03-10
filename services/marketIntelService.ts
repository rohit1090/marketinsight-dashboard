/**
 * marketIntelService.ts
 *
 * Fetches real-time marketing trend data using the Hacker News Algolia API.
 * - Free, no API key required, CORS-enabled
 * - Returns structured data: trend direction, sparkline, engagement stats, top stories
 *
 * Architecture: Each marketing channel maps to a targeted search query.
 * Future services (Google Ads API, Meta API, SEO APIs) can be added alongside
 * this file in the /services folder and composed in the panel component.
 */

const HN_BASE = 'https://hn.algolia.com/api/v1';

// Maps dashboard channel names → HN search queries
const CHANNEL_QUERIES: Record<string, string> = {
  'Google Ads': 'google ads PPC advertising search campaign',
  'Facebook Ads': 'facebook meta ads instagram advertising',
  'SEO': 'SEO search engine optimization ranking algorithm',
  'Email Marketing': 'email marketing newsletter automation drip',
  'Content Marketing': 'content marketing strategy blog copywriting',
  'Social Media': 'social media marketing engagement growth',
  'Programmatic': 'programmatic advertising RTB display header bidding',
  'TikTok Ads': 'tiktok advertising video marketing short-form',
  'LinkedIn Ads': 'linkedin advertising B2B marketing lead generation',
  'YouTube Ads': 'youtube advertising video ads pre-roll',
};

function getQuery(channel: string): string {
  return CHANNEL_QUERIES[channel] ?? `${channel} marketing digital advertising`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// --- Types ---

export interface TrendDataPoint {
  date: string;    // e.g. "Mon", "Tue"
  mentions: number;
  score: number;   // avg HN points for that day
}

export interface TrendingTopic {
  title: string;
  url: string;
  points: number;
  comments: number;
}

export interface MarketTrendData {
  channel: string;
  totalMentions: number;       // articles this week
  prevMentions: number;        // articles last week (for comparison)
  changePercent: number;       // week-over-week % change
  avgEngagement: number;       // avg HN points per article
  trendDirection: 'up' | 'down' | 'stable';
  sentiment: 'hot' | 'neutral' | 'cooling';
  sparkline: TrendDataPoint[]; // last 7 days
  trendingTopics: TrendingTopic[];
  fetchedAt: string;
}

// --- Internal helpers ---

interface HNHit {
  objectID: string;
  title: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at_i: number;
}

interface HNResponse {
  hits: HNHit[];
  nbHits: number;
}

async function hnSearch(
  query: string,
  fromTs: number,
  toTs?: number,
): Promise<HNResponse> {
  const filter = toTs
    ? `created_at_i>${fromTs},created_at_i<${toTs}`
    : `created_at_i>${fromTs}`;

  const url =
    `${HN_BASE}/search?query=${encodeURIComponent(query)}` +
    `&tags=story` +
    `&numericFilters=${encodeURIComponent(filter)}` +
    `&hitsPerPage=100`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HN API returned ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<HNResponse>;
}

// --- Public API ---

export async function fetchMarketTrends(channel: string): Promise<MarketTrendData> {
  const query = getQuery(channel);
  const now = nowSeconds();
  const weekAgo = now - 7 * 86_400;
  const twoWeeksAgo = now - 14 * 86_400;

  // Two parallel fetches: this week + last week (for WoW comparison)
  const [thisWeek, lastWeek] = await Promise.all([
    hnSearch(query, weekAgo),
    hnSearch(query, twoWeeksAgo, weekAgo),
  ]);

  const thisCount = thisWeek.nbHits;
  const lastCount = Math.max(lastWeek.nbHits, 1); // avoid divide-by-zero
  const changePercent = Math.round(((thisCount - lastCount) / lastCount) * 1000) / 10;

  // Build day-by-day sparkline (last 7 days, oldest → newest)
  const dayMap = new Map<string, { mentions: number; totalScore: number }>();
  const dayLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const label = new Date((now - i * 86_400) * 1000).toLocaleDateString('en-US', {
      weekday: 'short',
    });
    dayLabels.push(label);
    dayMap.set(label, { mentions: 0, totalScore: 0 });
  }

  for (const hit of thisWeek.hits) {
    const label = new Date(hit.created_at_i * 1000).toLocaleDateString('en-US', {
      weekday: 'short',
    });
    const bucket = dayMap.get(label);
    if (bucket) {
      bucket.mentions++;
      bucket.totalScore += hit.points ?? 0;
    }
  }

  const sparkline: TrendDataPoint[] = dayLabels.map((date) => {
    const b = dayMap.get(date)!;
    return {
      date,
      mentions: b.mentions,
      score: b.mentions > 0 ? Math.round(b.totalScore / b.mentions) : 0,
    };
  });

  // Top trending topics by HN points
  const trendingTopics: TrendingTopic[] = [...thisWeek.hits]
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 5)
    .map((hit) => ({
      title: hit.title,
      url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
      points: hit.points ?? 0,
      comments: hit.num_comments ?? 0,
    }));

  const avgEngagement =
    thisWeek.hits.length > 0
      ? Math.round(
          thisWeek.hits.reduce((sum, h) => sum + (h.points ?? 0), 0) /
            thisWeek.hits.length,
        )
      : 0;

  const trendDirection: 'up' | 'down' | 'stable' =
    changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';

  const sentiment: 'hot' | 'neutral' | 'cooling' =
    changePercent > 20 ? 'hot' : changePercent < -10 ? 'cooling' : 'neutral';

  return {
    channel,
    totalMentions: thisCount,
    prevMentions: lastWeek.nbHits,
    changePercent,
    avgEngagement,
    trendDirection,
    sentiment,
    sparkline,
    trendingTopics,
    fetchedAt: new Date().toISOString(),
  };
}
