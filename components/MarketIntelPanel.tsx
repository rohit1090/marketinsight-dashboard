import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ExternalLink, MessageSquare, Flame, RefreshCw } from 'lucide-react';
import { fetchLiveMarketIntel } from '../services/geminiService';
import { fetchSEOTrends } from '../services/seoTrendService';
import { MarketTrendData, TrendingTopic } from '../services/marketIntelService';
import { LiveMarketReport } from '../types';

interface MarketIntelPanelProps {
  channel: string;
}

// ─── Stat card ───────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}> = ({ label, value, sub, accent = 'bg-indigo-50 text-indigo-700' }) => (
  <div className={`rounded-2xl p-4 ${accent}`}>
    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
    <p className="text-2xl font-black leading-none">{value}</p>
    {sub && <p className="text-xs font-semibold opacity-60 mt-1">{sub}</p>}
  </div>
);

// ─── Trend badge ─────────────────────────────────────────────────────────────
const TrendBadge: React.FC<{ dir: 'up' | 'down' | 'stable'; pct: number }> = ({ dir, pct }) => {
  if (dir === 'up')
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs font-black px-2.5 py-1 rounded-full">
        <TrendingUp size={12} /> +{pct}% vs last week
      </span>
    );
  if (dir === 'down')
    return (
      <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 border border-red-100 text-xs font-black px-2.5 py-1 rounded-full">
        <TrendingDown size={12} /> {pct}% vs last week
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 text-xs font-black px-2.5 py-1 rounded-full">
      <Minus size={12} /> Stable
    </span>
  );
};

