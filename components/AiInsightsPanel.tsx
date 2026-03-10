
import React, { useState, useEffect } from 'react';
import { getMarketingInsights } from '../services/geminiService';
import { DashboardData } from '../types';

interface AiInsightsPanelProps {
  data: DashboardData;
}

const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({ data }) => {
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getMarketingInsights(data);
        setInsights(result || '');
      } catch (err) {
        setError('Failed to load AI insights. Check your API key.');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [data]);

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('###')) return <h3 key={i} className="text-xl font-bold text-slate-800 mt-6 mb-3">{line.replace('###', '')}</h3>;
      if (line.startsWith('##')) return <h2 key={i} className="text-2xl font-bold text-slate-900 mt-8 mb-4">{line.replace('##', '')}</h2>;
      if (line.startsWith('*') || line.startsWith('-')) return <li key={i} className="ml-5 text-slate-600 mb-2 list-disc">{line.substring(1)}</li>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-slate-600 leading-relaxed mb-4">{line}</p>;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-8 py-10 text-white">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">✨</span>
          <h2 className="text-2xl font-bold tracking-tight">AI Strategic Insights</h2>
        </div>
        <p className="text-indigo-100 max-w-2xl text-lg">
          Powered by Gemini 3. Our AI model has analyzed your marketing data, competitors, and trends to provide actionable strategic advice.
        </p>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">Gemini is analyzing millions of data points...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-6 rounded-lg border border-red-100 flex items-center gap-3">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        ) : (
          <article className="prose prose-slate max-w-none">
            {renderMarkdown(insights)}
          </article>
        )}
      </div>
    </div>
  );
};

export default AiInsightsPanel;
