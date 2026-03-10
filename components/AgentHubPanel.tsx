
import React, { useState, useEffect, useRef } from 'react';
import { runAgenticReasoning } from '../services/geminiService';
import { MOCK_DASHBOARD_DATA } from '../constants';
import { AgentLog, AgentIntervention } from '../types';

const INITIAL_LOGS: AgentLog[] = [
  { id: '1', timestamp: '10:00:01', type: 'analysis', message: 'Initialized global market scan...' },
  { id: '2', timestamp: '10:00:05', type: 'success', message: 'Neural link established with Google Ads API.' },
  { id: '3', timestamp: '10:05:12', type: 'alert', message: 'Detected 14% ROAS volatility in Facebook campaign "Summer Alpha".' },
];

const INITIAL_INTERVENTIONS: AgentIntervention[] = [
  { id: 'i1', title: 'Creative Swap', description: 'Replace low-performing video in Facebook Ads with static carousel based on current sentiment.', impact: 'high', channel: 'Facebook', status: 'pending' },
  { id: 'i2', title: 'Bid Adjustment', description: 'Increase Google Search bids for "marketing automation" by 12% to capture rising evening intent.', impact: 'medium', channel: 'Google', status: 'pending' },
];

const AgentHubPanel: React.FC = () => {
  const [logs, setLogs] = useState<AgentLog[]>(INITIAL_LOGS);
  const [interventions, setInterventions] = useState<AgentIntervention[]>(INITIAL_INTERVENTIONS);
  const [isThinking, setIsThinking] = useState(false);
  const [strategy, setStrategy] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCommand = async () => {
    setIsThinking(true);
    setLogs(prev => [...prev, { id: Date.now().toString(), timestamp: new Date().toLocaleTimeString(), type: 'analysis', message: 'Running Deep Reasoning for current marketing goal...' }]);
    
    const result = await runAgenticReasoning(MOCK_DASHBOARD_DATA, "Optimize for 20% ROAS increase across all channels while maintaining spend.");
    setStrategy(result);
    setIsThinking(false);
    
    setLogs(prev => [...prev, { id: Date.now().toString(), timestamp: new Date().toLocaleTimeString(), type: 'success', message: 'Strategic roadmap generated.' }]);
  };

  const approveIntervention = (id: string) => {
    setInterventions(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'executing' } : inv));
    setLogs(prev => [...prev, { id: Date.now().toString(), timestamp: new Date().toLocaleTimeString(), type: 'action', message: `Executing intervention ${id}... API request dispatched.` }]);
    
    setTimeout(() => {
      setInterventions(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'completed' } : inv));
      setLogs(prev => [...prev, { id: Date.now().toString(), timestamp: new Date().toLocaleTimeString(), type: 'success', message: `Intervention ${id} applied successfully.` }]);
    }, 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[700px] animate-in fade-in duration-700">
      {/* Central Command & Strategy */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4">
             <div className={`w-3 h-3 rounded-full ${isThinking ? 'bg-indigo-500 animate-ping' : 'bg-slate-700'}`}></div>
          </div>
          
          <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
             <span className="text-3xl">🧠</span> Strategic Reasoning Core
          </h2>

          <div className="bg-black/50 border border-slate-800 rounded-2xl p-6 min-h-[300px]">
            {isThinking ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-indigo-400 font-black animate-pulse uppercase tracking-widest text-xs">Gemini is Thinking...</p>
              </div>
            ) : strategy ? (
              <div className="prose prose-invert max-w-none text-slate-300">
                {strategy.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-500">
                <p className="text-center italic mb-4">Agent is idle. Initiate command to start autonomous analysis.</p>
                <button 
                  onClick={handleCommand}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                >
                  🚀 Initialise Strategy Scan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Proactive Interventions */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Pending Interventions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interventions.map((inv) => (
              <div key={inv.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${inv.impact === 'high' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">{inv.channel}</span>
                  <span className={`text-[10px] font-black uppercase ${inv.impact === 'high' ? 'text-red-500' : 'text-amber-500'}`}>Impact: {inv.impact}</span>
                </div>
                <h4 className="font-bold text-slate-900 mb-2">{inv.title}</h4>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">{inv.description}</p>
                
                <button 
                  onClick={() => approveIntervention(inv.id)}
                  disabled={inv.status !== 'pending'}
                  className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    inv.status === 'pending' 
                      ? 'bg-slate-900 text-white hover:bg-indigo-600' 
                      : inv.status === 'executing'
                      ? 'bg-indigo-50 text-indigo-500'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {inv.status === 'pending' ? 'Approve Action' : inv.status === 'executing' ? 'Executing...' : 'Completed'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Rail - Live Log Stream */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 flex flex-col overflow-hidden h-[750px] shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-black/30">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Agent Thought Stream
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">Live v4.0.2</span>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-4 scroll-smooth">
          {logs.map((log) => (
            <div key={log.id} className="animate-in slide-in-from-left-2 duration-300">
              <span className="text-slate-600 mr-2">[{log.timestamp}]</span>
              <span className={`font-bold mr-2 uppercase ${
                log.type === 'alert' ? 'text-red-400' : 
                log.type === 'success' ? 'text-emerald-400' : 
                log.type === 'action' ? 'text-indigo-400' : 'text-blue-400'
              }`}>
                {log.type}:
              </span>
              <span className="text-slate-300 leading-relaxed">{log.message}</span>
            </div>
          ))}
          {isThinking && (
            <div className="animate-pulse flex items-center gap-1 text-indigo-400">
              <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
              <span className="w-1 h-1 bg-indigo-400 rounded-full delay-75"></span>
              <span className="w-1 h-1 bg-indigo-400 rounded-full delay-150"></span>
              <span className="ml-2 font-bold uppercase tracking-tighter">Processing Neural Patterns...</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-black/40 border-t border-slate-800">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Override Agent Command..." 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">⌘K</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentHubPanel;