// ─── Gemini summary renderer ──────────────────────────────────────────────────
const renderContent = (text: string) =>
  text.split('\n').map((line, i) => {
    if (line.trim().startsWith('#'))
      return (
        <h3 key={i} className="text-base font-bold text-slate-900 mt-3 mb-1">
          {line.replace(/#/g, '').trim()}
        </h3>
      );
    if (line.trim().startsWith('*') || line.trim().startsWith('-'))
      return (
        <li key={i} className="ml-5 text-slate-600 mb-1 list-disc text-sm">
          {line.replace(/^[\s*-]+/, '').trim()}
        </li>
      );
    return (
      <p key={i} className="text-slate-600 mb-2 leading-relaxed text-sm">
        {line}
      </p>
    );
  });

// ─── Main component ───────────────────────────────────────────────────────────
const MarketIntelPanel: React.FC<MarketIntelPanelProps> = ({ channel }) => {
  const [trendData, setTrendData] = useState<MarketTrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  const [report, setReport] = useState<LiveMarketReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchAll = async () => {
    // Run both fetches in parallel
    setTrendLoading(true);
    setTrendError(null);
    setAiLoading(true);
    setAiError(null);

    const [trendResult, aiResult] = await Promise.allSettled([
      fetchSEOTrends(channel),
      fetchLiveMarketIntel(channel),
    ]);

    if (trendResult.status === 'fulfilled') {
      setTrendData(trendResult.value);
    } else {
      const msg = trendResult.reason instanceof Error ? trendResult.reason.message : String(trendResult.reason);
      setTrendError(`Trend data unavailable: ${msg}`);
    }
    setTrendLoading(false);

    if (aiResult.status === 'fulfilled') {
      setReport(aiResult.value);
    } else {
      const msg = aiResult.reason instanceof Error ? aiResult.reason.message : String(aiResult.reason);
      setAiError(`AI analysis failed: ${msg}`);
    }
    setAiLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [channel]);

  const isLoading = trendLoading && aiLoading;

  const sentimentColor = {
    hot: 'bg-orange-50 text-orange-700',
    neutral: 'bg-slate-50 text-slate-700',
    cooling: 'bg-sky-50 text-sky-700',
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <span className="text-xl">🌐</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Live Market Intelligence</h2>
            <p className="text-sm text-slate-500">Real-time trend signals + AI analysis for <strong>{channel}</strong></p>
          </div>
        </div>
        <button
          onClick={fetchAll}
          disabled={isLoading}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-sm disabled:opacity-40 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-all"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Fetching…' : 'Refresh'}
        </button>
      </div>

      {/* ── Section 1: Live Trend Data ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-black text-slate-900">Trend Signals</h3>
            <p className="text-xs text-slate-400 mt-0.5">Industry buzz from across the web · last 7 days</p>
          </div>
          {trendData && (
            <div className="flex items-center gap-2">
              {trendData.sentiment === 'hot' && (
                <span className="flex items-center gap-1 text-orange-600 text-xs font-black bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                  <Flame size={11} /> Trending Hot
                </span>
              )}
              <TrendBadge dir={trendData.trendDirection} pct={Math.abs(trendData.changePercent)} />
            </div>
          )}
        </div>

        {trendLoading ? (
          <div className="py-12 flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-slate-400 text-sm animate-pulse">Scanning live trend signals…</p>
          </div>
        ) : trendError ? (
          <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
            {trendError}
          </div>
        ) : trendData ? (
          <>
            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard
                label="Mentions This Week"
                value={trendData.totalMentions.toLocaleString()}
                sub={`vs ${trendData.prevMentions} last week`}
                accent="bg-indigo-50 text-indigo-700"
              />
              <StatCard
                label="Avg Engagement"
                value={trendData.avgEngagement}
                sub="avg points / article"
                accent="bg-violet-50 text-violet-700"
              />
              <StatCard
                label="Market Sentiment"
                value={trendData.sentiment.charAt(0).toUpperCase() + trendData.sentiment.slice(1)}
                sub={trendData.trendDirection === 'up' ? 'Growing interest' : trendData.trendDirection === 'down' ? 'Fading interest' : 'Steady activity'}
                accent={sentimentColor[trendData.sentiment]}
              />
            </div>

            {/* Sparkline */}
            <div className="mb-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Daily Mention Volume</p>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={trendData.sparkline} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mentionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
                    formatter={(v: number, name: string) => [v, name === 'mentions' ? 'Mentions' : 'Avg Score']}
                  />
                  <Area type="monotone" dataKey="mentions" stroke="#6366f1" strokeWidth={2} fill="url(#mentionGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Trending topics */}
            {trendData.trendingTopics.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Top Stories This Week</p>
                <ul className="space-y-2">
                  {trendData.trendingTopics.map((topic: TrendingTopic, i: number) => (
                    <li key={i} className="flex items-start gap-3 group">
                      <span className="text-[10px] font-black text-slate-300 mt-1 w-4 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={topic.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug"
                        >
                          {topic.title}
                          <ExternalLink size={10} className="inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </a>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-semibold">▲ {topic.points} pts</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-400 font-semibold">
                            <MessageSquare size={9} /> {topic.comments}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-slate-300 mt-4 text-right font-medium">
              Source: SerpAPI · Google Search · fetched {new Date(trendData.fetchedAt).toLocaleTimeString()}
            </p>
          </>
        ) : null}
      </div>

      {/* ── Section 2: AI Analysis (Gemini) ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-lg">🤖</span>
          <div>
            <h3 className="text-base font-black text-slate-900">AI Analysis</h3>
            <p className="text-xs text-slate-400 mt-0.5">Gemini with Google Search grounding · live market data</p>
          </div>
        </div>

        {aiLoading ? (
          <div className="py-12 flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-slate-400 text-sm animate-pulse">AI is scanning the web for benchmarks…</p>
          </div>
        ) : aiError ? (
          <div className="p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-200 space-y-2">
            <p className="font-black">AI Analysis Unavailable</p>
            <p className="leading-relaxed">{aiError}</p>
            {(aiError.includes('quota') || aiError.includes('RESOURCE_EXHAUSTED') || aiError.includes('429')) && (
              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-700 underline font-semibold text-xs"
              >
                Open Google AI Studio <ExternalLink size={11} />
              </a>
            )}
          </div>
        ) : report ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                {renderContent(report.summary)}
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                <h4 className="font-black text-indigo-900 text-sm mb-3 flex items-center gap-2">
                  🔗 Grounding Sources
                </h4>
                <p className="text-[10px] text-indigo-600 uppercase tracking-widest font-black mb-3">Verified Web Data</p>
                <ul className="space-y-2.5">
                  {report.sources.map((source: { uri: string; title: string }, i: number) => (
                    <li key={i}>
                      <a
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline block truncate font-semibold"
                        title={source.title}
                      >
                        {source.title}
                      </a>
                    </li>
                  ))}
                  {report.sources.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No external sources cited.</p>
                  )}
                </ul>
              </div>
              <div className="bg-amber-50 p-5 rounded-xl border border-amber-100">
                <h4 className="font-black text-amber-900 text-sm mb-2">Pro Tip</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Market benchmarks fluctuate weekly. Pull this report before your Monday team sync for the freshest data.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MarketIntelPanel;
