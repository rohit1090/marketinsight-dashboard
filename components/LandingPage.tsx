
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Search,
  Share2,
  ShieldCheck,
  ArrowRight,
  Zap,
  CheckCircle2,
  LayoutDashboard,
  TrendingUp,
  Users,
  Globe,
  ChevronLeft,
  ChevronRight,
  Brain,
  LineChart,
  Target
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

const PREVIEW_DATA = [
  { name: 'Mon', value: 400 },
  { name: 'Tue', value: 300 },
  { name: 'Wed', value: 600 },
  { name: 'Thu', value: 800 },
  { name: 'Fri', value: 500 },
  { name: 'Sat', value: 900 },
  { name: 'Sun', value: 1100 },
];

const SLIDES = [
  {
    tag: 'AI Strategy Agent',
    tagColor: 'text-violet-300 bg-violet-500/20',
    title: 'Automate Your',
    highlight: 'Marketing Strategy',
    desc: 'Our autonomous AI agent scans all your channels, detects opportunities, and proposes interventions — all in real time.',
    bullets: ['Deep reasoning with Gemini AI', 'Auto-bid & creative optimisation', 'One-click intervention approval'],
    icon: Brain,
    preview: (
      <div className="space-y-3">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></div>
            <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest">Agent Thought Stream</span>
          </div>
          {[
            { type: 'analysis', msg: 'Scanning Google Ads performance across 14 campaigns...', color: 'text-blue-400' },
            { type: 'alert', msg: 'ROAS volatility +14% detected in "Summer Alpha".', color: 'text-red-400' },
            { type: 'success', msg: 'Neural link established with Meta Ads API.', color: 'text-emerald-400' },
            { type: 'action', msg: 'Dispatching bid adjustment — Google Search +12%.', color: 'text-indigo-400' },
          ].map((log, i) => (
            <div key={i} className="text-[10px] font-mono mb-1.5">
              <span className={`font-bold uppercase mr-1 ${log.color}`}>{log.type}:</span>
              <span className="text-slate-400">{log.msg}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: 'Creative Swap', channel: 'Facebook', impact: 'HIGH', impactColor: 'text-red-400', desc: 'Replace low-performing video with carousel.' },
            { title: 'Bid Adjustment', channel: 'Google', impact: 'MED', impactColor: 'text-amber-400', desc: 'Raise "marketing automation" bids by 12%.' },
          ].map((inv, i) => (
            <div key={i} className="bg-white rounded-xl p-3 relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${i === 0 ? 'bg-red-500' : 'bg-amber-400'}`}></div>
              <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{inv.channel}</span>
              <p className="text-[11px] font-bold text-slate-800 mt-1.5 mb-1">{inv.title}</p>
              <p className="text-[9px] text-slate-400 mb-2 leading-tight">{inv.desc}</p>
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-black ${inv.impactColor}`}>Impact: {inv.impact}</span>
                <span className="text-[9px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-lg">Approve</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: 'SEO Suite',
    tagColor: 'text-blue-300 bg-blue-500/20',
    title: 'Dominate',
    highlight: 'Search Rankings',
    desc: 'Run AI-powered SEO audits on any domain and get a prioritised action plan to climb Google rankings fast.',
    bullets: ['Domain authority & backlink audit', 'Keyword gap & opportunity finder', 'Live Core Web Vitals scores'],
    icon: Search,
    preview: (
      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">SEO Audit — example.com</p>
            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Score: 74/100</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: '74%' }}></div>
          </div>
          {[
            { label: 'Domain Authority', value: '52', status: 'good' },
            { label: 'Backlinks', value: '1,840', status: 'good' },
            { label: 'Page Speed', value: '61ms', status: 'warn' },
            { label: 'Core Web Vitals', value: 'Needs Work', status: 'bad' },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-[10px] text-slate-500">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-700">{row.value}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'good' ? 'bg-emerald-500' : row.status === 'warn' ? 'bg-amber-400' : 'bg-red-400'}`}></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Keyword Opportunities</p>
          {[
            { kw: 'marketing analytics tool', vol: '12K', diff: 'Easy' },
            { kw: 'ad spend tracker', vol: '8.4K', diff: 'Medium' },
            { kw: 'ROAS optimization', vol: '5.1K', diff: 'Easy' },
          ].map((kw, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-[10px] text-slate-600 font-medium">{kw.kw}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400">{kw.vol}/mo</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${kw.diff === 'Easy' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{kw.diff}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: 'Market Intelligence',
    tagColor: 'text-emerald-300 bg-emerald-500/20',
    title: 'Track Every',
    highlight: 'Competitor Move',
    desc: 'Monitor competitor ad spend, market share, and sentiment in real time using live data grounded by Google Search.',
    bullets: ['Live competitor ad spend tracking', 'Market share & sentiment analysis', 'Grounded by Google Search API'],
    icon: Target,
    preview: (
      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Competitor Benchmarks</p>
            <span className="text-[9px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">Live</span>
          </div>
          {[
            { name: 'Your Brand', share: 28, spend: '$45K', sentiment: 87, color: 'bg-indigo-500' },
            { name: 'Rival Alpha', share: 35, spend: '$62K', sentiment: 72, color: 'bg-slate-300' },
            { name: 'Rival Beta', share: 22, spend: '$31K', sentiment: 65, color: 'bg-slate-200' },
            { name: 'Rival Gamma', share: 15, spend: '$20K', sentiment: 58, color: 'bg-slate-100' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
              <div className={`w-2 h-2 rounded-full ${c.color} shrink-0`}></div>
              <span className="text-[10px] font-semibold text-slate-700 w-20 shrink-0">{c.name}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.share * 2.5}%` }}></div>
              </div>
              <span className="text-[9px] font-black text-slate-700 w-8 text-right">{c.share}%</span>
              <span className="text-[9px] text-slate-400 w-10 text-right">{c.spend}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 text-white">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-100 mb-1">Avg. Sentiment</p>
            <p className="text-2xl font-black">87%</p>
            <p className="text-[9px] text-emerald-200 mt-1">+4pts vs last month</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Share of Voice</p>
            <p className="text-2xl font-black text-slate-800">28%</p>
            <p className="text-[9px] text-emerald-500 font-bold mt-1">↑ +2.4% this week</p>
          </div>
        </div>
      </div>
    ),
  },
];

const FeatureCarousel: React.FC = () => {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);

  const go = (idx: number) => {
    setDirection(idx > active ? 1 : -1);
    setActive(idx);
  };
  const prev = () => go(active === 0 ? SLIDES.length - 1 : active - 1);
  const next = () => go(active === SLIDES.length - 1 ? 0 : active + 1);

  const slide = SLIDES[active];

  return (
    <section className="py-24 bg-slate-900 overflow-hidden relative">
      {/* background glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 bg-indigo-500/10 text-indigo-400 text-xs font-bold rounded-full uppercase tracking-wider border border-indigo-500/20 mb-4">
            Platform Highlights
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Built for Every Part of Your <span className="text-indigo-400">Growth Stack</span>
          </h2>
        </div>

        {/* Slide */}
        <div className="relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={active}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d > 0 ? 80 : -80 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d > 0 ? -80 : 80 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="flex flex-col lg:flex-row items-center gap-14"
            >
              {/* Left text */}
              <div className="flex-1 text-left">
                <span className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/10 mb-6 ${slide.tagColor}`}>
                  <slide.icon size={12} />
                  {slide.tag}
                </span>
                <h3 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
                  {slide.title} <br />
                  <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                    {slide.highlight}
                  </span>
                </h3>
                <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-md">{slide.desc}</p>
                <ul className="space-y-3 mb-10">
                  {slide.bullets.map((b, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <div className="w-5 h-5 bg-indigo-500/20 rounded-full border border-indigo-500/40 flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                      </div>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-4">
                  <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all text-sm shadow-lg shadow-indigo-900/40 active:scale-95">
                    Explore Feature <ArrowRight size={15} />
                  </button>
                  <button className="text-sm font-bold text-slate-400 hover:text-white transition-colors">
                    See demo →
                  </button>
                </div>
              </div>

              {/* Right preview */}
              <div className="flex-1 w-full">
                <div className="bg-slate-800/60 backdrop-blur border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-2 px-5 py-3.5 bg-slate-900/80 border-b border-slate-700/60">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/70"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/70"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/70"></div>
                    </div>
                    <div className="flex-1 mx-4 bg-slate-800 rounded-md px-3 py-1 flex items-center gap-2">
                      <Globe size={10} className="text-slate-500" />
                      <span className="text-[10px] text-slate-500 font-mono">app.marketinsight.pro/{slide.tag.toLowerCase().replace(/ /g, '-')}</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                  <div className="p-5 bg-slate-50">
                    {slide.preview}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mt-14">
          <button
            onClick={prev}
            className="w-11 h-11 rounded-full border border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-white flex items-center justify-center transition-all"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === active ? 'w-8 h-2.5 bg-indigo-500' : 'w-2.5 h-2.5 bg-slate-700 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="w-11 h-11 rounded-full border border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-white flex items-center justify-center transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};

interface LandingPageProps {
  onLogin: () => void;
  onStartTrial: () => void;
}


const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onStartTrial }) => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Zap className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">MarketInsight</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
            <a href="#integrations" className="hover:text-indigo-600 transition-colors">Integrations</a>
            <a href="#about" className="hover:text-indigo-600 transition-colors">About</a>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onLogin}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Login
            </button>
            <button 
              onClick={onStartTrial}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-full transition-all shadow-lg shadow-indigo-100 active:scale-95"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full uppercase tracking-wider mb-6">
              AI-Powered Marketing Platform
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-8">
              AI-Powered Marketing <br />
              <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
                Intelligence
              </span> for Modern Teams
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-slate-500 font-medium mb-10 leading-relaxed">
              Track ad spend, conversions, SEO performance, and competitor insights in one intelligent dashboard. Stop guessing, start growing.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
              <button 
                onClick={onStartTrial}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 group"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={onLogin}
                className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
              >
                Login to Dashboard
              </button>
            </div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative max-w-5xl mx-auto"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-20 blur-3xl rounded-[3rem] -z-10"></div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-4 md:p-8">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">app.marketinsight.pro</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                  { label: 'Ad Spend', value: '$45,280', change: '+12.5%', icon: Zap, color: 'indigo' },
                  { label: 'Conversions', value: '1,240', change: '+8.2%', icon: TrendingUp, color: 'blue' },
                  { label: 'Avg. ROAS', value: '4.2x', change: '-2.1%', icon: BarChart3, color: 'emerald' },
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left">
                    <div className={`w-10 h-10 bg-${stat.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                      <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                    <div className="flex items-end justify-between">
                      <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                      <span className={`text-xs font-bold ${stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>
                        {stat.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-72 bg-slate-50 rounded-2xl border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold text-slate-900">Conversion Growth Trend</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Data</span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    <AreaChart data={PREVIEW_DATA}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          borderRadius: '12px', 
                          border: '1px solid #f1f5f9', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#6366f1" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Powerful Features for Growth</h2>
            <p className="text-slate-500 font-medium">Everything you need to dominate your market in one place.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: 'AI Insights',
                desc: 'Automatically analyze marketing performance and get AI-powered recommendations.',
                icon: Zap,
                color: 'from-indigo-600 to-indigo-400'
              },
              {
                title: 'SEO Suite',
                desc: 'Track keyword rankings, backlinks, and search visibility.',
                icon: Search,
                color: 'from-blue-600 to-blue-400'
              },
              {
                title: 'Social Hub',
                desc: 'Monitor engagement and growth across all social platforms.',
                icon: Share2,
                color: 'from-violet-600 to-violet-400'
              },
              {
                title: 'Competitor Intel',
                desc: 'Understand competitor strategies and market positioning.',
                icon: ShieldCheck,
                color: 'from-emerald-600 to-emerald-400'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-100`}>
                  <feature.icon className="text-white w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Showcase Carousel */}
      <FeatureCarousel />

      {/* How It Works */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-4xl font-bold text-slate-900 mb-8 leading-tight">
                How It Works: From Data to <br />
                <span className="text-indigo-600 font-black italic">Strategic Action</span>
              </h2>
              
              <div className="space-y-10">
                {[
                  { step: '01', title: 'Connect your channels', desc: 'One-click integrations with Google Ads, Facebook, LinkedIn, and more.' },
                  { step: '02', title: 'AI analyzes performance', desc: 'Our advanced models process millions of data points to find patterns.' },
                  { step: '03', title: 'Get insights & optimize', desc: 'Receive actionable recommendations to improve your ROAS and growth.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="text-4xl font-black text-slate-100 select-none leading-none">{item.step}</div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h4>
                      <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex-1 relative">
              <div className="absolute -inset-10 bg-indigo-50 rounded-full blur-3xl -z-10"></div>

              {/* Mini Dashboard Preview */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden">

                {/* Top Bar */}
                <div className="bg-slate-900 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-md">
                    <Globe className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-400 font-mono">app.marketinsight.pro</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>

                <div className="p-5 space-y-4 bg-slate-50">

                  {/* KPI Row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Ad Spend', value: '$45.2K', change: '+12.5%', up: true, color: 'indigo' },
                      { label: 'ROAS', value: '4.2x', change: '+8.2%', up: true, color: 'violet' },
                      { label: 'CPA', value: '$18.4', change: '-5.1%', up: false, color: 'emerald' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
                        <p className="text-base font-black text-slate-800 leading-none">{s.value}</p>
                        <span className={`text-[9px] font-bold ${s.up ? 'text-emerald-500' : 'text-red-400'}`}>{s.change}</span>
                      </div>
                    ))}
                  </div>

                  {/* Channel Performance */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Channel Performance</p>
                      <span className="text-[9px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">Live</span>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { name: 'Google Ads', roas: '5.1x', pct: 82, color: 'bg-blue-500' },
                        { name: 'Facebook', roas: '3.8x', pct: 61, color: 'bg-indigo-500' },
                        { name: 'LinkedIn', roas: '2.9x', pct: 47, color: 'bg-violet-500' },
                        { name: 'TikTok', roas: '4.2x', pct: 68, color: 'bg-pink-500' },
                      ].map((ch, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <p className="text-[10px] font-semibold text-slate-600 w-16 shrink-0">{ch.name}</p>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${ch.color} rounded-full`} style={{ width: `${ch.pct}%` }}></div>
                          </div>
                          <p className="text-[10px] font-black text-slate-700 w-8 text-right shrink-0">{ch.roas}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Insight + Competitor side by side */}
                  <div className="grid grid-cols-2 gap-3">

                    {/* AI Insight card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl p-4 text-white">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Zap className="w-3 h-3 text-indigo-200" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">AI Insight</p>
                      </div>
                      <p className="text-[11px] font-bold leading-snug mb-3">Increase Facebook bids 12% — evening intent is peaking.</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold">+$4.2K est.</span>
                        <span className="text-[9px] font-black text-indigo-200">→ Apply</span>
                      </div>
                    </div>

                    {/* Competitor tracker */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Market Share</p>
                      <div className="space-y-2">
                        {[
                          { name: 'You', share: 28, color: 'bg-indigo-500' },
                          { name: 'Rival A', share: 35, color: 'bg-slate-300' },
                          { name: 'Rival B', share: 22, color: 'bg-slate-200' },
                        ].map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${c.color} shrink-0`}></div>
                            <p className="text-[9px] text-slate-600 w-10 shrink-0">{c.name}</p>
                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.share * 2}%` }}></div>
                            </div>
                            <p className="text-[9px] font-black text-slate-700">{c.share}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mini area chart */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Conversion Trend</p>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div style={{ width: '100%', height: 72 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={PREVIEW_DATA} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="hwGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#hwGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 font-medium">Choose the plan that fits your growth stage.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Starter',
                price: '$19',
                features: ['Basic analytics', '3 integrations', 'Daily updates', 'Email support'],
                cta: 'Start Free Trial',
                popular: false
              },
              {
                name: 'Growth',
                price: '$49',
                features: ['AI insights', 'Competitor analysis', 'Automated reports', '10 integrations', 'Priority support'],
                cta: 'Start Free Trial',
                popular: true
              },
              {
                name: 'Enterprise',
                price: '$99',
                features: ['Unlimited integrations', 'Advanced analytics', 'Custom AI models', 'Dedicated manager', '24/7 support'],
                cta: 'Contact Sales',
                popular: false
              }
            ].map((plan, i) => (
              <div 
                key={i}
                className={`p-10 rounded-[2.5rem] border ${plan.popular ? 'border-indigo-500 bg-indigo-500/5 relative' : 'border-slate-800 bg-slate-800/50'} transition-all hover:border-indigo-400`}
              >
                {plan.popular && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-slate-400 text-sm">/month</span>
                </div>
                
                <ul className="space-y-4 mb-10">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                
                <button 
                  onClick={onStartTrial}
                  className={`w-full py-4 rounded-2xl font-bold transition-all ${plan.popular ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-900/20' : 'bg-white text-slate-900 hover:bg-slate-100'}`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-indigo-600 to-blue-600 rounded-[3rem] p-12 md:p-20 text-center text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl -ml-32 -mb-32"></div>
          
          <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
            Start making smarter <br /> marketing decisions today
          </h2>
          <p className="text-indigo-100 text-lg font-medium mb-10 max-w-xl mx-auto">
            Join 2,000+ teams using MarketInsight to scale their advertising and SEO performance with AI.
          </p>
          <button 
            onClick={onStartTrial}
            className="px-10 py-5 bg-white text-indigo-600 font-black rounded-2xl hover:bg-slate-50 transition-all shadow-xl active:scale-95"
          >
            Start Your 14-Day Free Trial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Zap className="text-white w-5 h-5" />
                </div>
                <span className="text-lg font-bold tracking-tight text-slate-900">MarketInsight</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                The unified marketing intelligence platform for modern growth teams. AI-powered insights for better decisions.
              </p>
            </div>
            
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'Changelog'] },
              { title: 'Company', links: ['About', 'Careers', 'Blog', 'Contact'] },
              { title: 'Resources', links: ['Documentation', 'Help Center', 'API', 'Privacy Policy'] }
            ].map((group, i) => (
              <div key={i}>
                <h4 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">{group.title}</h4>
                <ul className="space-y-4">
                  {group.links.map((link, j) => (
                    <li key={j}>
                      <a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-100 gap-4">
            <p className="text-slate-400 text-xs">© 2026 MarketInsight Pro. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Users className="w-4 h-4 text-slate-300 hover:text-indigo-600 cursor-pointer transition-colors" />
              <Share2 className="w-4 h-4 text-slate-300 hover:text-indigo-600 cursor-pointer transition-colors" />
              <Globe className="w-4 h-4 text-slate-300 hover:text-indigo-600 cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
