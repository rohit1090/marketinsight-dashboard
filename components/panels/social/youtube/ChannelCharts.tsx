import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { YouTubeChannelData, formatNumber } from '../../../../services/socialBladeService';

interface Props {
  data: YouTubeChannelData;
}

type Period = 'Monthly' | 'Weekly';
type SubsMode = 'Gained' | 'Total';

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const month = new Date(Number(y), Number(m) - 1).toLocaleString('en-US', { month: 'short' });
  return `${month} '${y.slice(2)}`;
}

function formatWeek(date: string): string {
  return date.slice(5); // "MM-DD"
}

interface ChartPoint {
  label: string;
  subs: number;
  views: number;
  totalSubs: number;
}

export default function ChannelCharts({ data }: Props) {
  const [period, setPeriod]     = useState<Period>('Monthly');
  const [subsMode, setSubsMode] = useState<SubsMode>('Gained');

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!data.daily.length) return [];

    if (period === 'Monthly') {
      // Group by "YYYY-MM"
      const map = new Map<string, { subs: number; views: number; lastTotal: number }>();
      [...data.daily].reverse().forEach(d => {
        const key = d.date.slice(0, 7);
        const existing = map.get(key) ?? { subs: 0, views: 0, lastTotal: 0 };
        map.set(key, {
          subs:      existing.subs  + d.subsDelta,
          views:     existing.views + d.viewsDelta,
          lastTotal: d.subs,
        });
      });
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({
          label:     formatMonth(month),
          subs:      v.subs,
          views:     v.views,
          totalSubs: v.lastTotal,
        }));
    }

    // Weekly — group by ISO week start (Monday)
    const map = new Map<string, { subs: number; views: number; lastTotal: number }>();
    [...data.daily].reverse().forEach(d => {
      const dt   = new Date(d.date);
      const day  = dt.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
      const mon  = new Date(dt);
      mon.setDate(dt.getDate() + diff);
      const key = mon.toISOString().slice(0, 10);
      const existing = map.get(key) ?? { subs: 0, views: 0, lastTotal: 0 };
      map.set(key, {
        subs:      existing.subs  + d.subsDelta,
        views:     existing.views + d.viewsDelta,
        lastTotal: d.subs,
      });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([date, v]) => ({
        label:     formatWeek(date),
        subs:      v.subs,
        views:     v.views,
        totalSubs: v.lastTotal,
      }));
  }, [data.daily, period]);

  const subsDataKey = subsMode === 'Gained' ? 'subs' : 'totalSubs';

  if (!data.daily.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-gray-400 text-sm">
        No daily data available for charts.
      </div>
    );
  }

  const toggleBtn = (active: boolean) =>
    `text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
    }`;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Detailed Charts</p>
        <div className="flex gap-1">
          {(['Monthly', 'Weekly'] as Period[]).map(t => (
            <button key={t} onClick={() => setPeriod(t)} className={toggleBtn(period === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Chart 1 — Subscribers */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold text-gray-800">
            {period} {subsMode === 'Gained' ? 'Gained' : 'Total'} Subscribers — {data.displayName}
          </h3>
          <div className="flex gap-1">
            {(['Gained', 'Total'] as SubsMode[]).map(m => (
              <button key={m} onClick={() => setSubsMode(m)} className={toggleBtn(subsMode === m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={v => formatNumber(v)}
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              axisLine={false} tickLine={false} width={45}
            />
            <Tooltip
              formatter={(v) => [`+${formatNumber(v as number)}`, 'Subscribers']}
              contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            />
            <Area
              type="monotone" dataKey={subsDataKey}
              stroke="#4F46E5" strokeWidth={2}
              fill="url(#subGrad)" dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — Views */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold text-gray-800">
            {period} Gained Views — {data.displayName}
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={v => formatNumber(v)}
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              axisLine={false} tickLine={false} width={45}
            />
            <Tooltip
              formatter={(v) => [`+${formatNumber(v as number)}`, 'Views']}
              contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            />
            <Area
              type="monotone" dataKey="views"
              stroke="#7C3AED" strokeWidth={2}
              fill="url(#viewGrad)" dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
