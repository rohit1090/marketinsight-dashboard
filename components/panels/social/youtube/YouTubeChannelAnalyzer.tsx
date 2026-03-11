import React, { useState, useEffect } from 'react';
import { getYouTubeChannel, YouTubeChannelData, HistoryType } from '../../../../services/socialBladeService';
import ChannelOverviewCard from './ChannelOverviewCard';
import CreatorStatsGrid    from './CreatorStatsGrid';
import DailyMetricsTable   from './DailyMetricsTable';
import ChannelCharts       from './ChannelCharts';

// ── URL parser ────────────────────────────────────────────────────────────────

function parseYouTubeInput(input: string): string {
  const s = input.trim();
  // Full URL
  try {
    const url = new URL(s.startsWith('http') ? s : `https://${s}`);
    if (url.hostname.includes('youtube.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'channel' && parts[1]) return parts[1];          // /channel/UCxxx
      if (parts[0] === 'c'       && parts[1]) return parts[1];          // /c/name
      if (parts[0]?.startsWith('@'))          return parts[0];          // /@handle
    }
  } catch {
    // not a URL — fall through
  }
  return s; // bare @handle or plain text
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 bg-gray-200 rounded-2xl" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-20 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="h-40 bg-gray-100 rounded-2xl" />
      <div className="h-40 bg-gray-100 rounded-2xl" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const EXAMPLES = ['@SocialBlade', '@MrBeast', '@PewDiePie'];

export default function YouTubeChannelAnalyzer() {
  const [query,   setQuery]   = useState(() => localStorage.getItem('mi_yt_query') || '');
  const [history, setHistory] = useState<HistoryType>(() => (localStorage.getItem('mi_yt_history') as HistoryType) || 'default');
  const [data,    setData]    = useState<YouTubeChannelData | null>(() => {
    try { const s = sessionStorage.getItem('mi_yt_data'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Persist query + history to localStorage, channel data to sessionStorage
  useEffect(() => { localStorage.setItem('mi_yt_query', query); }, [query]);
  useEffect(() => { localStorage.setItem('mi_yt_history', history); }, [history]);
  useEffect(() => {
    if (data) sessionStorage.setItem('mi_yt_data', JSON.stringify(data));
    else sessionStorage.removeItem('mi_yt_data');
  }, [data]);

  const analyze = async (raw = query) => {
    const q = parseYouTubeInput(raw);
    if (!q) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await getYouTubeChannel(q, history);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch channel data.');
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (ex: string) => {
    setQuery(ex);
    analyze(ex);
  };

  return (
    <div className="space-y-4">

      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-3">
          {/* YouTube icon */}
          <div className="bg-indigo-100 rounded-xl p-2 flex-shrink-0">
            <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
            </svg>
          </div>

          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="Enter channel handle or URL (e.g. @MrBeast)"
            className="flex-1 text-sm text-gray-700 outline-none placeholder-gray-400 bg-transparent"
          />

          <select
            value={history}
            onChange={e => setHistory(e.target.value as HistoryType)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-gray-50 outline-none cursor-pointer flex-shrink-0"
          >
            <option value="default">Default (30d)</option>
            <option value="extended">Extended (1yr)</option>
            <option value="archive">Archive (3yr)</option>
          </select>

          <button
            onClick={() => analyze()}
            disabled={loading || !query.trim()}
            className="flex-shrink-0 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <p className="text-2xl">⚠️</p>
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs font-bold text-red-600 bg-red-100 hover:bg-red-200 px-4 py-1.5 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !data && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center space-y-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, #EEF2FF, #DDD6FE)' }}
          >
            <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-gray-700">Analyze any YouTube channel</p>
            <p className="text-sm text-gray-400 mt-1">Subscriber history, growth, earnings estimates, grades & rankings</p>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => handleExample(ex)}
                className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-full transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Success state */}
      {!loading && !error && data && (
        <div className="space-y-4">
          <ChannelOverviewCard data={data} />
          <CreatorStatsGrid data={data} />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <DailyMetricsTable data={data} />
          </div>
          <ChannelCharts data={data} />
        </div>
      )}

    </div>
  );
}
