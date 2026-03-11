/**
 * socialBladeService.ts
 * Fetches Social Blade stats for YouTube & Instagram via /api/socialblade proxy.
 * Results are cached in Firestore for 30 days to minimise API calls.
 */

import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SB_BASE = '/api/socialblade';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface DailyDataPoint {
  date: string;
  subs: number;
  subsDelta: number;
  views: number;
  viewsDelta: number;
  estimatedEarningsMin: number;
  estimatedEarningsMax: number;
}

export interface GrowthStats {
  d1: number;
  d3: number;
  d7: number;
  d14: number;
  d30: number;
  d60: number;
  d90: number;
  d180: number;
  d365: number;
}

export interface YouTubeChannelData {
  platform: 'youtube';
  displayName: string;
  handle: string;
  avatar: string;
  banner: string;
  createdAt: string;
  totalSubscribers: number;
  totalViews: number;
  totalUploads: number;
  grade: string;
  gradeColor: string;
  ranks: Record<string, string>;
  subsGrowth: GrowthStats;
  viewsGrowth: GrowthStats;
  daily: DailyDataPoint[];
  monthlyEarningsMin: number;
  monthlyEarningsMax: number;
  yearlyEarningsMin: number;
  yearlyEarningsMax: number;
  fetchedAt: string;
}

export interface InstagramProfileData {
  platform: 'instagram';
  displayName: string;
  username: string;
  avatar: string;
  totalFollowers: number;
  totalFollowing: number;
  totalMedia: number;
  grade: string;
  gradeColor: string;
  ranks: Record<string, string>;
  followersGrowth: GrowthStats;
  daily: DailyDataPoint[];
  fetchedAt: string;
}

export type HistoryType = 'default' | 'extended' | 'archive';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'B';
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'M';
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'K';
  }
  return String(n);
}

export function calculateEarnings(monthlyViews: number): { min: number; max: number } {
  return {
    min: (monthlyViews / 1000) * 1.5,
    max: (monthlyViews / 1000) * 4,
  };
}

