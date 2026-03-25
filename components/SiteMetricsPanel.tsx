import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  getRankedKeywords, RankedKeyword,
  RankedKeywordsMetrics, RankedKeywordsMetricSection,
  getHistoricalRankData, DomainRankHistoryPoint,
  getKeywordHistory, KeywordHistoryPoint,
} from '../services/dataForSEOService';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RangeFilter { min: string; max: string }
type SortTab = 'position' | 'traffic' | 'volume';
type SortDir = 'asc' | 'desc';

const EMPTY_RANGE: RangeFilter = { min: '', max: '' };

// ─── Filter Dropdown ──────────────────────────────────────────────────────────

interface FilterPreset { label: string; min?: number; max?: number }

interface FilterDropdownProps {
  label: string;
  presets: FilterPreset[];
  active: RangeFilter | null;
  onApply: (v: RangeFilter | null) => void;
  formatUnit?: string; // e.g. "$" prefix
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ label, presets, active, onApply, formatUnit = '' }) => {
  const [open, setOpen] = useState(false);
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const activeLabel = (() => {
    if (!active) return null;
    if (active.min !== '' && active.max !== '') return `${formatUnit}${active.min} - ${formatUnit}${active.max}`;
    if (active.min !== '') return `${formatUnit}${active.min}+`;
    if (active.max !== '') return `≤ ${formatUnit}${active.max}`;
    return null;
  })();

  const handlePreset = (p: FilterPreset) => {
    if (p.min !== undefined && p.max !== undefined) onApply({ min: String(p.min), max: String(p.max) });
    else if (p.min !== undefined) onApply({ min: String(p.min), max: '' });
    else if (p.max !== undefined) onApply({ min: '', max: String(p.max) });
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (customMin === '' && customMax === '') { onApply(null); }
    else { onApply({ min: customMin, max: customMax }); }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApply(null);
    setCustomMin('');
    setCustomMax('');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
          active
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        {active ? (
          <>
            <span className="font-semibold">{label}:</span>
            <span className="font-bold">{activeLabel}</span>
            <span onClick={handleClear} className="ml-0.5 text-indigo-400 hover:text-indigo-600 text-xs leading-none">✕</span>
          </>
        ) : (
          <>
            {label}
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-52 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {/* Presets */}
          <div className="py-1">
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => handlePreset(p)}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="border-t border-slate-100 px-3 py-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custom range</p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="From"
                value={customMin}
                onChange={e => setCustomMin(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                type="number"
                placeholder="To"
                value={customMax}
                onChange={e => setCustomMax(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold py-1.5 rounded-lg transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Presets ──────────────────────────────────────────────────────────────────

const POSITION_PRESETS: FilterPreset[] = [
  { label: 'Top 3',    max: 3   },
  { label: 'Top 10',   max: 10  },
  { label: 'Top 20',   max: 20  },
  { label: 'Top 50',   max: 50  },
  { label: '#1',       min: 1,  max: 1   },
  { label: '#4 - 10',  min: 4,  max: 10  },
  { label: '#11 - 20', min: 11, max: 20  },
  { label: '#21 - 50', min: 21, max: 50  },
  { label: '#51 - 100',min: 51, max: 100 },
];

const VOLUME_PRESETS: FilterPreset[] = [
  { label: '100,001+',          min: 100001          },
  { label: '10,001 - 100,000',  min: 10001, max: 100000 },
  { label: '1,001 - 10,000',    min: 1001,  max: 10000  },
  { label: '101 - 1,000',       min: 101,   max: 1000   },
  { label: '11 - 100',          min: 11,    max: 100    },
  { label: '1 - 10',            min: 1,     max: 10     },
];

const TRAFFIC_PRESETS: FilterPreset[] = [
  { label: '10,001+',         min: 10001            },
  { label: '1,001 - 10,000', min: 1001, max: 10000  },
  { label: '101 - 1,000',    min: 101,  max: 1000   },
  { label: '11 - 100',       min: 11,   max: 100    },
  { label: '1 - 10',         min: 1,    max: 10     },
  { label: '0',              min: 0,    max: 0      },
];

const CPC_PRESETS: FilterPreset[] = [
  { label: '$10+',          min: 10           },
  { label: '$5 - $10',      min: 5,   max: 10 },
  { label: '$2 - $5',       min: 2,   max: 5  },
  { label: '$1 - $2',       min: 1,   max: 2  },
  { label: '$0.50 - $1',    min: 0.5, max: 1  },
  { label: '$0 - $0.50',    min: 0,   max: 0.5},
];

// ─── Column config ────────────────────────────────────────────────────────────

const ALL_COLS = [
  { key: 'keyword',   label: 'Keyword',       fixed: true  },
  { key: 'url',       label: 'URL',           fixed: true  },
  { key: 'rank',      label: 'Rank',          fixed: true  },
  { key: 'traffic',   label: 'Traffic',       fixed: false },
  { key: 'volume',    label: 'Volume',        fixed: false },
  { key: 'cpc',       label: 'CPC',           fixed: false },
  { key: 'kd',        label: 'KD',            fixed: false },
  { key: 'intent',    label: 'Intent',        fixed: false },
  { key: 'change',    label: 'Change',        fixed: false },
  { key: 'trend',     label: 'Trend',         fixed: false },
  { key: 'serp',      label: 'SERP Features', fixed: false },
  { key: 'comp',      label: 'Competition',   fixed: false },
] as const;

type ColKey = typeof ALL_COLS[number]['key'];

const COLS_DEFAULT: Record<ColKey, boolean> = {
  keyword: true, url: true, rank: true, traffic: true, volume: true,
  cpc: true, kd: true, intent: true, change: true, trend: false, serp: false, comp: true,
};

// ─── Intent badge ─────────────────────────────────────────────────────────────

const INTENT_STYLE: Record<string, string> = {
  commercial:     'bg-blue-100 text-blue-700',
  informational:  'bg-green-100 text-green-700',
  transactional:  'bg-purple-100 text-purple-700',
  navigational:   'bg-orange-100 text-orange-700',
};

// ─── SERP feature badges ──────────────────────────────────────────────────────

const SERP_BADGE: Record<string, { label: string; cls: string }> = {
  ai_overview:       { label: 'AI',  cls: 'bg-violet-100 text-violet-700' },
  featured_snippet:  { label: 'FS',  cls: 'bg-blue-100 text-blue-700'     },
  people_also_ask:   { label: 'PAA', cls: 'bg-slate-100 text-slate-600'   },
  video:             { label: 'VID', cls: 'bg-red-100 text-red-700'       },
};

// ─── KD color ─────────────────────────────────────────────────────────────────

const kdColor = (v: number) =>
  v < 30 ? 'text-green-600' : v < 60 ? 'text-amber-500' : v < 80 ? 'text-red-500' : 'text-red-800';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inRange = (val: number | null, f: RangeFilter | null): boolean => {
  if (!f) return true;
  const v = val ?? 0;
  const lo = f.min !== '' ? Number(f.min) : -Infinity;
  const hi = f.max !== '' ? Number(f.max) : Infinity;
  return v >= lo && v <= hi;
};

const fmtNum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : n.toLocaleString();

// ─── Main Component ───────────────────────────────────────────────────────────

const SiteMetricsPanel: React.FC = () => {
  const [trackedDomain] = useState(() => localStorage.getItem('mi_tracked_domain') ?? '');
  const [data, setData] = useState<RankedKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Sort tab
  const [sortTab, setSortTab] = useState<SortTab>('position');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Filters
  const [kwSearch, setKwSearch] = useState('');
  const [posFilter, setPosFilter] = useState<RangeFilter | null>(null);
  const [trafficFilter, setTrafficFilter] = useState<RangeFilter | null>(null);
  const [volumeFilter, setVolumeFilter] = useState<RangeFilter | null>(null);
  const [cpcFilter, setCpcFilter] = useState<RangeFilter | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Column visibility — persisted in localStorage
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('sm_visible_cols') ?? 'null') ?? COLS_DEFAULT; }
    catch { return COLS_DEFAULT; }
  });
  const [colsMenuOpen, setColsMenuOpen] = useState(false);
  const colsMenuRef = useRef<HTMLDivElement>(null);

  // Expanded row index + its chart time range
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedTimeRange, setExpandedTimeRange] = useState<'3M'|'6M'|'1Y'|'2Y'|'all'>('all');

  // Keyword history — fetched on expand, cached in memory across row changes
  const kwHistoryCache = useRef<Map<string, KeywordHistoryPoint[]>>(new Map());
  const [kwHistoryData, setKwHistoryData] = useState<KeywordHistoryPoint[]>([]);
  const [kwHistoryLoading, setKwHistoryLoading] = useState(false);

  // Section 1 & 2 — metrics from ranked_keywords response
  const [kwMetrics, setKwMetrics] = useState<RankedKeywordsMetrics | null>(null);

  // Section 3 — historical chart
  const [historyData, setHistoryData] = useState<DomainRankHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTimeRange, setHistoryTimeRange] = useState<'1M'|'3M'|'6M'|'1Y'|'2Y'|'all'>('all');
  const [historyTab, setHistoryTab] = useState<'organic'|'paid'>('organic');
  const historyRef = useRef<HTMLDivElement>(null);
  const historyFetchedRef = useRef(false);  // prevents observer firing after manual refresh
  const isRefreshingRef = useRef(false);    // prevents concurrent refresh calls

  const domainClean = trackedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

  // Single coordinated refresh — 2 parallel API calls, guarded against re-entry
  const handleRefreshAll = async () => {
    if (isRefreshingRef.current || !trackedDomain) return;
    isRefreshingRef.current = true;
    historyFetchedRef.current = true; // block observer from firing during refresh
    setLoading(true);
    setHistoryLoading(true);
    setHasMore(false);
    try {
      const [kwRes, histRes] = await Promise.all([
        getRankedKeywords(domainClean, true, 50),
        getHistoricalRankData(domainClean, 2840, true),
      ]);
      setData(kwRes.items);
      setKwMetrics(kwRes.metrics);
      setCachedAt(kwRes.cachedAt);
      setTotalCount(kwRes.totalCount);
      setHasMore(kwRes.items.length >= 50);
      setHistoryData(histRes.items);
    } catch (err) {
      console.error('[SiteMetrics] Refresh all failed:', err);
    } finally {
      setLoading(false);
      setHistoryLoading(false);
      isRefreshingRef.current = false;
    }
  };

  // Initial load: first 50 keywords only
  const fetch = async (force = false) => {
    if (!trackedDomain) return;
    setLoading(true);
    setHasMore(false);
    try {
      const res = await getRankedKeywords(domainClean, force, 50);
      setData(res.items);
      setKwMetrics(res.metrics);
      setCachedAt(res.cachedAt);
      setTotalCount(res.totalCount);
      setHasMore(res.items.length >= 50);
    } catch (err) {
      console.error('[SiteMetrics] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load next 50 (items 51-100) and append to existing list
  const loadMore = async () => {
    if (isLoadingMore || !trackedDomain) return;
    setIsLoadingMore(true);
    try {
      const res = await getRankedKeywords(domainClean, false, 100);
      setData(prev => [...prev, ...res.items]);
      setHasMore(false);
    } catch (err) {
      console.error('[SiteMetrics] Load more failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Lazy history fetch — only triggered by IntersectionObserver, never by refresh
  const fetchHistory = async () => {
    if (!trackedDomain || isRefreshingRef.current) return;
    setHistoryLoading(true);
    try {
      const res = await getHistoricalRankData(domainClean, 2840, false);
      setHistoryData(res.items);
    } catch (err) {
      console.error('[SiteMetrics] History fetch failed:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Guard prevents React StrictMode double-invocation from firing two requests
  const initialFetchDoneRef = useRef(false);
  useEffect(() => {
    if (!trackedDomain || initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    fetch(false);
  }, []); // eslint-disable-line

  // Lazy-load history when section scrolls into view (fires at most once unless refresh resets it)
  useEffect(() => {
    if (!trackedDomain || !historyRef.current) return;
    const el = historyRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !historyFetchedRef.current && !isRefreshingRef.current) {
        historyFetchedRef.current = true;
        fetchHistory();
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line — run once on mount only

  const domain = trackedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');

  // Close columns menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (colsMenuRef.current && !colsMenuRef.current.contains(e.target as Node)) setColsMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Fetch keyword search volume history when a row is expanded
  useEffect(() => {
    if (expandedRow === null) { setKwHistoryData([]); return; }
    const keyword = filtered[expandedRow]?.keyword;
    if (!keyword) return;
    if (kwHistoryCache.current.has(keyword)) {
      setKwHistoryData(kwHistoryCache.current.get(keyword)!);
      return;
    }
    setKwHistoryLoading(true);
    setKwHistoryData([]);
    getKeywordHistory(keyword)
      .then(data => { kwHistoryCache.current.set(keyword, data); setKwHistoryData(data); })
      .catch(err => console.error('[SiteMetrics] Keyword history failed:', err))
      .finally(() => setKwHistoryLoading(false));
  }, [expandedRow]); // eslint-disable-line

  const toggleCol = (key: ColKey) => {
    setVisibleCols(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sm_visible_cols', JSON.stringify(next));
      return next;
    });
  };

  const col = (key: ColKey) => visibleCols[key] ?? COLS_DEFAULT[key];

  // Filtered + sorted data
  const filtered = useMemo(() => {
    let rows = data.filter(row => {
      if (kwSearch && !row.keyword.toLowerCase().includes(kwSearch.toLowerCase())) return false;
      if (!inRange(row.rank, posFilter)) return false;
      if (!inRange(row.trafficPercent, trafficFilter)) return false;
      if (!inRange(row.searchVolume, volumeFilter)) return false;
      if (!inRange(row.cpc, cpcFilter)) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let av: number, bv: number;
      if (sortTab === 'position') { av = a.rank; bv = b.rank; }
      else if (sortTab === 'traffic') { av = a.trafficPercent; bv = b.trafficPercent; }
      else { av = a.searchVolume; bv = b.searchVolume; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return rows;
  }, [data, kwSearch, posFilter, trafficFilter, volumeFilter, cpcFilter, sortTab, sortDir]);

  const toggleSort = (tab: SortTab) => {
    if (sortTab === tab) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortTab(tab); setDir('asc'); }
  };
  const [, setDir] = [sortDir, setSortDir];

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((_, i) => i)));
  };

  const toggleRow = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const exportCSV = () => {
    const rows = selected.size > 0 ? filtered.filter((_, i) => selected.has(i)) : filtered;
    const headers = ['#', 'Keyword', 'URL', 'Rank', 'Traffic', 'Monthly S. Volume', 'CPC', 'Competition'];
    const csv = [
      headers.join(','),
      ...rows.map((r, i) => [
        i + 1,
        `"${r.keyword}"`,
        `"${r.url}"`,
        r.rank,
        r.trafficPercent.toFixed(2),
        r.searchVolume,
        r.cpc ?? '',
        r.competition ?? '',
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ranked-keywords-${domain}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = [posFilter, trafficFilter, volumeFilter, cpcFilter].filter(Boolean).length;

  const SortIcon = ({ tab }: { tab: SortTab }) => (
    <svg className={`w-3 h-3 inline ml-0.5 ${sortTab === tab ? 'text-indigo-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
        d={sortTab === tab && sortDir === 'desc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  );

  // ── helpers for rank distribution ─────────────────────────────────────────
  const org = kwMetrics?.organic;
  const rankBuckets = org ? [
    { label: '#1',      value: org.pos_1,                                       color: '#10b981' },
    { label: '#2–3',    value: org.pos_2_3,                                     color: '#34d399' },
    { label: '#4–10',   value: org.pos_4_10,                                    color: '#6ee7b7' },
    { label: '#11–20',  value: org.pos_11_20,                                   color: '#a7f3d0' },
    { label: '#21–50',  value: (org.pos_21_30 ?? 0) + (org.pos_31_40 ?? 0) + (org.pos_41_50 ?? 0), color: '#d1d5db' },
    { label: '#51–100', value: (org.pos_51_60 ?? 0) + (org.pos_61_70 ?? 0) + (org.pos_71_80 ?? 0) + (org.pos_81_90 ?? 0) + (org.pos_91_100 ?? 0), color: '#9ca3af' },
  ] : [];

  // ── filtered history for time range ───────────────────────────────────────
  const filteredHistory = useMemo(() => {
    if (!historyData.length) return historyData;
    const now = new Date();
    const cutoff = new Map<string, Date>([
      ['1M',  new Date(now.getFullYear(), now.getMonth() - 1, 1)],
      ['3M',  new Date(now.getFullYear(), now.getMonth() - 3, 1)],
      ['6M',  new Date(now.getFullYear(), now.getMonth() - 6, 1)],
      ['1Y',  new Date(now.getFullYear() - 1, now.getMonth(), 1)],
      ['2Y',  new Date(now.getFullYear() - 2, now.getMonth(), 1)],
      ['all', new Date(0)],
    ]);
    const from = cutoff.get(historyTimeRange)!;
    return historyData.filter(p => new Date(p.date) >= from);
  }, [historyData, historyTimeRange]);

  // Search volume history for the expanded keyword — sourced from API call
  const MONTH_LABELS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const expandedMonthlyData = useMemo(() => {
    if (!kwHistoryData.length) return [];
    const now = new Date();
    const monthsBack: Record<string, number> = { '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, 'all': 999 };
    const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack[expandedTimeRange], 1);
    return kwHistoryData
      .filter(p => new Date(p.date) >= cutoff)
      .map(p => {
        const [y, m] = p.date.split('-');
        return { date: `${MONTH_LABELS[+m]} ${y.slice(2)}`, volume: p.searchVolume };
      });
  }, [kwHistoryData, expandedTimeRange]);

  // Large card — Organic / Paid
  const MetricCard = ({ title, m, accent = 'cyan' }: { title: string; m: RankedKeywordsMetricSection | null; accent?: string }) => (
    <div className="flex-1 bg-slate-900 rounded-2xl p-5 min-w-0">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{title}</p>
      {!m || m.count === 0 && m.etv === 0 ? (
        <p className="text-sm text-slate-500 italic">No data for this domain</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Keywords</p>
            <p className="text-2xl font-black text-white">{fmtNum(m.count)}</p>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="text-green-400">↑ {fmtNum(m.is_new ?? 0)}</span>
              <span className="text-red-400">↓ {fmtNum(m.is_lost ?? 0)}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Top 3: {(m.pos_1 ?? 0) + (m.pos_2_3 ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Traffic (ETV)</p>
            <p className="text-2xl font-black text-white">{fmtNum(Math.round(m.etv))}</p>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="text-green-400">↑ {fmtNum(m.is_up ?? 0)}</span>
              <span className="text-red-400">↓ {fmtNum(m.is_down ?? 0)}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Value: ${fmtNum(Math.round(m.estimated_paid_traffic_cost ?? 0))}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // Small card — Featured Snippet / Local Pack / AI Overview
  const MiniMetricCard = ({ title, icon, m, color }: {
    title: string; icon: string; m: RankedKeywordsMetricSection | null; color: string
  }) => (
    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 min-w-0 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      </div>
      {!m || m.count === 0 ? (
        <p className="text-xs text-slate-400 italic">Not ranking</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-end justify-between">
            <p className={`text-xl font-black ${color}`}>{fmtNum(m.count)}</p>
            <p className="text-[10px] text-slate-400">keywords</p>
          </div>
          <p className="text-xs text-slate-500">Traffic: <span className="font-semibold text-slate-700">{fmtNum(Math.round(m.etv))}</span></p>
          <p className="text-xs text-slate-500">Top 3: <span className="font-semibold text-slate-700">{(m.pos_1 ?? 0) + (m.pos_2_3 ?? 0)}</span></p>
          {(m.is_new ?? 0) > 0 && <p className="text-xs text-green-500">↑ {fmtNum(m.is_new ?? 0)} new</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button className="px-6 py-2 rounded-lg text-sm font-bold transition-all bg-white text-indigo-600 shadow-sm">
            Organic Ranking
          </button>
        </div>
        {trackedDomain && (
          <button
            onClick={handleRefreshAll}
            disabled={loading || historyLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${(loading || historyLoading) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh All
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — Search Type Summary Cards
      ══════════════════════════════════════════════════════════════ */}
      {trackedDomain && (loading || kwMetrics) && (
        <div className="space-y-3">
          {/* Row 1 — Organic + Paid (large dark cards) */}
          <div className="flex gap-4">
            {loading && !kwMetrics ? (
              <>
                {[0, 1].map(i => (
                  <div key={i} className="flex-1 bg-slate-900 rounded-2xl p-5 animate-pulse space-y-3">
                    <div className="h-3 bg-slate-700 rounded w-20" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><div className="h-7 bg-slate-700 rounded w-16" /><div className="h-3 bg-slate-700 rounded w-12" /></div>
                      <div className="space-y-2"><div className="h-7 bg-slate-700 rounded w-16" /><div className="h-3 bg-slate-700 rounded w-12" /></div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <MetricCard title="Organic" m={kwMetrics?.organic ?? null} />
                <MetricCard title="Paid" m={kwMetrics?.paid ?? null} />
              </>
            )}
          </div>

          {/* Row 2 — Featured Snippet + Local Pack + AI Overview (smaller light cards) */}
          <div className="flex gap-3">
            {loading && !kwMetrics ? (
              <>
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex-1 bg-white border border-slate-200 rounded-xl p-4 animate-pulse space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-24" />
                    <div className="h-6 bg-slate-100 rounded w-16" />
                    <div className="h-3 bg-slate-100 rounded w-20" />
                  </div>
                ))}
              </>
            ) : (
              <>
                <MiniMetricCard title="Featured Snippet" icon="⭐" m={kwMetrics?.featuredSnippet ?? null} color="text-blue-600" />
                <MiniMetricCard title="Local Pack"       icon="📍" m={kwMetrics?.localPack ?? null}       color="text-orange-600" />
                <MiniMetricCard title="AI Overview"      icon="🤖" m={kwMetrics?.aiOverviewReference ?? null} color="text-violet-600" />
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 & 3 — Rank Distribution + Historical Chart
      ══════════════════════════════════════════════════════════════ */}
      {trackedDomain && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Section 2: Rank Distribution ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Rank Distribution</h3>
            {loading && rankBuckets.length === 0 ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(6)].map((_, i) => <div key={i} className="h-7 bg-slate-100 rounded" />)}
              </div>
            ) : rankBuckets.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-8">Fetch data to see rank distribution</p>
            ) : (
              <div className="space-y-2.5">
                {rankBuckets.map(b => {
                  const total = rankBuckets.reduce((s, x) => s + x.value, 0) || 1;
                  const pct = Math.round((b.value / total) * 100);
                  return (
                    <div key={b.label} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500 w-14 shrink-0">{b.label}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: b.color, minWidth: b.value > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-12 text-right shrink-0">
                        {fmtNum(b.value)}
                      </span>
                      <span className="text-[10px] text-slate-400 w-8 shrink-0">{pct}%</span>
                    </div>
                  );
                })}
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                  <span>Total tracked: <strong className="text-slate-800">{fmtNum(rankBuckets.reduce((s, b) => s + b.value, 0))}</strong></span>
                  <span className="text-green-600 font-semibold">Top 3: {fmtNum((org?.pos_1 ?? 0) + (org?.pos_2_3 ?? 0))}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3: Historical Metrics Chart ── */}
          <div ref={historyRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Historical Metrics</h3>
                {/* Organic / Paid tab */}
                <div className="flex gap-1 ml-2">
                  {(['organic', 'paid'] as const).map(t => (
                    <button key={t} onClick={() => setHistoryTab(t)}
                      className={`px-3 py-0.5 rounded-md text-xs font-semibold transition-all capitalize ${historyTab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* Time range */}
              <div className="flex gap-1">
                {(['1M','3M','6M','1Y','2Y','all'] as const).map(r => (
                  <button key={r} onClick={() => setHistoryTimeRange(r)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${historyTimeRange === r ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    {r === 'all' ? 'All time' : r}
                  </button>
                ))}
              </div>
            </div>

            {historyLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Loading history…</p>
                </div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="h-48 flex items-center justify-center flex-col gap-2">
                <p className="text-sm text-slate-400">
                  {historyFetchedRef.current ? 'No historical data available' : 'Scroll down to load'}
                </p>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex gap-4 mb-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: '#6366f1', display: 'inline-block' }} />
                    <span className="text-slate-600 font-medium">
                      {historyTab === 'organic' ? 'Organic Keywords' : 'Paid Keywords'}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded" style={{ backgroundColor: '#8b5cf6', display: 'inline-block' }} />
                    <span className="text-slate-600 font-medium">
                      {historyTab === 'organic' ? 'Organic Traffic' : 'Paid Traffic'}
                    </span>
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={filteredHistory} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="gKw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gTr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      tickFormatter={v => { const [y, m] = v.split('-'); return `${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m]} ${y?.slice(2)}`; }}
                      interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      tickFormatter={v => fmtNum(v)} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(v: number, name: string) => [fmtNum(v), name]}
                    />
                    <Area type="monotone"
                      dataKey={historyTab === 'organic' ? 'organicKeywords' : 'paidKeywords'}
                      name={historyTab === 'organic' ? 'Organic Keywords' : 'Paid Keywords'}
                      stroke="#6366f1" strokeWidth={2} fill="url(#gKw)" dot={false} />
                    <Area type="monotone"
                      dataKey={historyTab === 'organic' ? 'organicTraffic' : 'paidTraffic'}
                      name={historyTab === 'organic' ? 'Organic Traffic' : 'Paid Traffic'}
                      stroke="#8b5cf6" strokeWidth={2} fill="url(#gTr)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      )}

    <div className="space-y-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">

        {/* Sort tabs */}
        <div className="flex items-center gap-1">
          {(['position', 'traffic', 'volume'] as SortTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => {
                if (sortTab === tab) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setSortTab(tab); setSortDir('asc'); }
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all capitalize ${
                sortTab === tab
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {tab === 'position' ? 'Position' : tab === 'traffic' ? 'Traffic' : 'Search Volume'}
              <SortIcon tab={tab} />
            </button>
          ))}

          <span className="ml-3 text-sm text-slate-500">
            Filtered organic keywords: <strong className="text-slate-800">{filtered.length}</strong>
            {totalCount > 0 && <span className="text-slate-400"> of {totalCount.toLocaleString()} total</span>}
            &nbsp;&nbsp;Selected: <strong className="text-slate-800">{selected.size}</strong>
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {cachedAt && (
            <span className="text-xs text-slate-400">
              Updated {Math.floor((Date.now() - cachedAt) / (1000 * 60 * 60 * 24))}d ago
            </span>
          )}
          {trackedDomain && (
            <button
              onClick={() => fetch(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 bg-slate-50/60">

        {/* Keyword search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Keyword"
            value={kwSearch}
            onChange={e => setKwSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 w-44"
          />
          {kwSearch && (
            <button onClick={() => setKwSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>

        <FilterDropdown label="Position" presets={POSITION_PRESETS} active={posFilter} onApply={setPosFilter} />
        <FilterDropdown label="Traffic"  presets={TRAFFIC_PRESETS}  active={trafficFilter} onApply={setTrafficFilter} />
        <FilterDropdown label="Volume"   presets={VOLUME_PRESETS}   active={volumeFilter} onApply={setVolumeFilter} />
        <FilterDropdown label="CPC"      presets={CPC_PRESETS}      active={cpcFilter} onApply={setCpcFilter} formatUnit="$" />

        {/* Clear all */}
        {(activeFilterCount > 0 || kwSearch) && (
          <button
            onClick={() => { setPosFilter(null); setTrafficFilter(null); setVolumeFilter(null); setCpcFilter(null); setKwSearch(''); }}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Clear all filters
          </button>
        )}

        {/* Columns picker */}
        <div className="relative ml-auto" ref={colsMenuRef}>
          <button
            onClick={() => setColsMenuOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 bg-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Columns
          </button>
          {colsMenuOpen && (
            <div className="absolute right-0 top-9 z-30 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
              {ALL_COLS.filter(c => !c.fixed).map(c => (
                <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={col(c.key)}
                    onChange={() => toggleCol(c.key)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Domain badge */}
        <div className="flex items-center gap-1.5">
          {data.length > 0 && (
            <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full font-semibold">
              🏆 {domain}
            </span>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      {!trackedDomain ? (
        <div className="p-16 text-center text-slate-400">
          <p className="text-4xl mb-3">🏠</p>
          <p className="text-sm font-medium">Set a tracked domain in <strong className="text-slate-600">SEO Suite → Rankings</strong> to load organic keyword data.</p>
        </div>
      ) : loading ? (
        <div className="p-6 space-y-3.5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex gap-6 animate-pulse px-5">
              <div className="h-3.5 bg-slate-100 rounded w-4" />
              <div className="h-3.5 bg-slate-100 rounded flex-1" />
              <div className="h-3.5 bg-slate-100 rounded w-36" />
              <div className="h-3.5 bg-slate-100 rounded w-10" />
              <div className="h-3.5 bg-slate-100 rounded w-14" />
              <div className="h-3.5 bg-slate-100 rounded w-14" />
              <div className="h-3.5 bg-slate-100 rounded w-12" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="p-16 text-center space-y-3">
          <p className="text-4xl">🔍</p>
          <p className="text-sm text-slate-500">No ranked keywords found for <strong>{domain}</strong>.</p>
          <button onClick={() => fetch(true)} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors">
            Try Again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-400">
          No keywords match the current filters.&nbsp;
          <button onClick={() => { setPosFilter(null); setTrafficFilter(null); setVolumeFilter(null); setCpcFilter(null); setKwSearch(''); }} className="text-indigo-500 hover:underline font-semibold">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto relative">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                {/* Keyword — fixed + sticky */}
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide sticky left-0 z-20 bg-slate-50 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Keyword</th>
                {/* URL — fixed */}
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">URL</th>
                {/* Rank — fixed */}
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => { setSortTab('position'); setSortDir(d => sortTab === 'position' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); }}>
                  <span className={sortTab === 'position' ? 'text-indigo-600' : 'text-slate-500'}>Rank <SortIcon tab="position" /></span>
                </th>
                {col('traffic') && (
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => { setSortTab('traffic'); setSortDir(d => sortTab === 'traffic' ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); }}>
                    <span className={sortTab === 'traffic' ? 'text-indigo-600' : 'text-slate-500'}>Traffic <SortIcon tab="traffic" /></span>
                  </th>
                )}
                {col('volume') && (
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => { setSortTab('volume'); setSortDir(d => sortTab === 'volume' ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); }}>
                    <span className={sortTab === 'volume' ? 'text-indigo-600' : 'text-slate-500'}>Monthly S. Volume <SortIcon tab="volume" /></span>
                  </th>
                )}
                {col('cpc')    && <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">CPC</th>}
                {col('kd')     && <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">KD</th>}
                {col('intent') && <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">Intent</th>}
                {col('change') && <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">Change</th>}
                {col('trend')  && <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">Trend</th>}
                {col('serp')   && <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">SERP</th>}
                {col('comp')   && <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">Competition</th>}
                {/* expand chevron spacer */}
                <th className="px-3 py-3 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((row, i) => {
                const isExpanded = expandedRow === i;
                const rc = row.rankChange;
                const kd = row.keywordDifficulty;
                const trend = row.volumeTrend?.monthly;
                const visFeatures = row.serpFeatures.filter(f => SERP_BADGE[f]);

                return (
                  <React.Fragment key={i}>
                    <tr
                      className={`group transition-colors cursor-pointer ${selected.has(i) ? 'bg-indigo-50/60' : isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                      onClick={() => { setExpandedRow(isExpanded ? null : i); setExpandedTimeRange('all'); }}
                    >
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      </td>
                      {/* Keyword — sticky */}
                      <td className={`px-4 py-3 font-semibold text-blue-600 max-w-[200px] sticky left-0 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] ${selected.has(i) ? 'bg-indigo-50' : isExpanded ? 'bg-slate-50' : 'bg-white group-hover:bg-slate-50'}`}>
                        <span className="truncate block" title={row.keyword}>{row.keyword}</span>
                      </td>
                      {/* URL */}
                      <td className="px-4 py-3 text-blue-500 max-w-[280px]" onClick={e => e.stopPropagation()}>
                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="truncate block text-xs hover:underline" title={row.url}>
                          {row.url.length > 55 ? `${row.url.slice(0, 55)}…` : row.url}
                        </a>
                      </td>
                      {/* Rank */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-black ${row.rank <= 3 ? 'text-green-600' : row.rank <= 10 ? 'text-amber-500' : row.rank <= 20 ? 'text-slate-700' : 'text-slate-400'}`}>
                          #{row.rank}
                        </span>
                      </td>
                      {/* Traffic */}
                      {col('traffic') && <td className="px-4 py-3 text-right text-slate-700 font-medium">{fmtNum(Math.round(row.trafficPercent))}</td>}
                      {/* Volume */}
                      {col('volume')  && <td className="px-4 py-3 text-right text-slate-700 font-semibold">{fmtNum(row.searchVolume)}</td>}
                      {/* CPC */}
                      {col('cpc')     && <td className="px-4 py-3 text-right text-slate-600">{row.cpc != null ? `$${row.cpc.toFixed(2)}` : <span className="text-slate-300">—</span>}</td>}
                      {/* KD */}
                      {col('kd') && (
                        <td className="px-4 py-3 text-center">
                          {kd != null ? (
                            <span className={`text-xs font-bold ${kdColor(kd)}`}>{kd}</span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      )}
                      {/* Intent */}
                      {col('intent') && (
                        <td className="px-4 py-3 text-center" title={row.foreignIntent?.join(', ') ?? undefined}>
                          {row.searchIntent ? (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${INTENT_STYLE[row.searchIntent] ?? 'bg-slate-100 text-slate-500'}`}>
                              {row.searchIntent.slice(0, 3).toUpperCase()}
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      )}
                      {/* Change */}
                      {col('change') && (
                        <td className="px-4 py-3 text-center text-xs" title={rc?.previousRank != null ? `Was #${rc.previousRank}` : undefined}>
                          {rc?.isNew  ? <span className="bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full text-[10px]">NEW</span>
                          : rc?.isUp  ? <span className="text-green-600 font-bold">↑{rc.previousRank != null ? ` #${rc.previousRank}` : ''}</span>
                          : rc?.isDown ? <span className="text-red-500 font-bold">↓{rc.previousRank != null ? ` #${rc.previousRank}` : ''}</span>
                          : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      {/* Trend */}
                      {col('trend') && (
                        <td className="px-4 py-3 text-center text-xs font-semibold">
                          {trend != null
                            ? <span className={trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-slate-400'}>
                                {trend > 0 ? '+' : ''}{trend}%
                              </span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      {/* SERP Features */}
                      {col('serp') && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {visFeatures.slice(0, 2).map(f => (
                              <span key={f} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SERP_BADGE[f].cls}`}>{SERP_BADGE[f].label}</span>
                            ))}
                            {visFeatures.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-semibold" title={visFeatures.slice(2).map(f => SERP_BADGE[f]?.label ?? f).join(', ')}>
                                +{visFeatures.length - 2}
                              </span>
                            )}
                            {visFeatures.length === 0 && <span className="text-slate-300 text-xs">—</span>}
                          </div>
                        </td>
                      )}
                      {/* Competition */}
                      {col('comp') && (
                        <td className="px-4 py-3 text-center">
                          {row.competition ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.competition === 'LOW' ? 'bg-green-100 text-green-700' : row.competition === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : row.competition === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
                              {row.competition}
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      )}
                      {/* Expand chevron */}
                      <td className="px-3 py-3 text-slate-400">
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                    </tr>

                    {/* ── Expanded detail panel ── */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={99} className="px-8 py-6">
                          <div className="space-y-5">

                            {/* ── Backlinks for this URL ── */}
                            {row.backlinks && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Backlinks for this URL</p>
                                <div className="flex gap-10">
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Total Backlinks</p>
                                    <p className="text-sm font-bold text-slate-800">{row.backlinks.count != null ? fmtNum(row.backlinks.count) : '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Referring Domains</p>
                                    <p className="text-sm font-bold text-slate-800">{row.backlinks.referringDomains != null ? fmtNum(row.backlinks.referringDomains) : '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Dofollow</p>
                                    <p className="text-sm font-bold text-slate-800">{row.backlinks.dofollow != null ? fmtNum(row.backlinks.dofollow) : '—'}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── Avg Backlinks (SERP Competition) ── */}
                            {row.avgBacklinks && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Avg Backlinks (SERP Competition)</p>
                                <div className="flex gap-10">
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Avg Backlinks</p>
                                    <p className="text-sm font-bold text-slate-800">{row.avgBacklinks.count != null ? fmtNum(row.avgBacklinks.count) : '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Avg Ref Domains</p>
                                    <p className="text-sm font-bold text-slate-800">{row.avgBacklinks.referringDomains != null ? fmtNum(row.avgBacklinks.referringDomains) : '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Domain Rank</p>
                                    <p className="text-sm font-bold text-slate-800">{row.avgBacklinks.rank != null ? Math.round(row.avgBacklinks.rank) : '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Main Domain Rank</p>
                                    <p className="text-sm font-bold text-slate-800">{row.avgBacklinks.mainDomainRank != null ? Math.round(row.avgBacklinks.mainDomainRank) : '—'}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── Volume Trend ── */}
                            {row.volumeTrend && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Volume Trend</p>
                                <div className="flex gap-10">
                                  {(['monthly', 'quarterly', 'yearly'] as const).map(period => {
                                    const v = row.volumeTrend![period];
                                    return (
                                      <div key={period}>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 capitalize">{period}</p>
                                        <p className={`text-sm font-bold ${v == null ? 'text-slate-400' : v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                          {v != null ? `${v > 0 ? '+' : ''}${v}%` : '—'}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* ── Historical Metrics Chart ── */}
                            <div className="pt-4 border-t border-slate-200">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <h4 className="text-sm font-bold text-slate-800">Historical Metrics</h4>
                                  <div className="flex gap-1">
                                    <span className="px-3 py-0.5 rounded-md text-xs font-semibold bg-slate-900 text-white">Volume</span>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  {(['3M','6M','1Y','2Y','all'] as const).map(r => (
                                    <button key={r} onClick={() => setExpandedTimeRange(r)}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${expandedTimeRange === r ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                      {r === 'all' ? 'All time' : r}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Legend */}
                              <div className="flex gap-4 mb-2 text-xs">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: '#6366f1' }} />
                                  <span className="text-slate-600 font-medium">Search Volume</span>
                                </span>
                              </div>

                              {kwHistoryLoading ? (
                                <div className="h-44 flex items-center justify-center gap-2">
                                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-xs text-slate-400">Loading history…</span>
                                </div>
                              ) : expandedMonthlyData.length === 0 ? (
                                <div className="h-44 flex items-center justify-center">
                                  <p className="text-xs text-slate-400">No historical data available</p>
                                </div>
                              ) : (
                                <ResponsiveContainer width="100%" height={180}>
                                  <AreaChart data={expandedMonthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                                    <defs>
                                      <linearGradient id="gKwVol" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => fmtNum(v)} />
                                    <Tooltip
                                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                                      labelStyle={{ color: '#94a3b8' }}
                                      formatter={(v: number) => [fmtNum(v), 'Search Volume']}
                                    />
                                    <Area type="monotone" dataKey="volume" name="Search Volume" stroke="#6366f1" strokeWidth={2} fill="url(#gKwVol)" dot={false} />
                                  </AreaChart>
                                </ResponsiveContainer>
                              )}
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Load More / End caption */}
          <div className="flex flex-col items-center justify-center py-5 border-t border-slate-100">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {isLoadingMore ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Load More (50 → 100)
                  </>
                )}
              </button>
            ) : data.length >= 100 ? (
              <p className="text-xs text-slate-400">
                Showing {data.length} of {totalCount > 0 ? totalCount.toLocaleString() : '—'} keywords
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default SiteMetricsPanel;
