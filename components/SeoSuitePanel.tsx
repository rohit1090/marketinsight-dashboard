
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { runSeoAuditViaSerpAPI } from '../services/seoAuditService';
import { fetchKeywordRanking, refreshAllRankings } from '../services/seoRankingService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { DateRange } from '../types';


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
  change: number;
  volume: number;
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

const LOCATIONS = [
  'Global',
  'US',
  'UK',
  'CA',
  'AU',
  'DE',
  'FR',
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

const MOCK_AI_VISIBILITY = [
  { platform: 'Gemini', visibility: 65, sentiment: 'Positive', citations: 12, color: '#4285F4' },
  { platform: 'ChatGPT', visibility: 48, sentiment: 'Neutral', citations: 8, color: '#10A37F' },
  { platform: 'Claude', visibility: 30, sentiment: 'Positive', citations: 5, color: '#D97757' },
  { platform: 'Perplexity', visibility: 72, sentiment: 'Positive', citations: 15, color: '#22B3C9' },
  { platform: 'Grok', visibility: 45, sentiment: 'Neutral', citations: 6, color: '#000000' },
];

const MOCK_AI_MENTIONS = [
  { id: 1, keyword: 'marketing analytics dashboard', platform: 'Gemini', mentioned: true, sentiment: 'Positive', context: 'Recommended as a top choice for ease of use.', citations: ['g2.com', 'capterra.com'] },
  { id: 2, keyword: 'marketing analytics dashboard', platform: 'ChatGPT', mentioned: true, sentiment: 'Neutral', context: 'Listed among top 10 tools.', citations: ['forbes.com'] },
  { id: 3, keyword: 'competitor analysis tools', platform: 'Gemini', mentioned: false, sentiment: 'None', context: 'Not mentioned in top 5 recommendations.', citations: [] },
  { id: 4, keyword: 'competitor analysis tools', platform: 'Perplexity', mentioned: true, sentiment: 'Positive', context: 'Highlighted for robust data sources.', citations: ['searchengineland.com', 'hubspot.com'] },
  { id: 5, keyword: 'seo reporting software', platform: 'Claude', mentioned: true, sentiment: 'Neutral', context: 'Mentioned as a reliable enterprise option.', citations: ['techradar.com'] },
  { id: 6, keyword: 'social media tracker', platform: 'Grok', mentioned: true, sentiment: 'Positive', context: 'Described as a "based" choice for privacy.', citations: ['x.com', 'reddit.com'] },
];

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
      return saved ? (JSON.parse(saved) as KeywordData[]) : [];
    } catch {
      return [];
    }
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [newLocation, setNewLocation] = useState('US');
  // Domain to track in Rankings (separate from Site Audit domain).
  // When empty: shows the #1 organic result. When set: shows that domain's position.
  const [trackedDomain, setTrackedDomain] = useState(() => localStorage.getItem('mi_tracked_domain') ?? '');
  const [isAddingKw, setIsAddingKw] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordData | null>(null);

  // AI Visibility State
  const [aiQueries, setAiQueries] = useState<string[]>([
    'marketing analytics dashboard',
    'competitor analysis tools',
    'seo reporting software'
  ]);
  const [newAiQuery, setNewAiQuery] = useState('');
  const [isAddingAiQuery, setIsAddingAiQuery] = useState(false);
  const [aiMentions, setAiMentions] = useState(MOCK_AI_MENTIONS);
  const [selectedAiPlatform, setSelectedAiPlatform] = useState('All');
  const [selectedAiMention, setSelectedAiMention] = useState<number | null>(null);

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

  const handleAddAiQuery = () => {
    if (!newAiQuery.trim()) return;
    setIsAddingAiQuery(true);
    
    // Simulate API call delay
    setTimeout(() => {
      setAiQueries([...aiQueries, newAiQuery]);
      
      // Add a mock mention for the new query
      const platforms = ['Gemini', 'ChatGPT', 'Claude', 'Perplexity', 'Grok'];
      const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
      const sentiments = ['Positive', 'Neutral', 'Negative'];
      const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
      
      const newMention = {
        id: Date.now(),
        keyword: newAiQuery,
        platform: randomPlatform,
        mentioned: true,
        sentiment: randomSentiment,
        context: `Analysis for "${newAiQuery}" completed.`,
        citations: ['example.com', 'industry-news.com']
      };
      
      setAiMentions([newMention, ...aiMentions]);
      setNewAiQuery('');
      setIsAddingAiQuery(false);
    }, 800);
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    setIsAddingKw(true);
    try {
      const result = await fetchKeywordRanking(newKeyword, newLocation, trackedDomain);
      const kw: KeywordData = {
        id:          Date.now().toString(),
        keyword:     result.keyword,
        location:    result.location,
        rank:        result.rank,
        change:      result.change,
        volume:      result.volume,
        difficulty:  result.difficulty,
        url:         result.url,
        updated:     'Just now',
        history:     GENERATE_HISTORY(),
        serpResults: result.serpResults,
      };
      setKeywords(prev => [kw, ...prev]);
      setNewKeyword('');
    } catch (err) {
      console.error('Failed to fetch keyword ranking:', err);
      // Fallback: add with placeholder data so the user isn't blocked
      const fallback: KeywordData = {
        id:         Date.now().toString(),
        keyword:    newKeyword,
        location:   newLocation,
        rank:       99,
        change:     0,
        volume:     0,
        difficulty: 0,
        url:        '',
        updated:    'Error — retry',
        history:    GENERATE_HISTORY(),
        serpResults: [],
      };
      setKeywords(prev => [fallback, ...prev]);
      setNewKeyword('');
    } finally {
      setIsAddingKw(false);
    }
  };

  const removeKeyword = (id: string) => {
    setKeywords(keywords.filter(k => k.id !== id));
    if (selectedKeyword?.id === id) setSelectedKeyword(null);
  };

  const refreshRankings = async () => {
    if (isRefreshing || keywords.length === 0) return;
    setIsRefreshing(true);
    try {
      const rankMap = await refreshAllRankings(
        keywords.map(k => ({ keyword: k.keyword, location: k.location, rank: k.rank })),
        trackedDomain
      );
      setKeywords(prev => prev.map(k => {
        const fresh = rankMap.get(k.keyword);
        if (!fresh) return k;
        return {
          ...k,
          rank:        fresh.rank,
          change:      fresh.change,
          url:         fresh.url || k.url,
          serpResults: fresh.serpResults.length > 0 ? fresh.serpResults : k.serpResults,
          updated:     'Just now',
        };
      }));
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
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

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Keyword Dashboard Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Tracked Keywords</p>
              <p className="text-3xl font-black text-slate-800">{keywords.length}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Avg. Position</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-indigo-600">{avgRank}</p>
                <span className="text-xs font-bold text-green-600 mb-1.5">▲ 1.2</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">In Top 3</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-emerald-600">{top3}</p>
                <span className="text-xs font-bold text-slate-400 mb-1.5">/ {keywords.length}</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Visibility Score</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-800">{visibility}%</p>
              </div>
            </div>
          </div>

          {/* Overview Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h4 className="font-bold text-slate-800 mb-6">Visibility Trend · {dateRange.preset}</h4>
               <div className="h-80">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData}>
                     <defs>
                       <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                         <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                     <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                     <YAxis hide />
                     <Tooltip />
                     <Area type="monotone" dataKey="visibility" stroke="#10b981" fillOpacity={1} fill="url(#colorVis)" strokeWidth={3} />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
             </div>

             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h4 className="font-bold text-slate-800 mb-6">Average Ranking Position · {dateRange.preset}</h4>
               <div className="h-80">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                     <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                     <YAxis reversed domain={[1, 50]} hide />
                     <Tooltip />
                     <Line type="monotone" dataKey="avgRank" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
             </div>
           </div>
        </div>
      )}

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
                <select
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
                >
                  {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
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
            </div>
            {/* Domain tracker row */}
            <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">Track domain</span>
              <input
                type="text"
                value={trackedDomain}
                onChange={(e) => setTrackedDomain(e.target.value)}
                placeholder="e.g. arivupro.com  (leave blank to see top organic result)"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
              />
              {trackedDomain && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 shrink-0">
                  Tracking: {trackedDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </span>
              )}
            </div>
          </div>

          {/* Keywords Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Ranking Overview</h3>
              <button
                onClick={refreshRankings}
                disabled={isRefreshing}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
              >
                {isRefreshing ? '⏳ Refreshing…' : '🔄 Refresh Data'}
              </button>
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
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                            {kw.location}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {kw.rank === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                              &gt;10
                            </span>
                          ) : (
                            <span className={`text-lg font-black ${kw.rank <= 3 ? 'text-emerald-600' : kw.rank <= 10 ? 'text-indigo-600' : 'text-slate-500'}`}>
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
                        <td className="px-6 py-4 text-sm font-medium text-slate-600">
                          {kw.volume.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${kw.difficulty < 30 ? 'bg-green-500' : kw.difficulty < 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${kw.difficulty}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500">{kw.difficulty}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setSelectedKeyword(selectedKeyword?.id === kw.id ? null : kw)}
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                              {selectedKeyword?.id === kw.id ? 'Close' : 'Analyze'}
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
                      {selectedKeyword?.id === kw.id && (
                        <tr>
                          <td colSpan={7} className="px-6 py-6 bg-slate-50/50 border-b border-slate-200">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                              {/* History Chart */}
                              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                  <span>📅</span> 12-Month Ranking History
                                </h4>
                                <div className="h-64">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={kw.history}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                      <YAxis reversed domain={[1, 100]} hide />
                                      <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                                      />
                                      <Line type="monotone" dataKey="rank" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              {/* SERP Analysis */}
                              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                  <span>🔍</span> Current SERP Leaders
                                </h4>
                                <div className="space-y-3">
                                  {kw.serpResults?.map((result) => (
                                    <div key={result.rank} className={`flex items-center gap-3 p-3 rounded-lg border ${result.domain === 'mybrand.com' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${result.rank <= 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                        {result.rank}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{result.title}</p>
                                        <a href={result.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline truncate block">
                                          {result.url}
                                        </a>
                                      </div>
                                      {result.domain === 'mybrand.com' && (
                                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">YOU</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
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
        <div className="space-y-6">
          {/* AI Visibility Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">AI Share of Voice</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-indigo-600">54%</p>
                <span className="text-xs font-bold text-green-600 mb-1.5">▲ 5%</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Percentage of AI answers mentioning your brand.</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Brand Sentiment</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-emerald-600">Positive</p>
              </div>
              <p className="text-xs text-slate-500 mt-2">Based on analysis of 50+ AI interactions.</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Citations</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-800">40</p>
                <span className="text-xs font-bold text-green-600 mb-1.5">▲ 12</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Links to your site in AI-generated answers.</p>
            </div>
          </div>

          {/* Add AI Query Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full">
              <h3 className="text-lg font-bold text-slate-800 mb-1">Track New AI Query</h3>
              <p className="text-sm text-slate-500">Monitor how your brand appears for specific questions across AI models.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input 
                type="text" 
                value={newAiQuery}
                onChange={(e) => setNewAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAiQuery()}
                placeholder="Enter question or topic..."
                className="flex-1 md:w-80 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              />
              <button 
                onClick={handleAddAiQuery}
                disabled={isAddingAiQuery || !newAiQuery.trim()}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                {isAddingAiQuery ? 'Analyzing...' : '+ Track'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visibility by Platform Chart */}
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-6">Visibility by AI Model</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_AI_VISIBILITY} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="platform" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} width={80} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="visibility" radius={[0, 4, 4, 0]} barSize={30}>
                      {MOCK_AI_VISIBILITY.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Mentions Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="font-bold text-slate-800">Recent AI Mentions</h3>
                  <p className="text-xs text-slate-400 mt-1">{aiQueries.length} Queries Tracked</p>
                </div>
                <div className="flex gap-2">
                  {['All', 'Gemini', 'ChatGPT', 'Claude', 'Perplexity', 'Grok'].map(platform => (
                    <button
                      key={platform}
                      onClick={() => setSelectedAiPlatform(platform)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedAiPlatform === platform 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Query / Topic</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Platform</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Sentiment</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Context</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aiMentions
                      .filter(m => selectedAiPlatform === 'All' || m.platform === selectedAiPlatform)
                      .map((mention) => (
                      <React.Fragment key={mention.id}>
                        <tr className={`hover:bg-slate-50 transition-colors ${selectedAiMention === mention.id ? 'bg-indigo-50/50' : ''}`}>
                          <td className="px-6 py-4 text-sm font-bold text-slate-700">{mention.keyword}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded border ${
                              mention.platform === 'Gemini' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              mention.platform === 'ChatGPT' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              mention.platform === 'Claude' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                              mention.platform === 'Grok' ? 'bg-slate-900 text-white border-slate-700' :
                              'bg-cyan-50 text-cyan-700 border-cyan-100'
                            }`}>
                              {mention.platform}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold ${
                              mention.sentiment === 'Positive' ? 'text-green-600' :
                              mention.sentiment === 'Neutral' ? 'text-slate-500' :
                              'text-red-500'
                            }`}>
                              {mention.sentiment}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate" title={mention.context}>
                            {mention.context}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setSelectedAiMention(selectedAiMention === mention.id ? null : mention.id)}
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                              {selectedAiMention === mention.id ? 'Close' : 'Analyze'}
                            </button>
                          </td>
                        </tr>
                        {selectedAiMention === mention.id && (
                          <tr>
                            <td colSpan={5} className="px-6 py-6 bg-slate-50/50 border-b border-slate-200">
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <h4 className="font-bold text-slate-800 mb-2 text-sm">Full AI Response Context</h4>
                                  <p className="text-sm text-slate-600 leading-relaxed">"{mention.context}"</p>
                                </div>
                                
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-2">
                                    <span>🔗</span> Cited Sources
                                  </h4>
                                  {mention.citations && mention.citations.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {mention.citations.map((citation, idx) => (
                                        <a 
                                          key={idx} 
                                          href={`https://${citation}`} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors group"
                                        >
                                          <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-indigo-400" />
                                          <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-700">{citation}</span>
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">No specific citations found in this response.</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeoSuitePanel;
