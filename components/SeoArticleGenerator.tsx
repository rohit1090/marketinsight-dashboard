import React, { useState, useCallback } from 'react';
import { generateSeoBlogArticle, SeoArticleResult } from '../services/geminiService';

// ─── Keyword highlight helper ────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightKeywords(text: string, keywords: string[]): string {
  // Render **bold** markdown
  let result = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  if (!keywords.length) return result;
  const sorted = [...keywords].sort((a, b) => b.length - a.length); // longest first
  const pattern = new RegExp(`(${sorted.map(escapeRegex).join('|')})`, 'gi');
  return result.replace(
    pattern,
    '<mark class="bg-yellow-200 text-yellow-900 rounded px-0.5 font-medium">$1</mark>'
  );
}

// ─── Article renderer ────────────────────────────────────────────────────────

function renderArticle(articleText: string, keywords: string[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let paraBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushPara = (key: number) => {
    if (!paraBuffer.length) return;
    const text = paraBuffer.join(' ').trim();
    if (text) {
      nodes.push(
        <p
          key={`p-${key}`}
          className="text-slate-700 leading-relaxed mb-4 text-[15px]"
          dangerouslySetInnerHTML={{ __html: highlightKeywords(text, keywords) }}
        />
      );
    }
    paraBuffer = [];
  };

  const flushList = (key: number) => {
    if (!listBuffer.length) return;
    nodes.push(
      <ul key={`ul-${key}`} className="list-disc list-inside space-y-1 mb-4 text-slate-700 text-[15px]">
        {listBuffer.map((item, idx) => (
          <li key={idx} dangerouslySetInnerHTML={{ __html: highlightKeywords(item, keywords) }} />
        ))}
      </ul>
    );
    listBuffer = [];
  };

  const lines = articleText.split('\n');
  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      flushPara(i); flushList(i);
      nodes.push(
        <h2
          key={`h2-${i}`}
          className="text-xl font-bold text-slate-900 mt-8 mb-3 pb-2 border-b border-slate-100"
        >
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      flushPara(i); flushList(i);
      nodes.push(
        <h3 key={`h3-${i}`} className="text-base font-semibold text-slate-800 mt-5 mb-2">
          {line.slice(4)}
        </h3>
      );
    } else if (line.trim() === '') {
      flushPara(i); flushList(i);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      flushPara(i);
      listBuffer.push(line.slice(2));
    } else {
      flushList(i);
      paraBuffer.push(line);
    }
  });
  flushPara(lines.length);
  flushList(lines.length);
  return nodes;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}> = ({ label, value, sub, color, icon }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-sm`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-900">{value}{sub}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
    </div>
  </div>
);

const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = 'bg-indigo-50 text-indigo-700',
}) => (
  <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${color} mr-1.5 mb-1.5`}>
    {children}
  </span>
);

// Score ring
const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const color =
    score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';
  const label =
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work';
  return (
    <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-current mx-auto mb-1" style={{ borderColor: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444' }}>
      <span className={`text-3xl font-black ${color}`}>{score}</span>
      <span className={`text-[10px] font-bold uppercase ${color}`}>{label}</span>
    </div>
  );
};

// Copy button
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const SeoArticleGenerator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SeoArticleResult | null>(null);

  const allKeywords = result
    ? [result.primaryKeyword, ...result.secondaryKeywords, ...result.lsiKeywords]
    : [];

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await generateSeoBlogArticle(topic.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate article. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [topic]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleGenerate();
  };

  return (
    <div className="space-y-6">
      {/* ── Input card ─────────────────────────────────────────────────── */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">AI SEO Blog Generator</h3>
            <p className="text-sm text-slate-500 mt-1">Enter a topic and get a full SEO-optimized article with metadata, keywords, and ranking analysis.</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {['Gemini AI', 'SEO Optimized', '900+ Words'].map(tag => (
              <span key={tag} className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full font-medium">{tag}</span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Post Topic / Campaign
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g., "Best AI marketing tools for startups"'
              disabled={loading}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 transition-all"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className="bg-indigo-600 text-white px-7 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                '✦ Generate Article'
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* ── Loading skeleton ────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-100 rounded-2xl h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-slate-100 rounded-2xl h-96" />
            <div className="bg-slate-100 rounded-2xl h-96" />
          </div>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {result && !loading && (
        <div className="space-y-6 animate-in fade-in duration-500">

          {/* Stat cards row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="SEO Score"
              value={result.seoScore}
              color="bg-emerald-50"
              icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard
              label="Word Count"
              value={result.wordCount.toLocaleString()}
              color="bg-indigo-50"
              icon={<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            />
            <StatCard
              label="Reading Time"
              value={result.readingTime}
              sub=" min"
              color="bg-sky-50"
              icon={<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard
              label="Keyword Density"
              value={result.keywordDensity}
              sub="%"
              color="bg-amber-50"
              icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
            />
          </div>

          {/* Main two-column layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* ── Article (2/3) ────────────────────────────────────────── */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50">
                <div>
                  <h4 className="font-bold text-slate-900">Full SEO Article</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Keywords highlighted in yellow</p>
                </div>
                <CopyButton text={result.article} />
              </div>
              <div className="px-8 py-6 max-h-[680px] overflow-y-auto">
                <h1 className="text-2xl font-black text-slate-900 mb-5 leading-tight">
                  {result.title}
                </h1>
                {renderArticle(result.article, allKeywords)}
              </div>
            </div>

            {/* ── Right sidebar (1/3) ──────────────────────────────────── */}
            <div className="space-y-5">

              {/* SEO Score ring + grade */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                <h4 className="font-bold text-slate-800 mb-4 text-left">SEO Analysis</h4>
                <ScoreRing score={result.seoScore} />
                <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Words</p>
                    <p className="text-base font-bold text-slate-800">{result.wordCount.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Read Time</p>
                    <p className="text-base font-bold text-slate-800">{result.readingTime} min</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Keyword Density</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(result.keywordDensity * 33, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-800">{result.keywordDensity}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEO Metadata */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800">SEO Metadata</h4>
                  <CopyButton text={`Title: ${result.seoTitle}\nMeta: ${result.metaDescription}\nSlug: ${result.urlSlug}`} />
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">SEO Title</p>
                    <p className="text-sm font-semibold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">
                      {result.seoTitle}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">{result.seoTitle.length} / 60 chars</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Meta Description</p>
                    <p className="text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg leading-relaxed">
                      {result.metaDescription}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">{result.metaDescription.length} / 160 chars</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">URL Slug</p>
                    <p className="text-sm font-mono text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg break-all">
                      /{result.urlSlug}
                    </p>
                  </div>
                </div>
              </div>

              {/* Keyword Strategy */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h4 className="font-bold text-slate-800 mb-4">Keyword Strategy</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Primary Keyword</p>
                    <Badge color="bg-indigo-600 text-white">{result.primaryKeyword}</Badge>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Secondary Keywords</p>
                    <div>
                      {result.secondaryKeywords.map(kw => (
                        <Badge key={kw} color="bg-indigo-50 text-indigo-700">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">LSI Keywords</p>
                    <div>
                      {result.lsiKeywords.map(kw => (
                        <Badge key={kw} color="bg-slate-100 text-slate-600">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Ranking Explanation (full width) ─────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Why This Article Can Rank on Google</h4>
                <p className="text-xs text-slate-500">AI-powered ranking analysis</p>
              </div>
            </div>
            <div className="px-8 py-6">
              <p className="text-slate-700 leading-relaxed text-[15px]">{result.rankingExplanation}</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default SeoArticleGenerator;