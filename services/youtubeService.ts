/**
 * youtubeService.ts
 * Fetches YouTube video data via SerpAPI youtube_video engine.
 * Uses the Vite proxy (/api/serpapi/*) to avoid CORS.
 */

const SERPAPI_BASE = '/api/proxy?service=serpapi';

export interface YoutubeVideoData {
  videoId:              string;
  title:                string;
  thumbnail:            string;
  views:                string;
  extractedViews:       number;
  likes:                string;
  extractedLikes:       number;
  length:               string;
  publishedDate:        string;
  channelName:          string;
  channelLink:          string;
  channelSubscribers:   string;
  extractedSubscribers: number;
  verified:             boolean;
  description:          string;
}

interface SerpApiResponse {
  // Fields at root level (youtube_video engine)
  video_id?:        string;
  title?:           string;
  thumbnail?:       string | { static?: string };
  views?:           string;
  extracted_views?: number;
  likes?:           string;
  extracted_likes?: number;
  length?:          string;
  published_date?:  string;
  channel?: {
    name?:                 string;
    link?:                 string;
    verified?:             boolean;
    subscribers?:          string;
    extracted_subscribers?: number;
  };
  description?: {
    content?: string;
  };
  // Some responses nest under video_results (youtube_video engine)
  video_results?: SerpApiResponse;
  // Array form returned by youtube search engine
  video_results_list?: Array<{ video_id?: string; length?: string }>;
  error?: string;
}

/** Fallback: search YouTube for the video ID and grab length from video_results list */
async function fetchLengthFallback(videoId: string, key: string): Promise<string> {
  try {
    const params = new URLSearchParams({ engine: 'youtube', search_query: videoId });
    const res = await fetch(`${SERPAPI_BASE}&${params}`);
    if (!res.ok) return '—';
    const data = await res.json() as { video_results?: Array<{ video_id?: string; length?: string }> };
    const match = (data.video_results ?? []).find(r => r.video_id === videoId);
    return match?.length ?? '—';
  } catch {
    return '—';
  }
}

/** Extracts the 11-character video ID from any YouTube URL format or bare ID */
export function extractVideoId(input: string): string {
  const s = input.trim();
  const short = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];
  const long = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (long) return long[1];
  const embed = s.match(/(?:embed|v)\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return s;
}

/** Resolves thumbnail: SerpAPI returns either a URL string or { static: url } */
function resolveThumbnail(raw: string | { static?: string } | undefined, videoId: string): string {
  if (!raw) return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  if (typeof raw === 'string') return raw;
  return raw.static ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export async function fetchYoutubeVideo(videoId: string): Promise<YoutubeVideoData> {
  const params = new URLSearchParams({ engine: 'youtube_video', v: videoId });

  const res = await fetch(`${SERPAPI_BASE}&${params}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${res.statusText}`);

  const data = await res.json() as SerpApiResponse;
  if (data.error) throw new Error(`SerpAPI: ${data.error}`);

  // Normalise: fields can be nested under video_results or sit at root
  const v: SerpApiResponse = data.video_results ?? data;

  // If youtube_video engine didn't return length, fetch it via youtube search
  const rawLength = v.length && v.length !== 'N/A' ? v.length : null;
  const length = rawLength ?? await fetchLengthFallback(videoId, key);

  return {
    videoId:              v.video_id             ?? videoId,
    title:                v.title                ?? 'Unknown title',
    thumbnail:            resolveThumbnail(v.thumbnail, videoId),
    views:                v.views                ?? '0 views',
    extractedViews:       v.extracted_views      ?? 0,
    likes:                v.likes                ?? '0',
    extractedLikes:       v.extracted_likes      ?? 0,
    length,
    publishedDate:        v.published_date        ?? '—',
    channelName:          v.channel?.name         ?? 'Unknown channel',
    channelLink:          v.channel?.link         ?? '',
    channelSubscribers:   v.channel?.subscribers  ?? '—',
    extractedSubscribers: v.channel?.extracted_subscribers ?? 0,
    verified:             v.channel?.verified     ?? false,
    description:          v.description?.content  ?? '',
  };
}
