import React, { useState } from 'react';
import { fetchYoutubeVideo, extractVideoId, YoutubeVideoData } from '../services/youtubeService';
import {
  Eye, Clock, Calendar, CheckCircle, AlertCircle, Lightbulb,
  PlayCircle, TrendingUp, ThumbsUp, Users, ChevronDown, ChevronUp,
  ExternalLink, BarChart2,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function parseMins(length: string): number {
  const p = length.split(':').map(Number);
  if (p.length === 2) return p[0] + p[1] / 60;
  if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
  return 0;
}

// ─── Performance score ────────────────────────────────────────────────────────

function calcScore(v: YoutubeVideoData): number {
  let s = 0;
  const views = v.extractedViews;
  if (views >= 1_000_000) s += 30; else if (views >= 100_000) s += 22;
  else if (views >= 10_000) s += 14; else if (views > 0) s += 6;

  const mins = parseMins(v.length);
  if (mins >= 8 && mins <= 20) s += 20; else if (mins > 0) s += 10;

  const tl = v.title.length;
  if (tl >= 50 && tl <= 70) s += 20; else if (tl >= 30) s += 10;

  const subs = v.extractedSubscribers;
  if (subs >= 1_000_000) s += 15; else if (subs >= 100_000) s += 10;
  else if (subs >= 10_000) s += 6;

  if (v.verified) s += 15;
  return Math.min(s, 100);
}

// ─── SEO insights ─────────────────────────────────────────────────────────────

interface Insight { type: 'good' | 'warn' | 'tip'; text: string }

function buildInsights(v: YoutubeVideoData): Insight[] {
  const ins: Insight[] = [];
  const tl = v.title.length;

  if (tl >= 50 && tl <= 70)
    ins.push({ type: 'good', text: `Title length ${tl} chars — optimal range (50–70) for search visibility.` });
  else if (tl < 50)
    ins.push({ type: 'warn', text: `Title is only ${tl} chars. Expand to 50–70 for better discoverability.` });
  else
    ins.push({ type: 'warn', text: `Title is ${tl} chars — may be truncated in results. Aim for under 70.` });

  const views = v.extractedViews;
  if (views >= 1_000_000)
    ins.push({ type: 'good', text: `${fmtNum(views)} views — viral reach. Strong social proof signal.` });
  else if (views >= 100_000)
    ins.push({ type: 'good', text: `${fmtNum(views)} views — well above average. Great engagement.` });
  else if (views >= 10_000)
    ins.push({ type: 'tip', text: `${fmtNum(views)} views. Promote via end screens and community posts to scale.` });
  else if (views > 0)
    ins.push({ type: 'warn', text: `${views.toLocaleString()} views is below average. Improve thumbnail CTR and title hook.` });

  const mins = parseMins(v.length);
  if (mins > 0) {
    if (mins >= 8 && mins <= 20)
      ins.push({ type: 'good', text: `Duration ${v.length} — sweet spot for watch time and ad revenue (8–20 min).` });
    else if (mins < 8)
      ins.push({ type: 'tip', text: `${v.length} is short. Videos 8–20 min rank higher and earn more ad revenue.` });
    else
      ins.push({ type: 'tip', text: `${v.length} is long. Add chapter markers to retain viewers.` });
  }

  const subs = v.extractedSubscribers;
  if (subs >= 1_000_000)
    ins.push({ type: 'good', text: `${fmtNum(subs)} subscribers — large audience base with strong distribution.` });
  else if (subs >= 100_000)
    ins.push({ type: 'good', text: `${fmtNum(subs)} subscribers — solid channel authority.` });
  else if (subs > 0)
    ins.push({ type: 'tip', text: `${fmtNum(subs)} subscribers. Focus on consistent uploads to grow the channel.` });

  if (v.verified) ins.push({ type: 'good', text: 'Verified channel — higher CTR and SERP trust signals.' });
  else ins.push({ type: 'tip', text: 'Not verified. Reach 100K subscribers to unlock the verification badge.' });

  if (v.description)
    ins.push({ type: 'good', text: 'Video has a description. Ensure it contains keywords and timestamps.' });
  else
    ins.push({ type: 'warn', text: 'No description detected. Add keyword-rich descriptions with timestamps.' });

  return ins;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const r = 32, circ = 2 * Math.PI * r;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  const label = score >= 70 ? 'Great' : score >= 45 ? 'Average' : 'Needs Work';
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-20 h-20 shrink-0">
        <svg className="-rotate-90" width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-900 leading-none">{score}</span>
          <span className="text-[9px] text-slate-400 font-bold">/100</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score</p>
        <p className="text-lg font-black" style={{ color }}>{label}</p>
        <p className="text-[10px] text-slate-400">performance rating</p>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string;
}> = ({ icon, label, value, sub, accent }) => (
  <div className={`rounded-2xl p-5 ${accent}`}>
    <div className="flex items-center gap-2 mb-3 opacity-60">
      {icon}
      <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
    </div>
    <p className="text-2xl font-black leading-none">{value}</p>
    {sub && <p className="text-xs font-semibold opacity-60 mt-1.5">{sub}</p>}
  </div>
);

const InsightRow: React.FC<{ insight: Insight }> = ({ insight }) => {
  const cfg = {
    good: { icon: <CheckCircle size={13} />, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    warn: { icon: <AlertCircle  size={13} />, cls: 'text-amber-700  bg-amber-50  border-amber-200'  },
    tip:  { icon: <Lightbulb   size={13} />, cls: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  }[insight.type];
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium leading-relaxed ${cfg.cls}`}>
      <span className="mt-0.5 shrink-0">{cfg.icon}</span>
      {insight.text}
    </div>
  );
};

const Accordion: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className="font-black text-slate-800 text-sm">{title}</span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const SESSION_KEY = 'mi_yt_video';
const SESSION_INPUT_KEY = 'mi_yt_input';

const YoutubeAnalyzer: React.FC = () => {
  const [input,   setInput]   = useState(() => sessionStorage.getItem(SESSION_INPUT_KEY) ?? '');
  const [loading, setLoading] = useState(false);
  const [video,   setVideo]   = useState<YoutubeVideoData | null>(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      return s ? (JSON.parse(s) as YoutubeVideoData) : null;
    } catch { return null; }
  });
  const [error,   setError]   = useState<string | null>(null);
  const [imgSrc,  setImgSrc]  = useState(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      if (!s) return '';
      const v = JSON.parse(s) as YoutubeVideoData;
      return v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/maxresdefault.jpg`;
    } catch { return ''; }
  });

  const handleAnalyze = async () => {
    const videoId = extractVideoId(input);
    if (!videoId) return;
    setLoading(true); setError(null); setVideo(null);
    try {
      const data = await fetchYoutubeVideo(videoId);
      setVideo(data);
      const thumb = data.thumbnail || `https://img.youtube.com/vi/${data.videoId}/maxresdefault.jpg`;
      setImgSrc(thumb);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      sessionStorage.setItem(SESSION_INPUT_KEY, input);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch video data.');
    } finally {
      setLoading(false);
    }
  };

  const score    = video ? calcScore(video)    : 0;
  const insights = video ? buildInsights(video) : [];
  const goodCount = insights.filter(i => i.type === 'good').length;
  const warnCount = insights.filter(i => i.type !== 'good').length;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-200 shrink-0">
            <PlayCircle size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-slate-900">YouTube Video Analyzer</h3>
            <p className="text-xs text-slate-400 mt-0.5">Paste any YouTube URL · powered by SerpAPI</p>
          </div>
          <div className="hidden md:flex gap-1.5 shrink-0">
            {['Views', 'Likes', 'Subscribers', 'SEO Score'].map(t => (
              <span key={t} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">{t}</span>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <PlayCircle size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder="https://youtube.com/watch?v=... or paste video ID"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-red-400 outline-none font-medium text-slate-700"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-7 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 min-w-[160px] justify-center shadow-lg shadow-red-200"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Fetching…</>
              : <><PlayCircle size={15} />Analyze</>}
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* left thumb skeleton */}
            <div className="h-56 bg-slate-200 animate-pulse relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-slate-300 animate-pulse" />
              </div>
            </div>
            {/* right info skeleton */}
            <div className="p-6 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-4/5" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
              {[1,2,3,4].map(i => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <div className="w-6 h-6 bg-slate-200 rounded-lg" />
                  <div className="h-3 bg-slate-100 rounded flex-1" />
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center py-3 border-t border-slate-100">
            Fetching YouTube video data via SerpAPI…
          </p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="p-5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium flex items-start gap-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div><p className="font-black">Could not fetch video data</p><p className="opacity-80 mt-0.5">{error}</p></div>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {video && !loading && (
        <>
          {/* ── ROW 1: 2-column — Thumbnail | Video Info ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">

              {/* LEFT — Thumbnail with overlays */}
              <div className="relative group bg-black">
                <img
                  src={imgSrc}
                  alt={video.title}
                  className="w-full h-full object-cover md:min-h-[280px]"
                  onError={() => setImgSrc(`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`)}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

                {/* Top badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {video.verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black bg-white/90 text-slate-800 px-2.5 py-1 rounded-full shadow">
                      <CheckCircle size={9} className="text-emerald-500" /> Verified
                    </span>
                  )}
                  {video.extractedViews >= 1_000_000 && (
                    <span className="text-[10px] font-black bg-red-600 text-white px-2.5 py-1 rounded-full shadow">🔥 Viral</span>
                  )}
                  {video.publishedDate?.toLowerCase().includes('hour') && (
                    <span className="text-[10px] font-black bg-yellow-400 text-yellow-900 px-2.5 py-1 rounded-full shadow">🆕 New</span>
                  )}
                </div>

                {/* Video ID badge */}
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-mono font-bold bg-black/70 text-white px-2 py-1 rounded-lg">
                    {video.videoId}
                  </span>
                </div>

                {/* Duration badge */}
                {video.length && video.length !== '—' && (
                  <div className="absolute bottom-3 right-3">
                    <span className="text-sm font-black bg-black/80 text-white px-2.5 py-1 rounded-lg">
                      ▶ {video.length}
                    </span>
                  </div>
                )}

                {/* Views overlay */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  <Eye size={12} className="text-white/80" />
                  <span className="text-sm font-black text-white drop-shadow">
                    {video.extractedViews > 0 ? fmtNum(video.extractedViews) : video.views}
                  </span>
                </div>

                {/* Hover play button */}
                <a
                  href={`https://youtube.com/watch?v=${video.videoId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center shadow-2xl">
                    <PlayCircle size={32} className="text-white" />
                  </div>
                </a>
              </div>

              {/* RIGHT — Video details */}
              <div className="p-6 flex flex-col justify-between">
                <div>
                  {/* Title */}
                  <h2 className="text-lg font-black text-slate-900 leading-snug mb-3 line-clamp-3">
                    {video.title}
                  </h2>

                  {/* Channel row */}
                  <a
                    href={video.channelLink || '#'}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mb-5 group/ch"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-black text-red-600 shrink-0">
                      {video.channelName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 group-hover/ch:text-red-600 transition-colors flex items-center gap-1">
                        {video.channelName}
                        {video.verified && <CheckCircle size={12} className="text-emerald-500" />}
                        <ExternalLink size={10} className="text-slate-400 opacity-0 group-hover/ch:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-xs text-slate-400 font-medium">{video.channelSubscribers}</p>
                    </div>
                  </a>

                  {/* Stats list */}
                  <div className="space-y-2.5">
                    {[
                      { icon: <Eye size={14} />,       label: 'Views',        value: video.extractedViews > 0 ? fmtNum(video.extractedViews) : video.views,  sub: video.views },
                      { icon: <ThumbsUp size={14} />,  label: 'Likes',        value: video.extractedLikes > 0 ? fmtNum(video.extractedLikes) : (video.likes || '—'), sub: `${video.likes} total` },
                      { icon: <Users size={14} />,     label: 'Subscribers',  value: video.extractedSubscribers > 0 ? fmtNum(video.extractedSubscribers) : video.channelSubscribers, sub: video.channelSubscribers },
                      { icon: <Clock size={14} />,     label: 'Duration',     value: video.length !== '—' ? video.length : 'N/A', sub: parseMins(video.length) >= 8 && parseMins(video.length) <= 20 ? '✅ Ideal' : '' },
                      { icon: <Calendar size={14} />,  label: 'Published',    value: video.publishedDate },
                    ].map(({ icon, label, value, sub }) => (
                      <div key={label} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">{label}</p>
                          <p className="text-sm font-black text-slate-900 truncate">{value}</p>
                        </div>
                        {sub && sub !== value && (
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">{sub}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-5 flex-wrap">
                  <a
                    href={`https://youtube.com/watch?v=${video.videoId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-red-200 active:scale-95"
                  >
                    <PlayCircle size={14} /> Watch on YouTube
                  </a>
                  <button
                    onClick={() => { setVideo(null); setInput(''); sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_INPUT_KEY); }}
                    className="text-sm font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-all"
                  >
                    New Analysis
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 2: Metric cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<Eye size={14} />} label="Total Views"
              value={video.extractedViews > 0 ? fmtNum(video.extractedViews) : '—'}
              sub={video.views}
              accent="bg-red-50 text-red-700"
            />
            <MetricCard
              icon={<ThumbsUp size={14} />} label="Total Likes"
              value={video.extractedLikes > 0 ? fmtNum(video.extractedLikes) : (video.likes || '—')}
              sub="engagement signal"
              accent="bg-rose-50 text-rose-700"
            />
            <MetricCard
              icon={<Users size={14} />} label="Subscribers"
              value={video.extractedSubscribers > 0 ? fmtNum(video.extractedSubscribers) : '—'}
              sub={video.channelSubscribers}
              accent="bg-violet-50 text-violet-700"
            />
            <MetricCard
              icon={<Clock size={14} />} label="Video Length"
              value={video.length !== '—' ? video.length : 'N/A'}
              sub={(() => { const m = parseMins(video.length); return m >= 8 && m <= 20 ? '✅ Ideal range' : m > 0 ? `${Math.round(m)} min total` : 'duration'; })()}
              accent="bg-indigo-50 text-indigo-700"
            />
          </div>

          {/* ── ROW 3: Accordion — Video Details ────────────────────────────── */}
          {video.description && (
            <Accordion title="📄 Video Details — Full Description">
              {video.description}
            </Accordion>
          )}

          {/* ── ROW 4: Score + SEO Insights ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Score card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2">
                <BarChart2 size={15} className="text-slate-500" />
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">Performance Score</h4>
              </div>
              <ScoreRing score={score} />
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                {[
                  { label: 'Views',         pct: Math.min((video.extractedViews / 1_000_000) * 30, 30), max: 30, color: 'bg-red-400' },
                  { label: 'Duration',      pct: (() => { const m = parseMins(video.length); return m >= 8 && m <= 20 ? 20 : m > 0 ? 10 : 0; })(), max: 20, color: 'bg-indigo-400' },
                  { label: 'Title SEO',     pct: video.title.length >= 50 && video.title.length <= 70 ? 20 : 10, max: 20, color: 'bg-amber-400' },
                  { label: 'Channel Auth.', pct: Math.min((video.extractedSubscribers / 1_000_000) * 15, 15), max: 15, color: 'bg-violet-400' },
                  { label: 'Verification',  pct: video.verified ? 15 : 0, max: 15, color: 'bg-emerald-400' },
                ].map(({ label, pct, max, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                      <span>{label}</span><span>{Math.round(pct)}/{max}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: `${max > 0 ? (pct / max) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <Lightbulb size={13} className="text-indigo-600" />
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">YouTube SEO Insights</h3>
                <div className="ml-auto flex gap-2">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    ✅ {goodCount} strengths
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    💡 {warnCount} tips
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {insights.map((ins, i) => <InsightRow key={i} insight={ins} />)}
              </div>
            </div>
          </div>

          {/* Engagement label */}
          <div className="flex items-center justify-end gap-2">
            <TrendingUp size={12} className="text-slate-400" />
            <p className="text-[10px] text-slate-400 font-medium">
              Data sourced live from SerpAPI · {new Date().toLocaleTimeString()}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default YoutubeAnalyzer;
