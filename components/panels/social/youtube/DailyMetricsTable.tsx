import React, { useState } from 'react';
import { YouTubeChannelData, formatNumber } from '../../../../services/socialBladeService';

interface Props {
  data: YouTubeChannelData;
}

function DeltaCell({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-emerald-600 font-bold text-xs">+{formatNumber(delta)}</span>;
  if (delta < 0) return <span className="text-red-500 font-bold text-xs">{formatNumber(delta)}</span>;
  return <span className="text-gray-400 text-xs">--</span>;
}

export default function DailyMetricsTable({ data }: Props) {
  const [range, setRange] = useState<7 | 14 | 30>(14);

  const filtered = data.daily.slice(0, range);

  const totalSubsDelta  = filtered.reduce((s, r) => s + r.subsDelta,  0);
  const totalViewsDelta = filtered.reduce((s, r) => s + r.viewsDelta, 0);
  const avgSubsDelta    = filtered.length > 0 ? Math.round(totalSubsDelta  / filtered.length) : 0;
  const avgViewsDelta   = filtered.length > 0 ? Math.round(totalViewsDelta / filtered.length) : 0;

  const totalEarningsMin = filtered.reduce((s, r) => s + r.estimatedEarningsMin, 0);
  const totalEarningsMax = filtered.reduce((s, r) => s + r.estimatedEarningsMax, 0);
  const avgEarningsMin   = filtered.length > 0 ? totalEarningsMin / filtered.length : 0;
  const avgEarningsMax   = filtered.length > 0 ? totalEarningsMax / filtered.length : 0;

  function fmtEarnings(min: number, max: number) {
    const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`;
    return `${fmt(min)} – ${fmt(max)}`;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-900 text-sm">Daily Channel Metrics</h3>
        <select
          value={range}
          onChange={e => setRange(Number(e.target.value) as 7 | 14 | 30)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-gray-50 outline-none cursor-pointer"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr style={{ background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' }}>
              {['Date', 'Subscribers', '+/- Subs', 'Total Views', '+/- Views', 'Est. Earnings'].map(col => (
                <th key={col} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-white whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.date} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                  {row.date ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-800 font-medium">{formatNumber(row.subs)}</td>
                <td className="px-3 py-2"><DeltaCell delta={row.subsDelta} /></td>
                <td className="px-3 py-2 text-xs text-gray-800 font-medium">{formatNumber(row.views)}</td>
                <td className="px-3 py-2"><DeltaCell delta={row.viewsDelta} /></td>
                <td className="px-3 py-2 text-amber-600 font-semibold text-xs whitespace-nowrap">
                  {fmtEarnings(row.estimatedEarningsMin, row.estimatedEarningsMax)}
                </td>
              </tr>
            ))}

            {/* Daily Average */}
            <tr className="bg-indigo-50 font-semibold border-t border-indigo-100">
              <td className="px-3 py-2 text-xs font-bold text-indigo-700 whitespace-nowrap">Daily Average</td>
              <td className="px-3 py-2 text-xs text-gray-500">—</td>
              <td className="px-3 py-2"><DeltaCell delta={avgSubsDelta} /></td>
              <td className="px-3 py-2 text-xs text-gray-500">—</td>
              <td className="px-3 py-2"><DeltaCell delta={avgViewsDelta} /></td>
              <td className="px-3 py-2 text-amber-600 font-semibold text-xs whitespace-nowrap">
                {fmtEarnings(avgEarningsMin, avgEarningsMax)}
              </td>
            </tr>

            {/* Totals */}
            <tr className="bg-indigo-50 font-semibold border-t border-indigo-100">
              <td className="px-3 py-2 text-xs font-bold text-indigo-700 whitespace-nowrap">Last {range} Days</td>
              <td className="px-3 py-2 text-xs text-gray-500">—</td>
              <td className="px-3 py-2"><DeltaCell delta={totalSubsDelta} /></td>
              <td className="px-3 py-2 text-xs text-gray-500">—</td>
              <td className="px-3 py-2"><DeltaCell delta={totalViewsDelta} /></td>
              <td className="px-3 py-2 text-amber-600 font-semibold text-xs whitespace-nowrap">
                {fmtEarnings(totalEarningsMin, totalEarningsMax)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
