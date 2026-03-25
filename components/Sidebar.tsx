import React, { useState } from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onLogout?: () => void;
}

interface NavItem {
  id: ViewMode;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── Icons (inline SVG, no extra deps) ─────────────────────────────────────────

const Icon = {
  overview: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  seo: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
    </svg>
  ),
  writer: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  social: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586M15 4H7a2 2 0 00-2 2v6a2 2 0 002 2h2l4 4V12a2 2 0 00-2-2H7" />
    </svg>
  ),
  competitors: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  market: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  siteMetrics: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  ai: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  workflows: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  chevron: (open: boolean) => (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

// ── Nav structure ──────────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'SEO Analytics',
    items: [
      { id: ViewMode.SEO_SUITE,       label: 'SEO Suite',       icon: Icon.seo },
      { id: ViewMode.SITE_METRICS,    label: 'Site Metrics',    icon: Icon.siteMetrics },
      { id: ViewMode.CONTENT_WRITER,  label: 'Content Writer',  icon: Icon.writer },
      { id: ViewMode.SOCIAL_HUB,      label: 'Social Hub',      icon: Icon.social },
      { id: ViewMode.MARKET_INTEL,    label: 'Market Intel',    icon: Icon.market },
    ],
  },
  {
    label: 'Strategy',
    items: [
      { id: ViewMode.COMPETITORS,  label: 'Competitors',  icon: Icon.competitors },
      { id: ViewMode.AI_STRATEGY,  label: 'AI Strategy',  icon: Icon.ai },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: ViewMode.WORKFLOWS, label: 'Workflows', icon: Icon.workflows },
    ],
  },
];

// ── Collapsible group ──────────────────────────────────────────────────────────

interface NavGroupSectionProps {
  group: NavGroup;
  currentView: ViewMode;
  onViewChange: (v: ViewMode) => void;
  defaultOpen?: boolean;
}

const NavGroupSection: React.FC<NavGroupSectionProps> = ({
  group,
  currentView,
  onViewChange,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasActive = group.items.some(i => i.id === currentView);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
          hasActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <span>{group.label}</span>
        {Icon.chevron(open)}
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map(item => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 pl-4 pr-3 py-2 text-sm font-medium rounded-lg transition-all ${
                currentView === item.id
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <span className={currentView === item.id ? 'text-indigo-600' : 'text-slate-400'}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main sidebar ───────────────────────────────────────────────────────────────

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onLogout }) => {
  return (
    <aside className="w-56 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 shrink-0">

      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-md shadow-indigo-200">
            M
          </div>
          <span className="text-base font-bold text-slate-800 tracking-tight">MarketInsight</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">

        {/* Overview — standalone top item */}
        <button
          onClick={() => onViewChange(ViewMode.OVERVIEW)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
            currentView === ViewMode.OVERVIEW
              ? 'bg-indigo-50 text-indigo-700 font-semibold'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <span className={currentView === ViewMode.OVERVIEW ? 'text-indigo-600' : 'text-slate-400'}>
            {Icon.overview}
          </span>
          Overview
        </button>

        {/* Grouped sections */}
        {NAV_GROUPS.map(group => (
          <NavGroupSection
            key={group.label}
            group={group}
            currentView={currentView}
            onViewChange={onViewChange}
          />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
        <button
          onClick={() => onViewChange(ViewMode.SETTINGS)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
            currentView === ViewMode.SETTINGS
              ? 'bg-indigo-50 text-indigo-700 font-semibold'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <span className={currentView === ViewMode.SETTINGS ? 'text-indigo-600' : 'text-slate-400'}>
            {Icon.settings}
          </span>
          Settings
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <span className="text-slate-400 group-hover:text-red-500">{Icon.logout}</span>
            Logout
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
