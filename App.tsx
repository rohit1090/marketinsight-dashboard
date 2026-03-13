
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StatCard from './components/StatCard';
import { ChannelSpendChart, PerformanceTrendChart } from './components/DashboardCharts';
import CompetitorInsights from './components/CompetitorInsights';
import AiInsightsPanel from './components/AiInsightsPanel';
import MarketIntelPanel from './components/MarketIntelPanel';
import SettingsPanel from './components/SettingsPanel';
import SeoSuitePanel from './components/SeoSuitePanel';
import SocialHubPanel from './components/SocialHubPanel';
import WorkflowPanel from './components/WorkflowPanel';
import AgentHubPanel from './components/AgentHubPanel';
import ContentWriterPanel from './components/ContentWriterPanel';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import ProfileModal from './components/ProfileModal';
import { ViewMode, DateRange } from './types';
import { MOCK_DASHBOARD_DATA, CHANNELS } from './constants';
import DateRangePicker from './components/DateRangePicker';
import { format, subDays } from 'date-fns';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

type AppRoute = 'LANDING' | 'LOGIN' | 'SIGNUP' | 'DASHBOARD';

const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>('LANDING');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('mi_active_view');
    return (saved && Object.values(ViewMode).includes(saved as ViewMode))
      ? (saved as ViewMode)
      : ViewMode.OVERVIEW;
  });
  const [selectedChannel, setSelectedChannel] = useState<string>('All Channels');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    preset: 'Last 30 Days'
  });

  useEffect(() => {
    console.log('🔐 Auth: Setting up auth state listener...');

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('✅ Auth: User logged in -', user.email);
        setIsAuthenticated(true);
        setRoute('DASHBOARD');
      } else {
        console.log('❌ Auth: User not logged in');
        setIsAuthenticated(false);
        // Only redirect to login if on dashboard
        setRoute((prevRoute) => {
          if (prevRoute === 'DASHBOARD') {
            return 'LOGIN';
          }
          return prevRoute;
        });
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Protect dashboard route - redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && route === 'DASHBOARD') {
      setRoute('LOGIN');
    }
  }, [isAuthenticated, route, isLoading]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
      setRoute('LANDING');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold animate-pulse">Loading MarketInsight...</p>
        </div>
      </div>
    );
  }

  if (route === 'LANDING') {
    return (
      <LandingPage 
        onLogin={() => setRoute('LOGIN')} 
        onStartTrial={() => setRoute('SIGNUP')} 
      />
    );
  }

  if (route === 'LOGIN') {
    return (
      <LoginPage 
        onLoginSuccess={() => {}} 
        onBackToLanding={() => setRoute('LANDING')} 
        onGoToSignup={() => setRoute('SIGNUP')}
      />
    );
  }

  if (route === 'SIGNUP') {
    return (
      <SignupPage 
        onSignupSuccess={() => {}} 
        onBackToLogin={() => setRoute('LOGIN')} 
        onBackToLanding={() => setRoute('LANDING')} 
      />
    );
  }

  // Dashboard Protection
  if (!isAuthenticated && route === 'DASHBOARD') {
    return null;
  }

  const renderContent = () => {
    switch (currentView) {
      case ViewMode.OVERVIEW:
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {MOCK_DASHBOARD_DATA.metrics.map((metric) => (
                <StatCard key={metric.label} metric={metric} />
              ))}
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ChannelSpendChart channels={MOCK_DASHBOARD_DATA.channelPerformance} />
              <PerformanceTrendChart historical={MOCK_DASHBOARD_DATA.historicalData} />
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Channel Performance Detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Channel</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Spend</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Impressions</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">CTR</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_DASHBOARD_DATA.channelPerformance.map((item) => (
                      <tr key={item.channel} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-5 font-bold text-slate-900">{item.channel}</td>
                        <td className="px-6 py-5 text-slate-600 font-medium">${item.spend.toLocaleString()}</td>
                        <td className="px-6 py-5 text-slate-600">{(item.impressions / 1000).toFixed(0)}k</td>
                        <td className="px-6 py-5 text-slate-600">{((item.clicks / item.impressions) * 100).toFixed(2)}%</td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${item.roas >= 4 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                            {item.roas}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case ViewMode.SEO_SUITE:
        return <SeoSuitePanel dateRange={dateRange} />;
      case ViewMode.CONTENT_WRITER:
        return <ContentWriterPanel />;
      case ViewMode.SOCIAL_HUB:
        return <SocialHubPanel />;
      case ViewMode.WORKFLOWS:
        return <WorkflowPanel />;
      case ViewMode.COMPETITORS:
        return <CompetitorInsights competitors={MOCK_DASHBOARD_DATA.competitors} />;
      case ViewMode.MARKET_INTEL:
        return <MarketIntelPanel channel={selectedChannel === 'All Channels' ? 'Digital Marketing' : selectedChannel} />;
      case ViewMode.AI_STRATEGY:
        return <AgentHubPanel />;
      case ViewMode.SETTINGS:
        return <SettingsPanel />;
      default:
        return <div className="text-center py-20 text-slate-400 font-medium">Coming Soon...</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      {isProfileOpen && (
        <ProfileModal
          onClose={() => setIsProfileOpen(false)}
          onLogout={() => { setIsProfileOpen(false); handleLogout(); }}
        />
      )}
      <Sidebar
        currentView={currentView}
        onViewChange={(v: ViewMode) => { setCurrentView(v); localStorage.setItem('mi_active_view', v); }}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 overflow-y-auto px-8 pt-8 pb-5 lg:px-12 lg:pt-10 lg:pb-5">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight capitalize">
              {currentView.replace('_', ' ')}
            </h1>
            <p className="text-slate-500 mt-1 font-medium">
              {selectedChannel} • {dateRange.preset === 'Custom' 
                ? `${format(new Date(dateRange.startDate), 'MMM d')} - ${format(new Date(dateRange.endDate), 'MMM d, yyyy')}`
                : dateRange.preset}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <select 
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 block p-2.5 shadow-sm transition-all outline-none"
            >
              {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
            </select>
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 pl-2 pr-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              {auth.currentUser?.photoURL ? (
                <img
                  src={auth.currentUser.photoURL}
                  className="w-7 h-7 rounded-lg object-cover"
                  alt="avatar"
                  onError={e => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    (el.nextSibling as HTMLElement)?.style.setProperty('display', 'flex');
                  }}
                />
              ) : null}
              <div
                className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-black items-center justify-center"
                style={{ display: auth.currentUser?.photoURL ? 'none' : 'flex' }}
              >
                {(auth.currentUser?.displayName || auth.currentUser?.email || 'U')[0].toUpperCase()}
              </div>
              {auth.currentUser?.displayName?.split(' ')[0] || 'Profile'}
            </button>
            <button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center gap-2 whitespace-nowrap"
              onClick={() => alert('Exporting report...')}
            >
              🚀 Export
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
