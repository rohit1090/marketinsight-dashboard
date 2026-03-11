import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  checkVisibility,
  loadVisibilityData,
  runAutoVisibilityCheck,
  calculateMetrics,
  VisibilityResult,
} from '../services/aiVisibilityService';

const MODEL_COLORS: Record<string, string> = {
  groq: '#6366f1',
  openrouter: '#10A37F',
  perplexity: '#22B3C9',
  gemini: '#4285F4',
};

function sentimentColor(s: string) {
  if (s === 'Positive') return 'text-green-600';
  if (s === 'Negative') return 'text-red-500';
  return 'text-slate-500';
}

function sentimentBadge(s: string) {
  if (s === 'Positive') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'Negative') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return 'No response content stored.';
  return text.split('\n').map((line, i) => {
    // Convert **text** to <strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    // Add spacing after numbered list items
    const isListItem = /^\s*\d+[.)]\s/.test(line);
    return (
      <span key={i} className={`block ${isListItem ? 'mt-2' : ''}`}>
        {parts}
      </span>
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────

const AiVisibilityTab: React.FC = () => {
  const [data, setData]         = useState<VisibilityResult[]>([]);
  const [loading, setLoading]   = useState(true);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [newQuery, setNewQuery] = useState('');
  const [tracking, setTracking] = useState(false);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState('All');

  // ── Load existing data ────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await loadVisibilityData();
      setData(rows);
    } catch (e) {
      setError('Failed to load data from Firestore. Check your Firebase config.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Auto scan ────────────────────────────────────────────────────────────

  const handleAutoScan = async () => {
    setScanning(true);
    setError('');
    try {
      await runAutoVisibilityCheck((_, done, total) => {
        setProgress({ done, total });
      });
      await reload();
    } catch (e) {
      setError('Auto scan failed. Check your Groq API key.');
      console.error(e);
    } finally {
      setScanning(false);
      setProgress({ done: 0, total: 0 });
    }
  };

  // ── Track single query ────────────────────────────────────────────────────

  const handleTrack = async () => {
    if (!newQuery.trim()) return;
    setTracking(true);
    setError('');
    try {
      const result = await checkVisibility(newQuery.trim(), 'groq');
      setData(prev => [result, ...prev]);
      setNewQuery('');
    } catch (e) {
      setError('Query failed. Check your Groq API key.');
      console.error(e);
    } finally {
      setTracking(false);
    }
  };

  // ── Derived metrics ───────────────────────────────────────────────────────

  const metrics = calculateMetrics(data);

  const chartData = metrics.byModel.length > 0
    ? metrics.byModel.map(m => ({ name: m.model, visibility: m.visibility, total: m.total }))
    : [{ name: 'groq', visibility: 0, total: 0 }];

  const filtered = modelFilter === 'All' ? data : data.filter(d => d.model === modelFilter);
  const models   = ['All', ...new Set(data.map(d => d.model))];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <span>⚠️</span> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* ── Metrics row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">AI Share of Voice</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-indigo-600">
              {loading ? '—' : `${metrics.shareOfVoice}%`}
            </p>
            {!loading && data.length > 0 && (
              <span className="text-xs font-bold text-slate-400 mb-1.5">
                {metrics.totalCitations}/{data.length} queries
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Percentage of AI responses mentioning <strong>MarketInsight</strong>.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Brand Sentiment</p>
          <p className={`text-3xl font-black ${sentimentColor(metrics.brandSentiment)}`}>
            {loading ? '—' : metrics.brandSentiment}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Based on {metrics.totalCitations} mentions analyzed.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Citations</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-slate-800">
              {loading ? '—' : metrics.totalCitations}
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Times brand appeared in AI-generated answers.
          </p>
        </div>
      </div>

      {/* ── Action bar ──────────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Track New AI Query</h3>
            <p className="text-sm text-slate-500">Check if MarketInsight appears in AI responses for any topic.</p>
          </div>
          <button
            onClick={handleAutoScan}
            disabled={scanning || loading}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap text-sm"
          >
            {scanning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning {progress.done}/{progress.total}…
              </>
            ) : '⚡ Auto Scan All'}
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTrack()}
            placeholder="e.g. best marketing analytics tools..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
          />
          <button
            onClick={handleTrack}
            disabled={tracking || !newQuery.trim()}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap text-sm flex items-center gap-2"
          >
            {tracking
              ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Checking…</>
              : '+ Track'}
          </button>
          <button
            onClick={reload}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm disabled:opacity-40"
            title="Refresh data"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Chart + Table ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm self-start sticky top-6">
          <h4 className="font-bold text-slate-800 mb-1">Visibility by AI Model</h4>
          <p className="text-xs text-slate-400 mb-5">% of queries where brand was mentioned</p>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} width={80} />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, 'Visibility']}
                    cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                  />
                  <Bar dataKey="visibility" radius={[0, 4, 4, 0]} barSize={28}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={MODEL_COLORS[entry.name] ?? '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {!loading && data.length === 0 && (
            <p className="text-xs text-slate-400 text-center mt-4">
              No data yet. Run a scan to get started.
            </p>
          )}
        </div>

        {/* Mentions table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-slate-800">Recent AI Mentions</h3>
              <p className="text-xs text-slate-400 mt-0.5">{data.length} results from Firestore</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {models.map(m => (
                <button
                  key={m}
                  onClick={() => setModelFilter(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    modelFilter === m ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <span className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Loading from Firestore…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                <p className="text-2xl mb-2">🔍</p>
                No results yet. Use <strong>Auto Scan</strong> or track a custom query above.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Query</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Model</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Mentioned</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Rank</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Sentiment</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(row => (
                    <React.Fragment key={row.id ?? row.timestamp}>
                      <tr className={`hover:bg-slate-50 transition-colors ${expanded === (row.id ?? '') ? 'bg-indigo-50/40' : ''}`}>
                        <td className="px-5 py-3 text-sm font-medium text-slate-700 max-w-[200px]">
                          <span className="truncate block" title={row.query}>{row.query}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold px-2 py-1 rounded border"
                            style={{ background: (MODEL_COLORS[row.model] ?? '#6366f1') + '15', color: MODEL_COLORS[row.model] ?? '#6366f1', borderColor: (MODEL_COLORS[row.model] ?? '#6366f1') + '30' }}>
                            {row.model}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {row.mentioned
                            ? <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded border border-green-200">✓ Yes</span>
                            : <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200">✗ No</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-sm font-black ${row.rank > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                            {row.rank > 0 ? `#${row.rank}` : '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded border ${sentimentBadge(row.sentiment)}`}>
                            {row.sentiment}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setExpanded(expanded === (row.id ?? '') ? null : (row.id ?? ''))}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                              expanded === (row.id ?? '')
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800'
                            }`}
                          >
                            {expanded === (row.id ?? '') ? 'Close' : 'View AI Response'}
                          </button>
                        </td>
                      </tr>
                      {expanded === (row.id ?? '') && (
                        <tr>
                          <td colSpan={6} className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-400 uppercase">
                                  {row.mentioned ? 'Brand Context in AI Response' : 'AI Response — Tools Mentioned'}
                                </p>
                                {!row.mentioned && (
                                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    MarketInsight not in list
                                  </span>
                                )}
                                {row.mentioned && row.rank > 0 && (
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                    Ranked #{row.rank}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-700 leading-relaxed max-h-72 overflow-y-auto overflow-x-hidden pr-1">
                                {renderMarkdown(row.context)}
                              </div>
                              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                                Scanned: {new Date(row.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiVisibilityTab;
