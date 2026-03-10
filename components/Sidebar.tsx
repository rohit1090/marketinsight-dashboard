
import React from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const menuItems = [
    { id: ViewMode.OVERVIEW, label: 'Overview', icon: '📊' },
    { id: ViewMode.SEO_SUITE, label: 'SEO Suite', icon: '🔍' },
    { id: ViewMode.SOCIAL_HUB, label: 'Social Hub', icon: '📱' },
    { id: ViewMode.WORKFLOWS, label: 'Workflows', icon: '📋' },
    { id: ViewMode.COMPETITORS, label: 'Competitors', icon: '🎯' },
    { id: ViewMode.MARKET_INTEL, label: 'Market Intel', icon: '🌐' },
    { id: ViewMode.AI_STRATEGY, label: 'AI Strategy', icon: '✨' },
    { id: ViewMode.SETTINGS, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200">
            M
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">MarketInsight</span>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                currentView === item.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Plan Status</p>
          <p className="text-sm font-bold text-slate-800 mb-3">Enterprise Pro</p>
          <div className="w-full h-1.5 bg-slate-200 rounded-full mb-2">
            <div className="w-4/5 h-full bg-indigo-500 rounded-full"></div>
          </div>
          <p className="text-[10px] text-slate-500">8.2M / 10M API Calls</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