export function formatEarnings(min: number, max: number): string {
  return `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return '$' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'M';
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return '$' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'K';
  }
  return '$' + Math.round(n);
}

export function gradeToColor(grade: string): string {
  if (grade === 'A++' || grade === 'A+') return '#059669';
  if (grade === 'A'   || grade === 'A-') return '#2563EB';
  if (grade === 'B+'  || grade === 'B')  return '#D97706';
  if (grade === 'C+'  || grade === 'C')  return '#EA580C';
  if (grade === 'D+'  || grade === 'D')  return '#9CA3AF';
  return '#6B7280';
}

export function processDaily(rawDaily: any[]): DailyDataPoint[] {
  if (!Array.isArray(rawDaily) || rawDaily.length === 0) return [];

  // Sort oldest→newest so deltas can be calculated forward
  const sorted = [...rawDaily].sort(
    (a, b) => new Date(a.date ?? a.day ?? 0).getTime() - new Date(b.date ?? b.day ?? 0).getTime(),
  );

  const points: DailyDataPoint[] = sorted.map((item, i) => {
    const prev       = sorted[i - 1];
    const subs       = Number(item.subscribers ?? item.subs ?? 0);
    const views      = Number(item.views ?? item.videoViews ?? 0);
    const prevSubs   = prev ? Number(prev.subscribers ?? prev.subs ?? 0) : subs;
    const prevViews  = prev ? Number(prev.views ?? prev.videoViews ?? 0) : views;
    const subsDelta  = subs - prevSubs;
    const viewsDelta = views - prevViews;
    const earnings   = calculateEarnings(Math.max(0, viewsDelta));

    return {
      date:                  item.date ?? item.day ?? '',
      subs,
      subsDelta,
      views,
      viewsDelta,
      estimatedEarningsMin:  earnings.min,
      estimatedEarningsMax:  earnings.max,
    };
  });

  // Return newest first
  return points.reverse();
}

function mapGrowthStats(raw: Record<string, any> | undefined): GrowthStats {
  if (!raw) return { d1: 0, d3: 0, d7: 0, d14: 0, d30: 0, d60: 0, d90: 0, d180: 0, d365: 0 };
  return {
    d1:   Number(raw['1']   ?? raw.d1   ?? 0),
    d3:   Number(raw['3']   ?? raw.d3   ?? 0),
    d7:   Number(raw['7']   ?? raw.d7   ?? 0),
    d14:  Number(raw['14']  ?? raw.d14  ?? 0),
    d30:  Number(raw['30']  ?? raw.d30  ?? 0),
    d60:  Number(raw['60']  ?? raw.d60  ?? 0),
    d90:  Number(raw['90']  ?? raw.d90  ?? 0),
    d180: Number(raw['180'] ?? raw.d180 ?? 0),
    d365: Number(raw['365'] ?? raw.d365 ?? 0),
  };
}

function mapRanks(raw: Record<string, any> | undefined): Record<string, string> {
  if (!raw) return {};
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
  };
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, ordinal(Number(v))]),
  );
}

// ── Firestore cache ───────────────────────────────────────────────────────────

async function getCache(key: string): Promise<any | null> {
  try {
    const snap = await getDoc(doc(collection(db, 'sbCache'), key));
    if (!snap.exists()) return null;
    const cached = snap.data();
    if (Date.now() - (cached.cachedAt ?? 0) > CACHE_TTL_MS) return null;
    return cached.payload ?? null;
  } catch {
    return null;
  }
}

async function setCache(key: string, data: any): Promise<void> {
  try {
    await setDoc(doc(collection(db, 'sbCache'), key), {
      payload:  data,
      cachedAt: Date.now(),
    });
  } catch (e) {
    console.warn('SB cache write failed:', e);
  }
}

// ── YouTube ───────────────────────────────────────────────────────────────────

export async function getYouTubeChannel(
  query: string,
  history: HistoryType = 'default',
): Promise<YouTubeChannelData> {
  const cleanQuery = query.replace(/@/g, '').trim();
  const cacheKey   = 'sb_yt_' + cleanQuery.toLowerCase();

  const cached = await getCache(cacheKey);
  if (cached) return cached as YouTubeChannelData;

  const url = `/api/socialblade/youtube/statistics?query=${cleanQuery.toLowerCase()}&history=${history}&allow-stale=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Social Blade API ${res.status}: ${res.statusText}`);

  const json = await res.json();
  if (!json.status?.success) throw new Error(json.status?.error ?? 'Social Blade request failed');

  const data = json.data ?? json;

  const subsGrowth  = mapGrowthStats(data.statistics?.growth?.subs);
  const viewsGrowth = mapGrowthStats(data.statistics?.growth?.vidviews);
  const monthly     = calculateEarnings(viewsGrowth.d30);

  const result: YouTubeChannelData = {
    platform:          'youtube',
    displayName:       data.id?.display_name          ?? query,
    handle:            data.id?.handle ?? data.id?.username ?? query,
    avatar:            data.general?.branding?.avatar  ?? '',
    banner:            data.general?.branding?.banner  ?? '',
    createdAt:         data.general?.created_at
      ? new Date(data.general.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—',
    totalSubscribers:  data.statistics?.total?.subscribers ?? 0,
    totalViews:        data.statistics?.total?.views        ?? 0,
    totalUploads:      data.statistics?.total?.uploads      ?? 0,
    grade:             data.misc?.grade?.grade              ?? '—',
    gradeColor:        gradeToColor(data.misc?.grade?.grade ?? ''),
    ranks:             mapRanks(data.ranks),
    subsGrowth,
    viewsGrowth,
    daily:             processDaily(data.daily ?? []),
    monthlyEarningsMin: monthly.min,
    monthlyEarningsMax: monthly.max,
    yearlyEarningsMin:  monthly.min * 12,
    yearlyEarningsMax:  monthly.max * 12,
    fetchedAt:          new Date().toISOString(),
  };

  await setCache(cacheKey, result);
  return result;
}

// ── Instagram ─────────────────────────────────────────────────────────────────

export async function getInstagramProfile(
  query: string,
  history: HistoryType = 'default',
): Promise<InstagramProfileData> {
  const cleanQuery = query.replace(/@/g, '').trim();
  const cacheKey   = 'sb_ig_' + cleanQuery.toLowerCase();

  const cached = await getCache(cacheKey);
  if (cached) return cached as InstagramProfileData;

  const url = `/api/socialblade/instagram/statistics?query=${cleanQuery.toLowerCase()}&history=${history}&allow-stale=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Social Blade API ${res.status}: ${res.statusText}`);

  const json = await res.json();
  if (!json.status?.success) throw new Error(json.status?.error ?? 'Social Blade request failed');

  const data = json.data ?? json;

  const followersGrowth = mapGrowthStats(data.statistics?.growth?.followers);

  const result: InstagramProfileData = {
    platform:        'instagram',
    displayName:     data.id?.display_name ?? query,
    username:        data.id?.username     ?? query,
    avatar:          data.general?.branding?.avatar ?? '',
    totalFollowers:  data.statistics?.total?.followers ?? 0,
    totalFollowing:  data.statistics?.total?.following ?? 0,
    totalMedia:      data.statistics?.total?.media     ?? 0,
    grade:           data.misc?.grade?.grade           ?? '—',
    gradeColor:      gradeToColor(data.misc?.grade?.grade ?? ''),
    ranks:           mapRanks(data.ranks),
    followersGrowth,
    daily:           processDaily(data.daily ?? []),
    fetchedAt:       new Date().toISOString(),
  };

  await setCache(cacheKey, result);
  return result;
}
