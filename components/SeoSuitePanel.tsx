
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { runSeoAuditViaSerpAPI } from '../services/seoAuditService';
import { getSerpRankings, getGoogleAdsData, getLLMVisibility } from '../services/dataForSEOService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { DateRange } from '../types';
import { Search, MapPin, X, ChevronDown } from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

// ─── Searchable Location Combobox ────────────────────────────────────────────

interface LocationSearchProps {
  locations: string[];
  value: string;
  onChange: (v: string) => void;
}

const LocationSearch: React.FC<LocationSearchProps> = ({ locations, value, onChange }) => {
  const [query,  setQuery]  = useState('');
  const [open,   setOpen]   = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? locations.filter(l => l.toLowerCase().includes(query.toLowerCase()))
    : locations;

  const handleSelect = (loc: string) => {
    onChange(loc); setOpen(false); setQuery('');
  };

  return (
    <div ref={wrapRef} className="relative min-w-[220px]">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="w-full flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
      >
        <MapPin size={13} className="text-indigo-500 shrink-0" />
        <span className="flex-1 text-left truncate">{value}</span>
        <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[260px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0]);
              }}
              placeholder="Search location…"
              className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder-slate-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>
          {/* Options list */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No locations found</p>
            ) : filtered.map(loc => (
              <button
                key={loc}
                onClick={() => handleSelect(loc)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2
                  ${loc === value ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'}`}
              >
                <MapPin size={11} className="shrink-0 opacity-40" />
                {query ? (
                  <span dangerouslySetInnerHTML={{
                    __html: loc.replace(
                      new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                      '<mark class="bg-yellow-100 text-yellow-800 rounded">$1</mark>'
                    )
                  }} />
                ) : loc}
              </button>
            ))}
          </div>
          {filtered.length > 0 && (
            <p className="text-[10px] text-slate-400 text-center py-1.5 border-t border-slate-100">
              {filtered.length} location{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
};


interface KeywordHistory {
  date: string;
  rank: number;
}

interface SerpResult {
  rank: number;
  title: string;
  url: string;
  domain: string;
}

interface KeywordData {
  id: string;
  keyword: string;
  location: string;
  rank: number;
  rankStatus?: 'loading' | 'found' | 'not_found' | 'error';
  change: number;
  volume: number;
  volumeStatus?: 'loading' | 'loaded' | 'error';
  volumeLoading?: boolean;
  difficulty: number;
  url: string;
  updated: string;
  history?: KeywordHistory[];
  serpResults?: SerpResult[];
}

const MOCK_SERP_RESULTS: SerpResult[] = [
  { rank: 1, title: 'Best Marketing Analytics Tools 2024', url: 'https://competitor-a.com/blog/best-tools', domain: 'competitor-a.com' },
  { rank: 2, title: 'Top 10 Dashboard Software', url: 'https://review-site.com/software/dashboards', domain: 'review-site.com' },
  { rank: 3, title: 'Marketing Analytics Dashboard Guide', url: 'https://industry-leader.org/guides/analytics', domain: 'industry-leader.org' },
  { rank: 4, title: 'Your Brand - Analytics Features', url: 'https://mybrand.com/features/analytics', domain: 'mybrand.com' },
  { rank: 5, title: 'Free Analytics Templates', url: 'https://templates-r-us.net/marketing', domain: 'templates-r-us.net' },
];

const GENERATE_HISTORY = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map(m => ({
    date: m,
    rank: Math.floor(Math.random() * 20) + 1
  }));
};

const INITIAL_KEYWORDS: KeywordData[] = [
  { 
    id: '1', keyword: 'marketing analytics dashboard', location: 'US', rank: 4, change: 1, volume: 1200, difficulty: 45, url: '/features/analytics', updated: 'Just now',
    history: GENERATE_HISTORY(),
    serpResults: MOCK_SERP_RESULTS
  },
  { 
    id: '2', keyword: 'competitor analysis tools', location: 'India - Mumbai', rank: 12, change: -2, volume: 2400, difficulty: 68, url: '/solutions/competitor', updated: 'Just now',
    history: GENERATE_HISTORY(),
    serpResults: MOCK_SERP_RESULTS
  },
  { 
    id: '3', keyword: 'seo reporting software', location: 'US - California', rank: 8, change: 3, volume: 850, difficulty: 32, url: '/features/reporting', updated: 'Just now',
    history: GENERATE_HISTORY(),
    serpResults: MOCK_SERP_RESULTS
  },
  { 
    id: '4', keyword: 'social media tracker', location: 'Global', rank: 2, change: 0, volume: 5600, difficulty: 55, url: '/features/social', updated: 'Just now',
    history: GENERATE_HISTORY(),
    serpResults: MOCK_SERP_RESULTS
  },
];

function calculateKDScore(data: {
  competition_index: number;
  cpc: number | null;
  search_volume: number;
  serp_results?: any[];
}): number {
  const competitionScore = data.competition_index ?? 0;
  const cpcScore = data.cpc ? Math.min((data.cpc / 10) * 100, 100) : 0;
  const volumeScore = Math.min((data.search_volume / 100000) * 100, 100);
  const authorityDomains = [
    'wikipedia.org', 'amazon.com', 'youtube.com', 'facebook.com',
    'linkedin.com', 'reddit.com', 'quora.com', 'gov.in', 'nic.in',
    'investopedia.com', 'forbes.com', 'naukri.com', 'justdial.com',
    'indiamart.com', 'flipkart.com', 'cleartax.in', 'bankbazaar.com',
  ];
  const serpResults = data.serp_results ?? [];
  const authorityCount = serpResults.filter((r: any) =>
    authorityDomains.some(d => r.domain?.includes(d) || r.url?.includes(d))
  ).length;
  const serpScore = Math.min((authorityCount / 5) * 100, 100);
  return Math.round(Math.min(
    competitionScore * 0.35 + cpcScore * 0.25 + serpScore * 0.30 + volumeScore * 0.10,
    100,
  ));
}

// "India - Bangalore" → "Bangalore" | "India" → "India" | "US" → "US"
function formatLocationBadge(location: string): string {
  if (location.includes(' - ')) return location.split(' - ')[1];
  return location;
}

const LOCATIONS = [
  'Global',
  'US',
  'UK',
  'CA',
  'AU',
  'DE',
  'FR',
  'India',
  // India - States
  'India - Andhra Pradesh',
  'India - Arunachal Pradesh',
  'India - Assam',
  'India - Bihar',
  'India - Chhattisgarh',
  'India - Goa',
  'India - Gujarat',
  'India - Haryana',
  'India - Himachal Pradesh',
  'India - Jharkhand',
  'India - Karnataka',
  'India - Kerala',
  'India - Madhya Pradesh',
  'India - Maharashtra',
  'India - Manipur',
  'India - Meghalaya',
  'India - Mizoram',
  'India - Nagaland',
  'India - Odisha',
  'India - Punjab',
  'India - Rajasthan',
  'India - Sikkim',
  'India - Tamil Nadu',
  'India - Telangana',
  'India - Tripura',
  'India - Uttar Pradesh',
  'India - Uttarakhand',
  'India - West Bengal',
  // India - Union Territories
  'India - Andaman and Nicobar Islands',
  'India - Chandigarh',
  'India - Dadra and Nagar Haveli and Daman and Diu',
  'India - Delhi',
  'India - Jammu and Kashmir',
  'India - Ladakh',
  'India - Lakshadweep',
  'India - Puducherry',
  // India - Major Cities
  'India - Mumbai',
  'India - Bangalore',
  'India - Hyderabad',
  'India - Ahmedabad',
  'India - Chennai',
  'India - Kolkata',
  'India - Surat',
  'India - Pune',
  'India - Jaipur',
  'India - Lucknow',
  'India - Kanpur',
  'India - Nagpur',
  'India - Indore',
  'India - Thane',
  'India - Bhopal',
  'India - Visakhapatnam',
  'India - Pimpri-Chinchwad',
  'India - Patna',
  'India - Vadodara',
  'India - Ghaziabad',
  'India - Ludhiana',
  'India - Agra',
  'India - Nashik',
  'India - Faridabad',
  'India - Meerut',
  'India - Rajkot',
  'India - Kalyan-Dombivli',
  'India - Vasai-Virar',
  'India - Varanasi',
  'India - Srinagar',
  'India - Aurangabad',
  'India - Dhanbad',
  'India - Amritsar',
  'India - Navi Mumbai',
  'India - Allahabad',
  'India - Howrah',
  'India - Ranchi',
  'India - Gwalior',
  'India - Jabalpur',
  'India - Coimbatore',
  'India - Vijayawada',
  'India - Jodhpur',
  'India - Madurai',
  'India - Raipur',
  'India - Kota',
  'India - Guwahati',
  'India - Solapur',
  'India - Hubballi-Dharwad',
  'India - Bareilly',
  'India - Moradabad',
  'India - Mysore',
  'India - Gurgaon',
  'India - Aligarh',
  'India - Jalandhar',
  'India - Tiruchirappalli',
  'India - Bhubaneswar',
  'India - Salem',
  'India - Mira-Bhayandar',
  'India - Warangal',
  'India - Thiruvananthapuram',
  'India - Bhiwandi',
  'India - Saharanpur',
  'India - Guntur',
  'India - Amravati',
  'India - Bikaner',
  'India - Noida',
  'India - Jamshedpur',
  'India - Bhilai',
  'India - Cuttack',
  'India - Firozabad',
  'India - Kochi',
  'India - Nellore',
  'India - Bhavnagar',
  'India - Dehradun',
  'India - Durgapur',
  'India - Asansol',
  'India - Rourkela',
  'India - Nanded',
  'India - Kolhapur',
  'India - Ajmer',
  'India - Akola',
  'India - Gulbarga',
  'India - Jamnagar',
  'India - Ujjain',
  'India - Loni',
  'India - Siliguri',
  'India - Jhansi',
  'India - Ulhasnagar',
  'India - Jammu',
  'India - Sangli-Miraj & Kupwad',
  'India - Mangalore',
  'India - Erode',
  'India - Belgaum',
  'India - Ambattur',
  'India - Tirunelveli',
  'India - Malegaon',
  'India - Gaya',
  'India - Jalgaon',
  'India - Udaipur',
  'India - Maheshtala'
];

/**
 * Builds chart data points spanning a date range.
 * Uses tracked keyword ranks to derive visibility/avgRank trends.
 * Returns 5–8 evenly-spaced points with date labels matching the period.
 */
function buildChartData(
  startDate: string,
  endDate: string,
  keywords: { rank: number }[],
) {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const points   = Math.min(Math.max(Math.ceil(diffDays / 7), 4), 8);
  const stepMs   = (end.getTime() - start.getTime()) / Math.max(points - 1, 1);

  const baseRank = keywords.length > 0
    ? keywords.reduce((a, k) => a + k.rank, 0) / keywords.length
    : 15;

  return Array.from({ length: points }, (_, i) => {
    const date = new Date(start.getTime() + stepMs * i);
    const label = diffDays <= 14
      ? date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
      : date.toLocaleDateString('en', { month: 'short' });
    const t = points > 1 ? i / (points - 1) : 1; // 0 → 1 (past → now)
    return {
      date,
      avgRank:    Math.max(1, Math.round(baseRank * (1.5 - 0.5 * t))),
      visibility: Math.round(40 + 35 * t),
      traffic:    Math.round(2500 + 6000 * t),
    };
  });
}

/** Parses the real health score written by seoAuditService into the analysis string */
function parseAuditHealth(analysis: string): { score: number; indexedCount: number } {
  const scoreMatch   = analysis.match(/OVERALL HEALTH SCORE: (\d+)\/100/);
  const indexedMatch = analysis.match(/Pages indexed in Google: ~([\d,]+)/);
  return {
    score:        scoreMatch   ? parseInt(scoreMatch[1], 10)                        : 0,
    indexedCount: indexedMatch ? parseInt(indexedMatch[1].replace(/,/g, ''), 10) : 0,
  };
}


interface SeoSuitePanelProps {
  dateRange: DateRange;
}

const SeoSuitePanel: React.FC<SeoSuitePanelProps> = ({ dateRange }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'rankings' | 'audit' | 'ai-visibility'>(() => {
    const saved = localStorage.getItem('mi_seo_tab');
    return (['overview', 'rankings', 'audit', 'ai-visibility'].includes(saved ?? '')
      ? saved
      : 'overview') as 'overview' | 'rankings' | 'audit' | 'ai-visibility';
  });

  // Domain Audit State
  const [domain, setDomain] = useState(() => localStorage.getItem('mi_seo_domain') ?? 'mybrand.com');
  const [loading, setLoading] = useState(false);
  const isRunning = useRef(false); // prevents double-run from onBlur + onClick firing together
  const [audit, setAudit] = useState<{ analysis: string; sources: any[] } | null>(null);

  // Restore audit from sessionStorage once on mount (does not fire on re-renders)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('mi_seo_audit');
      if (!saved) return;
      const { domain: savedDomain, result } = JSON.parse(saved);
      const currentDomain = localStorage.getItem('mi_seo_domain') ?? 'mybrand.com';
      if (savedDomain === currentDomain) setAudit(result);
    } catch { /* ignore */ }
  }, []); // ← empty deps: runs exactly once on mount

  // Keyword Tracker State — persisted in localStorage
  const [keywords, setKeywords] = useState<KeywordData[]>(() => {
    try {
      const saved = localStorage.getItem('mi_seo_keywords');
      if (!saved) return [];
      // Always reset transient loading flags so stale spinner states don't persist across reloads
      return (JSON.parse(saved) as KeywordData[]).map(k => ({ ...k, volumeLoading: false, rankStatus: k.rankStatus === 'loading' ? 'error' : k.rankStatus }));
    } catch {
      return [];
    }
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [newLocation, setNewLocation] = useState('India - Bangalore');
  // Domain to track in Rankings (separate from Site Audit domain).
  // When empty: shows the #1 organic result. When set: shows that domain's position.
  const [trackedDomain, setTrackedDomain] = useState(() => localStorage.getItem('mi_tracked_domain') ?? '');
  const [isAddingKw, setIsAddingKw] = useState(false);
  const [addingStatus, setAddingStatus] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState('');
  const [fetchingAllData, setFetchingAllData] = useState(false);
  const [fetchAllProgress, setFetchAllProgress] = useState<{ fetched: number; total: number } | null>(null);
  const [lastFetchedAll, setLastFetchedAll] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordData | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [keywordDetails, setKeywordDetails] = useState<Record<string, any>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  // Ranked Keywords section state (domain-level, shown in Site Metrics tab)

  // Keyword Overview tab state — shows tracked keywords list + per-kw detail
  const [overviewSelectedId, setOverviewSelectedId] = useState<string | null>(null);
  const [overviewLoadingId, setOverviewLoadingId] = useState<string | null>(null);
  const [overviewSearch, setOverviewSearch] = useState('');

  // AI Visibility tab state
  const [brandName, setBrandName] = useState('');
  const [llmData, setLlmData] = useState<any[]>([]);
  const [llmLoading, setLlmLoading] = useState(false);

  // Auto-select first keyword when switching to overview tab (if none selected)
  useEffect(() => {
    if (activeTab === 'overview' && keywords.length > 0 && overviewSelectedId === null) {
      handleSelectOverviewKw(keywords[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, keywords.length]);

  // Persist tab, domain and keywords to localStorage
  useEffect(() => { localStorage.setItem('mi_seo_tab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('mi_seo_domain', domain); }, [domain]);
  useEffect(() => { localStorage.setItem('mi_tracked_domain', trackedDomain); }, [trackedDomain]);
  useEffect(() => {
    try { localStorage.setItem('mi_seo_keywords', JSON.stringify(keywords)); } catch { /* quota */ }
  }, [keywords]);

  // Chart data derived from selected date range + tracked keywords
  const chartData = useMemo(
    () => buildChartData(dateRange.startDate, dateRange.endDate, keywords),
    [dateRange.startDate, dateRange.endDate, keywords],
  );

  // Parsed audit metrics (only populated after Run Audit)
  const auditMetrics = useMemo(
    () => audit ? parseAuditHealth(audit.analysis) : null,
    [audit],
  );

  const handleAudit = async (domainOverride?: string) => {
    const targetDomain = (domainOverride ?? domain).trim();
    if (!targetDomain || isRunning.current) return; // guard: no empty domain, no double-run
    isRunning.current = true;
    setLoading(true);
    setAudit(null); // clear stale result so loading state is visible immediately
    try {
      const result = await runSeoAuditViaSerpAPI(targetDomain);
      setAudit(result);
      // Persist in sessionStorage — survives page refresh, clears when tab closes
      sessionStorage.setItem('mi_seo_audit', JSON.stringify({ domain: targetDomain, result }));
      // Keep localStorage domain in sync with what was actually audited
      localStorage.setItem('mi_seo_domain', targetDomain);
      setDomain(targetDomain);
    } catch {
      alert('Audit failed — check your domain and try again.');
    } finally {
      setLoading(false);
      isRunning.current = false;
    }
  };


  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    setIsAddingKw(true);
    setAddingStatus('Fetching rank... ~1 min');
    const keyword = newKeyword.trim();
    setNewKeyword('');
    console.log('[Debug] location value:', newLocation);

    try {
      // Step 1 — SERP ranking via Priority Queue (~1 min)
      const serpData = await getSerpRankings(
        keyword, trackedDomain, newLocation, false,
        (msg) => setAddingStatus(msg),
      );

      const needle = trackedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
      const matchedResult = serpData.results.find(r =>
        r.domain?.toLowerCase().includes(needle) || r.url?.toLowerCase().includes(needle)
      );
      const rank = matchedResult?.rank ?? serpData.yourPosition ?? 0;
      const rankStatus: KeywordData['rankStatus'] = rank > 0 ? 'found' : 'not_found';

      const kwId = Date.now().toString();
      const kw: KeywordData = {
        id:           kwId,
        keyword,
        location:     newLocation,
        rank,
        rankStatus,
        change:       0,
        volume:       0,
        volumeLoading: false,
        difficulty:   0,
        url:          matchedResult?.url ?? serpData.results[0]?.url ?? '',
        updated:      'Just now',
        history:      GENERATE_HISTORY(),
        serpResults:  serpData.results.slice(0, 10).map(r => ({
          rank: r.rank, title: r.title, url: r.url, domain: r.domain,
        })),
      };

      // Show rank immediately — volume left at 0, user fetches manually
      setKeywords(prev => [kw, ...prev]);
      setIsAddingKw(false);
      setAddingStatus('');

      // Save rank to Firestore (non-blocking)
      setDoc(
        doc(db, 'rankHistory', `${trackedDomain}_${keyword.replace(/\s+/g, '_')}_${kwId}`),
        { keyword, domain: trackedDomain, location: newLocation, rank, checkedAt: new Date().toISOString() },
      ).catch(() => {});

    } catch (err) {
      console.error('Failed to fetch keyword ranking:', err);
      setAddingStatus('');
      const fallback: KeywordData = {
        id: Date.now().toString(), keyword, location: newLocation,
        rank: 0, rankStatus: 'error', change: 0,
        volume: 0, volumeStatus: 'error', difficulty: 0,
        url: '', updated: 'Error — retry',
        history: GENERATE_HISTORY(), serpResults: [],
      };
      setKeywords(prev => [fallback, ...prev]);
      setIsAddingKw(false);
      setAddingStatus('');
    }
  };

  const removeKeyword = (id: string) => {
    setKeywords(keywords.filter(k => k.id !== id));
    if (selectedKeyword?.id === id) setSelectedKeyword(null);
  };

  const refreshRankings = async () => {
    if (isRefreshing || keywords.length === 0) return;
    setIsRefreshing(true);
    setRefreshStatus('');

    for (const kw of keywords) {
      try {
        // Mark rank as loading for this keyword (volume untouched)
        setKeywords(prev => prev.map(k =>
          k.id === kw.id ? { ...k, rankStatus: 'loading' } : k
        ));

        setRefreshStatus(`Checking "${kw.keyword}"…`);

        // Rank via Priority Queue (force fresh, ~1 min) — no Ads fetch
        const serpData = await getSerpRankings(
          kw.keyword, trackedDomain, kw.location, true,
          (msg) => setRefreshStatus(msg),
        );

        const kwNeedle = trackedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
        const kwMatch = serpData.results.find(r =>
          r.domain?.toLowerCase().includes(kwNeedle) || r.url?.toLowerCase().includes(kwNeedle)
        );
        const newRank = kwMatch?.rank ?? serpData.yourPosition ?? 0;

        setKeywords(prev => prev.map(k =>
          k.id === kw.id ? {
            ...k,
            change:      k.rank > 0 && newRank > 0 ? k.rank - newRank : 0,
            rank:        newRank,
            rankStatus:  newRank > 0 ? 'found' : 'not_found',
            serpResults: serpData.results.slice(0, 10).map(r => ({
              rank: r.rank, title: r.title, url: r.url, domain: r.domain,
            })),
            updated: 'Just now',
          } : k
        ));

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`Refresh failed for ${kw.keyword}:`, err);
        setKeywords(prev => prev.map(k =>
          k.id === kw.id ? { ...k, rankStatus: 'error' } : k
        ));
      }
    }

    setIsRefreshing(false);
    setRefreshStatus('');
  };

  const handleFetchAllData = async () => {
    const isRefresh = keywords.some(kw => kw.volume > 0);
    // On first fetch: only keywords missing volume. On refresh: all keywords.
    const keywordsToFetch = isRefresh
      ? keywords.map(kw => kw.keyword)
      : keywords.filter(kw => kw.volume === 0).map(kw => kw.keyword);
    if (keywordsToFetch.length === 0) {
      alert('No keywords to fetch!');
      return;
    }
    setFetchingAllData(true);
    setFetchAllProgress({ fetched: 0, total: keywordsToFetch.length });
    try {
      // ONE batch call for all keywords = $0.05 flat; forceRefresh bypasses cache
      const adsData = await getGoogleAdsData(keywordsToFetch, newLocation, undefined, isRefresh);
      setFetchAllProgress({ fetched: keywordsToFetch.length, total: keywordsToFetch.length });
      setKeywords(prev => prev.map(kw => {
        const data = adsData.find(d => d.keyword.toLowerCase() === kw.keyword.toLowerCase());
        if (!data) return kw;
        return {
          ...kw,
          volume:       data.searchVolume,
          difficulty:   data.competitionIndex,
          volumeLoading: false,
        };
      }));
      setKeywordDetails(prev => {
        const updates = { ...prev };
        keywords.forEach(kw => {
          const data = adsData.find(d => d.keyword.toLowerCase() === kw.keyword.toLowerCase());
          if (data) updates[kw.id] = data;
        });
        return updates;
      });
      setLastFetchedAll(new Date().toLocaleDateString());
    } catch (err) {
      console.error('[Fetch All Data]', err);
    } finally {
      setFetchingAllData(false);
      setFetchAllProgress(null);
    }
  };

  const handleFetchSingleKeyword = async (kw: KeywordData) => {
    setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, volumeLoading: true } : k));
    try {
      const adsData = await getGoogleAdsData([kw.keyword], kw.location);
      const data = adsData[0];
      setKeywords(prev => prev.map(k =>
        k.id === kw.id ? {
          ...k,
          volume:       data?.searchVolume ?? 0,
          difficulty:   data?.competitionIndex ?? 0,
          volumeStatus: 'loaded' as const,
          volumeLoading: false,
        } : k
      ));
      if (data) {
        setKeywordDetails(prev => ({ ...prev, [kw.id]: data }));
      }
    } catch {
      setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, volumeLoading: false } : k));
    }
  };

  const handleAnalyzeKeyword = (kw: KeywordData) => {
    // Toggle expanded panel open/close — no API calls
    setAnalyzingId(analyzingId === kw.id ? null : kw.id);
  };

  const handleSelectOverviewKw = async (kw: KeywordData) => {
    setOverviewSelectedId(kw.id);
    const hasAds  = !!keywordDetails[kw.id];
    const hasSerp = (kw.serpResults?.length ?? 0) > 0;
    if (hasAds && hasSerp) return;          // all data already cached — nothing to fetch

    setOverviewLoadingId(kw.id);
    try {
      const [serpResult, adsResult] = await Promise.all([
        hasSerp ? Promise.resolve(null) : getSerpRankings(kw.keyword, trackedDomain, kw.location),
        hasAds  ? Promise.resolve(null) : getGoogleAdsData([kw.keyword], kw.location),
      ]);
      if (serpResult) {
        setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, serpResults: serpResult.results } : k));
      }
      if (adsResult?.[0]) {
        setKeywordDetails(prev => ({ ...prev, [kw.id]: adsResult[0] }));
      }
    } catch (err) {
      console.error('[Overview] kw detail fetch failed:', err);
    } finally {
      setOverviewLoadingId(null);
    }
  };

  const handleLLMCheck = async () => {
    if (!brandName.trim()) return;
    setLlmLoading(true);
    try {
      const data = await getLLMVisibility(brandName, []);
      setLlmData(data);
    } catch (err) {
      console.error('LLM check failed:', err);
    } finally {
      setLlmLoading(false);
    }
  };

  // Keyword Metrics
  const avgRank = (keywords.reduce((acc, k) => acc + k.rank, 0) / keywords.length).toFixed(1);
  const top3 = keywords.filter(k => k.rank <= 3).length;
  const top10 = keywords.filter(k => k.rank <= 10).length;
  const visibility = keywords.length > 0 ? ((100 - (keywords.reduce((acc, k) => acc + (k.rank > 30 ? 30 : k.rank), 0) / keywords.length)) / 100 * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Keyword Overview
        </button>
        <button 
          onClick={() => setActiveTab('rankings')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'rankings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Rankings
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Site Audit
        </button>
        <button
          onClick={() => setActiveTab('ai-visibility')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ai-visibility' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          AI Visibility
        </button>
      </div>

      {activeTab === 'overview' && (() => {
        const filteredKws = keywords.filter(k =>
          k.keyword.toLowerCase().includes(overviewSearch.toLowerCase())
        );
        const selKw  = keywords.find(k => k.id === overviewSelectedId) ?? null;
        const ads    = selKw ? keywordDetails[selKw.id] : null;
        const isLoading = overviewLoadingId === selKw?.id;

        // Build monthly data for chart
        const monthlyData = (ads?.monthlySearches ?? []).map((m: any) => ({
          month:        `${m.year}-${String(m.month).padStart(2, '0')}`,
          searchVolume: m.search_volume ?? m.searchVolume ?? 0,
        }));

        // KD score
        const kdScore = ads ? calculateKDScore({
          competition_index: ads.competitionIndex ?? 0,
          cpc:               ads.cpc,
          search_volume:     selKw?.volume ?? 0,
          serp_results:      selKw?.serpResults,
        }) : selKw?.difficulty ?? 0;

        const needle = trackedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

        return (
          <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
            {/* ── Left: keyword list ──────────────────────────────── */}
            <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Tracked Keywords <span className="text-indigo-600 ml-1">{filteredKws.length}</span>
                </p>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={overviewSearch}
                    onChange={e => setOverviewSearch(e.target.value)}
                    placeholder="Search keywords…"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {filteredKws.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center">No keywords tracked yet.<br />Add keywords in the Rankings tab.</p>
                ) : filteredKws.map(kw => (
                  <button
                    key={kw.id}
                    onClick={() => handleSelectOverviewKw(kw)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-indigo-50 ${overviewSelectedId === kw.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate leading-tight">{kw.keyword}</span>
                      <span className={`text-xs font-black flex-shrink-0 ${kw.rank <= 3 ? 'text-green-600' : kw.rank <= 10 ? 'text-amber-500' : 'text-slate-500'}`}>
                        #{kw.rank}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{kw.location}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Right: detail panel ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {!selKw ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl mb-3">🔍</p>
                    <p className="text-sm font-semibold text-slate-600">Select a keyword to view details</p>
                    <p className="text-xs text-slate-400 mt-1">Click any keyword from the list on the left</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                  {/* Keyword heading */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{selKw.keyword}</h3>
                      <p className="text-xs text-slate-400">{selKw.location} · Rank #{selKw.rank}</p>
                    </div>
                    {isLoading && (
                      <span className="flex items-center gap-2 text-xs text-indigo-600">
                        <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        Fetching data…
                      </span>
                    )}
                  </div>

                  {/* ── Row 1: 5 main metric cards ── */}
                  <div className="grid grid-cols-5 gap-3">
                    {/* Search Volume */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Search Volume</p>
                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">IN {selKw.location.split(' - ')[0]}</span>
                      </div>
                      <p className="text-xl font-black text-indigo-600">{selKw.volume > 0 ? selKw.volume.toLocaleString() : '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">National monthly searches</p>
                    </div>

                    {/* CPC */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">CPC</p>
                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">IN {selKw.location.split(' - ')[0]}</span>
                      </div>
                      <p className="text-xl font-black text-green-600">{ads?.cpc != null ? `$${ads.cpc.toFixed(2)}` : '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">National avg cost per click</p>
                    </div>

                    {/* Competition */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Competition</p>
                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">IN {selKw.location.split(' - ')[0]}</span>
                      </div>
                      {ads?.competition ? (
                        <span className={`inline-block text-xs font-black px-2 py-0.5 rounded-full mt-0.5 ${
                          ads.competition === 'LOW'    ? 'bg-green-100 text-green-700' :
                          ads.competition === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          ads.competition === 'HIGH'   ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                        }`}>{ads.competition}</span>
                      ) : <p className="text-xl font-black text-gray-400">—</p>}
                      <p className="text-xs text-gray-400 mt-1">National ad competition</p>
                    </div>

                    {/* KD Score */}
                    {(() => {
                      const kdColor = kdScore >= 80 ? '#991B1B' : kdScore >= 60 ? '#DC2626' : kdScore >= 30 ? '#D97706' : '#16A34A';
                      const kdLabel = kdScore >= 80 ? 'Very Hard' : kdScore >= 60 ? 'Hard' : kdScore >= 30 ? 'Medium' : 'Easy';
                      return (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">KD Score</p>
                            <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">IN {selKw.location.split(' - ')[0]}</span>
                          </div>
                          <div className="flex items-end gap-1">
                            <p className="text-xl font-black" style={{ color: kdColor }}>{kdScore}</p>
                            <p className="text-xs text-gray-400 mb-0.5">/100</p>
                          </div>
                          <div className="mt-1.5 bg-gray-200 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${kdScore}%`, backgroundColor: kdColor }} />
                          </div>
                          <p className="text-[10px] mt-1" style={{ color: kdColor }}>{kdLabel}</p>
                        </div>
                      );
                    })()}

                    {/* AD Competition Index */}
                    {(() => {
                      const ci = ads?.competitionIndex ?? 0;
                      const ciColor = ci >= 67 ? '#DC2626' : ci >= 34 ? '#D97706' : '#16A34A';
                      return (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">AD Comp. Index</p>
                            <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">IN {selKw.location.split(' - ')[0]}</span>
                          </div>
                          <div className="flex items-end gap-1">
                            <p className="text-xl font-black" style={{ color: ciColor }}>{ci}</p>
                            <p className="text-xs text-gray-400 mb-0.5">/100</p>
                          </div>
                          <div className="mt-1.5 bg-gray-200 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${ci}%`, backgroundColor: ciColor }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">Google Ads competition score</p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── Row 2: Low Bid + High Bid ── */}
                  <div className="grid grid-cols-5 gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Low Bid</p>
                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">IN {selKw.location.split(' - ')[0]}</span>
                      </div>
                      <p className="text-xl font-black text-blue-600">{ads?.lowTopOfPageBid != null ? `$${ads.lowTopOfPageBid.toFixed(2)}` : '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Low top-of-page bid</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">High Bid</p>
                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">IN {selKw.location.split(' - ')[0]}</span>
                      </div>
                      <p className="text-xl font-black text-purple-600">{ads?.highTopOfPageBid != null ? `$${ads.highTopOfPageBid.toFixed(2)}` : '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">High top-of-page bid</p>
                    </div>
                  </div>

                  {/* Monthly volume trend */}
                  {monthlyData.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <h3 className="font-bold text-slate-800 text-sm mb-4">📈 Monthly Search Volume Trend</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={monthlyData}>
                          <defs>
                            <linearGradient id="ovVolGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}   />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                            tickFormatter={v => { const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return mn[parseInt(v.split('-')[1]) - 1] ?? v; }}
                          />
                          <YAxis tickFormatter={v => v > 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={35} />
                          <Tooltip formatter={(v: any) => [v.toLocaleString(), 'Searches']} contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid #E2E8F0' }} />
                          <Area type="monotone" dataKey="searchVolume" stroke="#4F46E5" strokeWidth={2} fill="url(#ovVolGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* 12-Month Ranking History */}
                  {(selKw.history?.length ?? 0) > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                      <h3 className="font-bold text-slate-800 text-sm mb-4">📊 12-Month Ranking History</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={selKw.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                          <YAxis reversed domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={25} label={{ value: 'Rank', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: '#94A3B8' } }} />
                          <Tooltip formatter={(v: any) => [`#${v}`, 'Rank']} contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid #E2E8F0' }} />
                          <Line type="monotone" dataKey="rank" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3, fill: '#4F46E5' }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* SERP results */}
                  {(selKw.serpResults?.length ?? 0) > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 text-sm">Current SERP Results</h3>
                        {selKw.rank > 0 && selKw.rank <= 100 && (
                          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full font-bold">
                            Your position: #{selKw.rank}
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-slate-50">
                        {selKw.serpResults!.slice(0, 10).map((r: any) => {
                          const isYou = !!needle && r.domain?.toLowerCase().includes(needle);
                          return (
                            <div key={r.rank} className={`px-5 py-3 flex items-center gap-4 ${isYou ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50'}`}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${r.rank <= 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {r.rank}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{r.title}</p>
                                  {isYou && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">YOU</span>}
                                </div>
                                <p className="text-xs text-green-700 truncate mt-0.5">{r.url}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empty state while loading */}
                  {isLoading && monthlyData.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex items-center justify-center">
                      <span className="text-xs text-slate-400">Loading keyword data…</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === 'rankings' && (
        <div className="space-y-6">
          {/* Add Keyword Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800 mb-1">Add New Keywords</h3>
                <p className="text-sm text-slate-500">Track your rankings across Google Search mobile & desktop.</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <LocationSearch
                  locations={LOCATIONS}
                  value={newLocation}
                  onChange={setNewLocation}
                />
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="Enter keyword..."
                  className="flex-1 md:w-64 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
                <button
                  onClick={handleAddKeyword}
                  disabled={isAddingKw || !newKeyword.trim()}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                >
                  {isAddingKw ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Adding…</>
                  ) : '+ Add'}
                </button>
              </div>
              {isAddingKw && addingStatus && (
                <p className="text-xs text-indigo-500 font-medium mt-1.5 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                  {addingStatus}
                </p>
              )}
            </div>
            {/* Domain tracker row */}
            <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">Track domain</span>
              <input
                type="text"
                value={trackedDomain}
                onChange={(e) => setTrackedDomain(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && keywords.length > 0) refreshRankings(); }}
                placeholder="e.g. arivupro.com  (leave blank to see top organic result)"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
              />
              <button
                onClick={refreshRankings}
                disabled={isRefreshing || keywords.length === 0}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap"
              >
                {isRefreshing
                  ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Checking…</>
                  : '↻ Apply & Refresh'}
              </button>
            </div>
            {isRefreshing && refreshStatus && (
              <p className="text-xs text-indigo-500 font-medium mt-1.5 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                {refreshStatus}
              </p>
            )}
          </div>

          {/* Keywords Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Ranking Overview</h3>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFetchAllData}
                    disabled={fetchingAllData || keywords.length === 0}
                    className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-70 transition-colors"
                  >
                    {fetchingAllData
                      ? <>
                          <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Fetching {fetchAllProgress?.fetched ?? 0}/{fetchAllProgress?.total ?? 0}...
                        </>
                      : keywords.some(kw => kw.volume > 0)
                        ? '🔄 Refresh All Data'
                        : '📊 Fetch All Data'}
                  </button>
                  <button
                    onClick={refreshRankings}
                    disabled={isRefreshing}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isRefreshing ? '⏳ Refreshing…' : '🔄 Refresh Data'}
                  </button>
                </div>
                {lastFetchedAll && (
                  <p className="text-[10px] text-gray-400 text-right">✅ Volume fetched: {lastFetchedAll}</p>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Keyword</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Location</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Rank</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Change</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Volume</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">KD %</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {keywords.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                        No keywords tracked yet. Enter a keyword above and click <strong>+ Add</strong> to fetch live Google rankings via SerpAPI.
                      </td>
                    </tr>
                  )}
                  {keywords.map((kw) => (
                    <React.Fragment key={kw.id}>
                      <tr className={`hover:bg-slate-50 transition-colors group ${selectedKeyword?.id === kw.id ? 'bg-indigo-50/50' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">{kw.keyword}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[200px]">{kw.url}</p>
                          {kw.rankStatus === 'loading' && (
                            <p className="text-[10px] text-indigo-400 font-medium mt-0.5 flex items-center gap-1">
                              <span className="w-2 h-2 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                              Fetching rank... ~1 min
                            </p>
                          )}
                          {kw.rankStatus !== 'loading' && kw.volumeStatus === 'loading' && (
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                              <span className="w-2 h-2 border border-slate-300 border-t-transparent rounded-full animate-spin inline-block" />
                              Volume loading ~5 min
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium border border-gray-200" title={kw.location}>
                            {formatLocationBadge(kw.location)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {kw.rankStatus === 'loading' ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                              <span className="text-[9px] text-indigo-400 font-medium">~1 min</span>
                            </div>
                          ) : kw.rank === null || kw.rank === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded" title="Domain not found in top 30 results">
                              &gt;30
                            </span>
                          ) : (
                            <span className={`text-lg font-black ${
                              kw.rank <= 10 ? 'text-emerald-600' :
                              kw.rank <= 20 ? 'text-indigo-600' :
                                             'text-amber-600'
                            }`}>
                              #{kw.rank}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {kw.change !== 0 ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${kw.change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {kw.change > 0 ? '▲' : '▼'} {Math.abs(kw.change)}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-400">-</span>
                          )}
                        </td>
                        {/* Volume column — 3 states */}
                        <td className="px-6 py-4">
                          {kw.volumeLoading ? (
                            <div className="w-4 h-4 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                          ) : kw.volume > 0 ? (
                            <span className="text-sm text-gray-700">{kw.volume.toLocaleString()}</span>
                          ) : (
                            <span className="text-xs text-gray-300 italic">—</span>
                          )}
                        </td>
                        {/* KD column — 3 states */}
                        <td className="px-6 py-4">
                          {kw.volumeLoading ? (
                            <div className="w-4 h-4 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                          ) : kw.volume > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${(kw.difficulty || 0) < 30 ? 'bg-green-500' : (kw.difficulty || 0) < 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${isNaN(kw.difficulty) ? 0 : (kw.difficulty || 0)}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-500">
                                {isNaN(kw.difficulty) || kw.difficulty == null ? 0 : kw.difficulty}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-300 italic">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* Fetch Data / Fetching... / Refresh — 3 states */}
                            {kw.volumeLoading ? (
                              <button disabled className="text-xs border border-gray-200 text-gray-400 px-3 py-1.5 rounded-lg font-semibold cursor-not-allowed">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                                  Fetching...
                                </div>
                              </button>
                            ) : kw.volume > 0 && analyzingId === kw.id ? (
                              <button
                                onClick={() => handleFetchSingleKeyword(kw)}
                                className="text-xs border border-gray-200 text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                              >
                                🔄 Refresh
                              </button>
                            ) : kw.volume === 0 ? (
                              <button
                                onClick={() => handleFetchSingleKeyword(kw)}
                                className="text-xs border border-blue-200 text-blue-500 hover:border-blue-400 bg-blue-50 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                              >
                                📊 Fetch Data
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleAnalyzeKeyword(kw)}
                              className={`text-xs border px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                                analyzingId === kw.id
                                  ? 'border-indigo-500 bg-indigo-600 text-white'
                                  : 'border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-slate-600'
                              }`}
                            >
                              {analyzingId === kw.id ? 'Close' : 'Analyze'}
                            </button>
                            <button
                              onClick={() => removeKeyword(kw.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                      {analyzingId === kw.id && (
                        <tr>
                          <td colSpan={7} className="px-6 py-5 bg-slate-50/80 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-4">

                              {/* ── SECTION 1: Keyword Metrics Row ─────────────────── */}
                              <div className="grid grid-cols-5 gap-3">
                                {kw.volume === 0 ? (
                                  /* Volume not fetched yet — prompt user */
                                  <div className="col-span-5 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                      <span className="text-xl">📊</span>
                                      <div>
                                        <p className="text-sm font-bold text-blue-800">Volume data not fetched yet</p>
                                        <p className="text-xs text-blue-500 mt-0.5">Click Fetch Data to load Search Volume, CPC and KD Score</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleFetchSingleKeyword(kw)}
                                      disabled={kw.volumeLoading}
                                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex-shrink-0"
                                    >
                                      {kw.volumeLoading ? 'Fetching...' : '📊 Fetch Data'}
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    {/* Search Volume */}
                                    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Search Volume</p>
                                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">🇮🇳 India</span>
                                      </div>
                                      <p className="text-xl font-black text-indigo-600">
                                        {kw.volume > 1000 ? `${(kw.volume / 1000).toFixed(1)}K` : kw.volume.toLocaleString()}
                                      </p>
                                      <p className="text-xs text-gray-400 mt-0.5">National monthly searches</p>
                                    </div>

                                    {/* CPC — stored in keywordDetails if available, else N/A */}
                                    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">CPC</p>
                                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">🇮🇳 India</span>
                                      </div>
                                      <p className="text-xl font-black text-green-600">
                                        {(() => { const c = keywordDetails[kw.id]?.cpc; return c != null && c > 0 ? `$${c.toFixed(2)}` : 'N/A'; })()}
                                      </p>
                                      <p className="text-xs text-gray-400 mt-0.5">National avg cost per click</p>
                                    </div>

                                    {/* Competition */}
                                    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Competition</p>
                                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">🇮🇳 India</span>
                                      </div>
                                      {(() => {
                                        const comp = keywordDetails[kw.id]?.competition;
                                        return (
                                          <>
                                            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mt-1 ${
                                              comp === 'HIGH'   ? 'bg-red-100 text-red-700' :
                                              comp === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                              comp === 'LOW'    ? 'bg-green-100 text-green-700' :
                                                                  'bg-gray-100 text-gray-500'
                                            }`}>
                                              {comp ?? '—'}
                                            </span>
                                            <p className="text-xs text-gray-400 mt-1">National ad competition</p>
                                          </>
                                        );
                                      })()}
                                    </div>

                                    {/* KD Score — custom formula */}
                                    {(() => {
                                      const d = keywordDetails[kw.id];
                                      const kd = d ? calculateKDScore({
                                        competition_index: d.competitionIndex ?? 0,
                                        cpc:               d.cpc,
                                        search_volume:     kw.volume,
                                        serp_results:      kw.serpResults,
                                      }) : 0;
                                      const kdColor =
                                        kd >= 80 ? '#991B1B' :
                                        kd >= 60 ? '#DC2626' :
                                        kd >= 30 ? '#D97706' : '#16A34A';
                                      const kdLabel =
                                        kd >= 80 ? 'Very Hard' :
                                        kd >= 60 ? 'Hard' :
                                        kd >= 30 ? 'Medium' : 'Easy';
                                      return (
                                        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                          <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">KD Score</p>
                                            <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">🇮🇳 India</span>
                                          </div>
                                          <div className="flex items-end gap-1">
                                            <p className="text-xl font-black" style={{ color: kdColor }}>{kd}</p>
                                            <p className="text-xs text-gray-400 mb-0.5">/100</p>
                                          </div>
                                          <div className="mt-1.5 bg-gray-200 rounded-full h-1.5">
                                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${kd}%`, backgroundColor: kdColor }} />
                                          </div>
                                          <p className="text-[10px] mt-1" style={{ color: kdColor }}>{kdLabel}</p>
                                        </div>
                                      );
                                    })()}

                                    {/* AD Competition Index */}
                                    {(() => {
                                      const ci = keywordDetails[kw.id]?.competitionIndex ?? 0;
                                      const ciColor = ci >= 67 ? '#DC2626' : ci >= 34 ? '#D97706' : '#16A34A';
                                      return (
                                        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                          <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Ad Comp. Index</p>
                                            <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">🇮🇳 India</span>
                                          </div>
                                          <div className="flex items-end gap-1">
                                            <p className="text-xl font-black" style={{ color: ciColor }}>{ci}</p>
                                            <p className="text-xs text-gray-400 mb-0.5">/100</p>
                                          </div>
                                          <div className="mt-1.5 bg-gray-200 rounded-full h-1.5">
                                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${ci}%`, backgroundColor: ciColor }} />
                                          </div>
                                          <p className="text-xs text-gray-400 mt-0.5">Google Ads competition score</p>
                                        </div>
                                      );
                                    })()}

                                    {/* Low Top-of-Page Bid */}
                                    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Low Bid</p>
                                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">🇮🇳 India</span>
                                      </div>
                                      <p className="text-xl font-black text-blue-600">
                                        {(() => { const b = keywordDetails[kw.id]?.lowTopOfPageBid; return b != null ? `$${b.toFixed(2)}` : 'N/A'; })()}
                                      </p>
                                      <p className="text-xs text-gray-400 mt-0.5">Low top-of-page bid</p>
                                    </div>

                                    {/* High Top-of-Page Bid */}
                                    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">High Bid</p>
                                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">🇮🇳 India</span>
                                      </div>
                                      <p className="text-xl font-black text-purple-600">
                                        {(() => { const b = keywordDetails[kw.id]?.highTopOfPageBid; return b != null ? `$${b.toFixed(2)}` : 'N/A'; })()}
                                      </p>
                                      <p className="text-xs text-gray-400 mt-0.5">High top-of-page bid</p>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* ── SECTION 3 (moved above): Monthly Trend + Categories ── */}
                              {keywordDetails[kw.id] && (() => {
                                const d = keywordDetails[kw.id];
                                if (!d.hasData && d.competition === 'NO DATA') return null;
                                return d.monthlySearches?.length > 0 ? (
                                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                    <p className="text-xs font-bold text-gray-700 mb-3">📈 Monthly Search Volume Trend</p>
                                    {d.locationFallback && (
                                      <p className="text-[10px] text-blue-600 mb-2">ℹ️ Showing {d.locationFallback}-level data</p>
                                    )}
                                    <ResponsiveContainer width="100%" height={160}>
                                      <AreaChart data={d.monthlySearches.map((m: any) => ({
                                        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
                                        volume: m.searchVolume,
                                      }))}>
                                        <defs>
                                          <linearGradient id="kwGradTop" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}   />
                                          </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                                          tickFormatter={v => {
                                            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                            return months[parseInt(v.split('-')[1]) - 1];
                                          }}
                                        />
                                        <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={35} />
                                        <Tooltip formatter={(v: any) => [v.toLocaleString(), 'Searches']} contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid #E2E8F0' }} />
                                        <Area type="monotone" dataKey="volume" stroke="#4F46E5" strokeWidth={2} fill="url(#kwGradTop)" dot={false} />
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : null;
                              })()}

                              {/* ── SECTION 2: 12-Month Ranking History + SERP Leaders ── */}
                              <div className="grid grid-cols-2 gap-4">

                                {/* Left: 12-Month Ranking History */}
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                  <p className="text-xs font-bold text-gray-700 mb-3">📊 12-Month Ranking History</p>
                                  {(kw.history?.length ?? 0) > 0 ? (
                                    <ResponsiveContainer width="100%" height={160}>
                                      <LineChart data={kw.history}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                        <YAxis reversed tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28}
                                          label={{ value: 'Rank', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: '#CBD5E1' } }}
                                        />
                                        <Tooltip
                                          formatter={(v: any) => [`#${v}`, 'Rank']}
                                          contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid #E2E8F0' }}
                                        />
                                        <Line type="monotone" dataKey="rank" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3, fill: '#4F46E5' }} activeDot={{ r: 5 }} />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  ) : (
                                    <div className="flex items-center justify-center h-40 text-xs text-gray-400">No history yet</div>
                                  )}
                                </div>

                                {/* Right: Current SERP Leaders */}
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-bold text-gray-900">🔍 Current SERP Leaders</h3>
                                    <div className="flex gap-1.5">
                                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">📍 {formatLocationBadge(kw.location)}</span>
                                      {trackedDomain && (
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Tracking: {trackedDomain}</span>
                                      )}
                                    </div>
                                  </div>
                                  {(() => {
                                    // Prefer fresh SERP data from Analyze; fall back to kw.serpResults
                                    const serpList = keywordDetails[kw.id]?.serpResults ?? kw.serpResults ?? [];
                                    return serpList.length > 0 ? (
                                    <div className="space-y-2">
                                      {serpList.slice(0, 8).map((r: any, i: number) => {
                                        const needle = trackedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
                                        const isYou = !!needle && r.domain?.toLowerCase().includes(needle);
                                        return (
                                          <div key={i} className={`flex items-start gap-2 p-1.5 rounded-lg ${isYou ? 'bg-indigo-50 border border-indigo-200' : ''}`}>
                                            <span className={`flex-shrink-0 w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center ${
                                              r.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                              {r.rank}
                                            </span>
                                            <div className="min-w-0">
                                              <p className={`text-xs font-medium truncate ${isYou ? 'text-indigo-700' : 'text-gray-700'}`}>
                                                {isYou && <span className="text-indigo-500 font-bold mr-1">★</span>}
                                                {r.title}
                                              </p>
                                              <p className="text-[10px] text-gray-400 truncate">{r.domain}</p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center h-40 text-xs text-gray-400">No SERP data available</div>
                                  );
                                  })()}
                                </div>

                              </div>

                              {/* ── SECTION 3: Monthly Trend + Categories ───────────── */}
                              {keywordDetails[kw.id] && (() => {
                                const d = keywordDetails[kw.id];

                                // No-ads warning
                                if (!d.hasData && d.competition === 'NO DATA') {
                                  return (
                                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                      <span className="text-xl">⚠️</span>
                                      <div>
                                        <p className="text-sm font-bold text-amber-800">No Ads Data Available</p>
                                        <p className="text-xs text-amber-600 mt-0.5">
                                          Google Ads has no data for this keyword
                                          {d.locationFallback ? ` even at the ${d.locationFallback} level` : ' at the selected location'}.
                                          This usually means no advertisers are bidding on it — it may be a low-competition opportunity.
                                        </p>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="space-y-3">

                                    {/* Categories + Annotations */}
                                    <div className="space-y-3">
                                      {d.categories?.length > 0 && (
                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                          <p className="text-xs font-bold text-gray-700 mb-2">📂 Categories</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {d.categories.slice(0, 8).map((cat: string, i: number) => (
                                              <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full font-medium">{cat}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {d.keywordAnnotations?.length > 0 && (
                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                          <p className="text-xs font-bold text-gray-700 mb-2">🏷️ Keyword Annotations</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {d.keywordAnnotations.slice(0, 8).map((ann: string, i: number) => (
                                              <span key={i} className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full font-medium">{ann}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {d.categories?.length === 0 && d.keywordAnnotations?.length === 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                                          <span className="text-xl">⚠️</span>
                                          <div>
                                            <p className="text-sm font-bold text-amber-800">Limited keyword data available</p>
                                            <p className="text-xs text-amber-600 mt-0.5">This keyword has low Google Ads activity in the selected location.</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                  </div>
                                );
                              })()}

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {keywords.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        No keywords tracked yet. Add one above to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        /* Existing Audit View */
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 mb-10">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Domain Analysis</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onBlur={(e) => {
                      // Skip if focus moved to the Run Audit button — onClick will handle it
                      const rel = e.relatedTarget as HTMLElement | null;
                      if (rel?.tagName === 'BUTTON') return;
                      if (e.target.value.trim()) handleAudit(e.target.value.trim());
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAudit(domain.trim()); }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    placeholder="Enter domain (e.g., competitor.com)"
                  />
                  <button
                    onClick={() => handleAudit()}
                    disabled={loading}
                    className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-50 min-w-[140px] justify-center"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing…
                      </>
                    ) : 'Run Audit'}
                  </button>
                </div>
              </div>
              <div className="flex gap-4">
                 <div className="text-center px-6 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Pages Indexed</p>
                    <p className="text-2xl font-black text-indigo-600">
                      {auditMetrics ? auditMetrics.indexedCount.toLocaleString() : '--'}
                    </p>
                 </div>
                 <div className={`text-center px-6 py-2 rounded-xl border ${auditMetrics ? (auditMetrics.score >= 70 ? 'bg-emerald-50 border-emerald-100' : auditMetrics.score >= 40 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100') : 'bg-slate-50 border-slate-100'}`}>
                    <p className={`text-[10px] font-bold uppercase ${auditMetrics ? (auditMetrics.score >= 70 ? 'text-emerald-400' : auditMetrics.score >= 40 ? 'text-amber-400' : 'text-red-400') : 'text-slate-400'}`}>Health Score</p>
                    <p className={`text-2xl font-black ${auditMetrics ? (auditMetrics.score >= 70 ? 'text-emerald-600' : auditMetrics.score >= 40 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}`}>
                      {auditMetrics ? `${auditMetrics.score}%` : '--'}
                    </p>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 h-80">
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <span>📈</span> Organic Traffic Trend · {dateRange.preset}
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-4">Estimated from tracked keyword rankings</p>
                  <ResponsiveContainer width="100%" height="82%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <YAxis hide />
                      <Tooltip />
                      <Area type="monotone" dataKey="traffic" stroke="#6366f1" fillOpacity={1} fill="url(#colorTraffic)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {loading && (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 space-y-4 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-5/6" />
                    <div className="h-3 bg-slate-100 rounded w-4/6" />
                    <div className="h-3 bg-slate-100 rounded w-full mt-4" />
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <p className="text-xs text-slate-400 text-center pt-2">Scanning domain via Google Search…</p>
                  </div>
                )}
                {!loading && audit && (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h3 className="text-xl font-bold mb-4 text-slate-900">
                      Site Audit Report · {new Date().toLocaleDateString()}
                    </h3>
                    <div className="text-slate-600 leading-relaxed whitespace-pre-wrap text-sm font-mono">
                      {audit.analysis}
                    </div>
                    {audit.sources.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Sources Found</p>
                        <ul className="space-y-1">
                          {audit.sources.slice(0, 6).map((s, i) => (
                            <li key={i}>
                              <a href={s.uri} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-indigo-600 hover:underline truncate block">{s.title || s.uri}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-4">Tracked Keywords</h4>
                  <div className="space-y-3">
                    {keywords.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        No keywords tracked yet.<br />Add keywords in the Rankings tab.
                      </p>
                    ) : (
                      [...keywords]
                        .sort((a, b) => b.volume - a.volume)
                        .slice(0, 5)
                        .map((kw) => (
                          <div key={kw.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                            <div>
                              <p className="text-sm font-bold text-slate-700">{kw.keyword}</p>
                              <p className="text-[10px] text-slate-400">Vol: {kw.volume.toLocaleString()} · Rank: #{kw.rank || '—'}</p>
                            </div>
                            <div className={`px-2 py-1 rounded text-[10px] font-bold ${kw.difficulty < 30 ? 'bg-green-100 text-green-600' : kw.difficulty < 60 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                              KD: {kw.difficulty}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl shadow-indigo-200">
                  <h4 className="font-bold mb-2">Backlink Opportunity</h4>
                  <p className="text-sm text-indigo-100 mb-4">You have 14 broken backlinks pointing to pages that don't exist.</p>
                  <button className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-bold transition-all">
                    Export Target List
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'ai-visibility' && (
        <div className="space-y-4">
          {/* Brand input */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-1">🤖 AI Visibility Tracker</h3>
            <p className="text-xs text-slate-400 mb-4">Track how often AI assistants mention your brand across ChatGPT, Gemini, Perplexity and Copilot.</p>
            <div className="flex gap-3">
              <input
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLLMCheck()}
                placeholder="Enter brand name (e.g. ArivuPro Academy)"
                className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
              />
              <button
                onClick={handleLLMCheck}
                disabled={llmLoading || !brandName.trim()}
                className="text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-colors whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}
              >
                {llmLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing…
                  </span>
                ) : 'Check Visibility'}
              </button>
            </div>
          </div>

          {llmData.length > 0 && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {llmData.map(platform => (
                <div key={platform.platform} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {platform.platform === 'chatgpt'    ? '🤖' :
                         platform.platform === 'gemini'     ? '✨' :
                         platform.platform === 'perplexity' ? '🔮' : '🦅'}
                      </span>
                      <span className="font-bold text-slate-800 text-sm capitalize">
                        {platform.platform === 'chatgpt'    ? 'ChatGPT'    :
                         platform.platform === 'gemini'     ? 'Gemini'     :
                         platform.platform === 'perplexity' ? 'Perplexity' : 'Copilot'}
                      </span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      platform.visibility > 60 ? 'bg-green-100 text-green-700'  :
                      platform.visibility > 30 ? 'bg-amber-100 text-amber-700'  :
                                                 'bg-red-100   text-red-700'
                    }`}>
                      {platform.visibility}% Visibility
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Visibility</span><span>{platform.visibility}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${platform.visibility}%` }} />
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Sentiment</span><span>{platform.sentiment}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${platform.sentiment}%`,
                          backgroundColor: platform.sentiment > 70 ? '#059669' :
                                           platform.sentiment > 40 ? '#D97706' : '#DC2626',
                        }} />
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-3">{platform.topicsCount} topic{platform.topicsCount !== 1 ? 's' : ''} found</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default SeoSuitePanel;
