
import React, { useState } from 'react';
import { suggestSocialContent } from '../services/geminiService';
import YoutubeAnalyzer from './YoutubeAnalyzer';
import YouTubeChannelAnalyzer from './panels/social/youtube/YouTubeChannelAnalyzer';

type SocialTab   = 'overview' | 'youtube';
type YouTubeMode = 'channel' | 'video';

const SocialHubPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SocialTab>(
    () => (localStorage.getItem('mi_social_tab') as SocialTab | null) ?? 'overview'
  );
  const [ytMode, setYtMode] = useState<YouTubeMode>('channel');

  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTabChange = (tab: SocialTab) => {
    setActiveTab(tab);
    localStorage.setItem('mi_social_tab', tab);
  };

  const handleSuggest = async () => {
    if (!topic) return;
    setLoading(true);
    const result = await suggestSocialContent(topic, 'LinkedIn and Instagram');
    setSuggestions(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Tab bar */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => handleTabChange('overview')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => handleTabChange('youtube')}
          className={`flex items-center gap-1.5 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'youtube' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          ▶️ YouTube
        </button>
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-slate-900">AI Content Composer</h3>
                <div className="flex gap-2">
                  {['Twitter', 'Instagram', 'LinkedIn', 'Facebook'].map(p => (
                    <span key={p} className="text-xs px-2 py-1 bg-slate-100 rounded-md text-slate-500 font-medium">{p}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Post Topic / Campaign</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Launching our new summer collection..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleSuggest}
                      disabled={loading}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {loading ? 'Thinking...' : 'Generate Ideas'}
                    </button>
                  </div>
                </div>

                {suggestions && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 whitespace-pre-wrap text-slate-700 leading-relaxed italic">
                    {suggestions}
                  </div>
                )}

                <div className="border-t border-slate-100 pt-6">
                  <h4 className="font-bold text-slate-800 mb-4">Upcoming Schedule</h4>
                  <div className="space-y-4">
                    {[
                      { channel: 'Instagram', time: 'Today, 4:00 PM', title: 'Feature Spotlight: Analytics' },
                      { channel: 'LinkedIn', time: 'Tomorrow, 9:30 AM', title: 'Why SEO matters in 2025' },
                    ].map((post, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-shadow cursor-pointer">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl">
                          {post.channel === 'Instagram' ? '📸' : '💼'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{post.title}</p>
                          <p className="text-xs text-slate-500">{post.time} · {post.channel}</p>
                        </div>
                        <button className="text-slate-400 hover:text-indigo-600 font-bold text-xs uppercase">Edit</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200">
              <h4 className="font-bold text-slate-800 mb-4">Unified Social Inbox</h4>
              <div className="space-y-4">
                {[
                  { user: '@alex_m', text: 'Love the new interface!', platform: 'IG' },
                  { user: 'Sarah Jenkins', text: 'When is the API documentation coming out?', platform: 'LI' },
                  { user: 'MarketPro', text: 'Just shared your latest blog post.', platform: 'TW' },
                ].map((msg, i) => (
                  <div key={i} className="flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{msg.user} <span className="font-normal text-slate-400 ml-1">· {msg.platform}</span></p>
                      <p className="text-xs text-slate-500 line-clamp-1">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 text-xs font-bold text-indigo-600 hover:underline">View All Conversations</button>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white">
              <h4 className="font-bold mb-4">Channel Strength</h4>
              <div className="space-y-4">
                {[
                  { name: 'Instagram', score: 85 },
                  { name: 'LinkedIn', score: 92 },
                  { name: 'Twitter', score: 45 },
                ].map(ch => (
                  <div key={ch.name}>
                    <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                      <span>{ch.name}</span><span>{ch.score}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/20 rounded-full">
                      <div className="h-full bg-white rounded-full" style={{ width: `${ch.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── YouTube tab ───────────────────────────────────────────────────── */}
      {activeTab === 'youtube' && (
        <div className="space-y-4">
          {/* Pill switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setYtMode('channel')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                ytMode === 'channel'
                  ? 'text-white shadow-md'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
              style={ytMode === 'channel' ? { background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' } : {}}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
              </svg>
              Channel Analyzer
            </button>
            <button
              onClick={() => setYtMode('video')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                ytMode === 'video'
                  ? 'text-white shadow-md'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-red-300 hover:text-red-600'
              }`}
              style={ytMode === 'video' ? { background: 'linear-gradient(135deg, #EF4444, #DC2626)' } : {}}
            >
              ▶ Video Analyzer
            </button>
          </div>

          {ytMode === 'channel' && <YouTubeChannelAnalyzer />}
          {ytMode === 'video'   && <YoutubeAnalyzer />}
        </div>
      )}


    </div>
  );
};

export default SocialHubPanel;
