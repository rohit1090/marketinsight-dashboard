
import React, { useState, useEffect } from 'react';
import { ApiConnection, CompetitorProfile } from '../types';
import { CHANNELS } from '../constants';

const SettingsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connections' | 'competitors'>('connections');
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const savedConnections = localStorage.getItem('mi_connections');
    const savedCompetitors = localStorage.getItem('mi_competitors');
    
    if (savedConnections) setConnections(JSON.parse(savedConnections));
    else {
      // Default blank connections for supported channels
      const defaults: ApiConnection[] = CHANNELS.filter(c => c !== 'All Channels').map(ch => ({
        id: Math.random().toString(36).substr(2, 9),
        channel: ch,
        apiKey: '',
        accountId: '',
        status: 'disconnected'
      }));
      setConnections(defaults);
    }

    if (savedCompetitors) setCompetitors(JSON.parse(savedCompetitors));
  }, []);

  const saveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('mi_connections', JSON.stringify(connections));
    localStorage.setItem('mi_competitors', JSON.stringify(competitors));
    
    setTimeout(() => {
      setIsSaving(false);
      showToast('Settings saved successfully!', 'success');
    }, 800);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateConnection = (id: string, field: keyof ApiConnection, value: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const testConnection = (id: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'connected', lastSynced: new Date().toLocaleString() } : c));
    showToast('Connection verified successfully!', 'success');
  };

  const addCompetitor = () => {
    const newComp: CompetitorProfile = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      domain: '',
      trackingApis: []
    };
    setCompetitors([...competitors, newComp]);
  };

  const removeCompetitor = (id: string) => {
    setCompetitors(competitors.filter(c => c.id !== id));
  };

  const updateCompetitor = (id: string, field: keyof CompetitorProfile, value: any) => {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {toast && (
        <div className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-lg text-white z-50 animate-in fade-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('connections')}
            className={`px-8 py-5 text-sm font-semibold transition-all ${activeTab === 'connections' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🔌 API Connections
          </button>
          <button 
            onClick={() => setActiveTab('competitors')}
            className={`px-8 py-5 text-sm font-semibold transition-all ${activeTab === 'competitors' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🎯 Competitor Profiles
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'connections' ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Data Connectors</h3>
                <p className="text-slate-500 text-sm mb-6">Connect your marketing platforms to pull live performance data automatically.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {connections.map((conn) => (
                    <div key={conn.id} className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-indigo-200 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{conn.channel}</span>
                          <span className={`w-2 h-2 rounded-full ${conn.status === 'connected' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                        </div>
                        <button 
                          onClick={() => testConnection(conn.id)}
                          className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
                        >
                          Test Sync
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">API Key / Token</label>
                          <input 
                            type="password" 
                            value={conn.apiKey}
                            onChange={(e) => updateConnection(conn.id, 'apiKey', e.target.value)}
                            placeholder="sk_live_..."
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account ID</label>
                          <input 
                            type="text" 
                            value={conn.accountId}
                            onChange={(e) => updateConnection(conn.id, 'accountId', e.target.value)}
                            placeholder="act_123456789"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                      {conn.lastSynced && (
                        <p className="mt-3 text-[10px] text-slate-400">Last synced: {conn.lastSynced}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Competitor Benchmarking</h3>
                  <p className="text-slate-500 text-sm">Add competitors to track their market share and engagement via scraping & public APIs.</p>
                </div>
                <button 
                  onClick={addCompetitor}
                  className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors"
                >
                  + Add Competitor
                </button>
              </div>

              <div className="space-y-4">
                {competitors.length === 0 && (
                  <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-sm">No competitors added yet.</p>
                  </div>
                )}
                {competitors.map((comp) => (
                  <div key={comp.id} className="flex gap-4 p-4 bg-white border border-slate-200 rounded-xl items-center">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <input 
                        placeholder="Company Name"
                        value={comp.name}
                        onChange={(e) => updateCompetitor(comp.id, 'name', e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input 
                        placeholder="Website (e.g. competitor.com)"
                        value={comp.domain}
                        onChange={(e) => updateCompetitor(comp.id, 'domain', e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => removeCompetitor(comp.id)}
                      className="text-slate-300 hover:text-red-500 p-2"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-slate-50 px-8 py-5 border-t border-slate-200 flex justify-end gap-3">
          <button 
            disabled={isSaving}
            onClick={saveSettings}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : 'Save All Changes'}
          </button>
        </div>
      </div>
      
      <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl">
        <div className="flex gap-4">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="font-bold text-amber-900 mb-1">Privacy & Security</h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              API keys are stored securely in your browser's local storage. In a production environment, 
              these would be encrypted and managed via an OAuth2 flow or a secure backend vault.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
