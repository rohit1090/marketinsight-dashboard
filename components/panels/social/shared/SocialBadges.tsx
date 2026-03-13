import React from 'react';

// ── GradeBadge ────────────────────────────────────────────────────────────────

interface GradeBadgeProps {
  grade: string;
  color: string;
}

export function GradeBadge({ grade, color }: GradeBadgeProps) {
  return (
    <div
      className="rounded-xl px-4 py-3 min-w-[72px] text-center"
      style={{
        background:  color + '18',
        border:      `2px solid ${color}`,
      }}
    >
      <p className="font-black text-2xl leading-none" style={{ color }}>{grade}</p>
      <p className="text-xs font-semibold mt-1"       style={{ color }}>Grade</p>
    </div>
  );
}

// ── RankBadge ─────────────────────────────────────────────────────────────────

interface RankBadgeProps {
  value: string;
  label: string;
  key?: React.Key;
}

export function RankBadge({ value, label }: RankBadgeProps) {
  return (
    <div className="bg-white rounded-xl px-4 py-3 min-w-[80px] text-center border border-gray-200 shadow-sm">
      <p className="font-black text-lg text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon:  string;
  label: string;
  value: string;
  sub?:  string;
  color: 'green' | 'blue' | 'amber' | 'purple' | 'pink';
}

const COLOR_MAP: Record<StatCardProps['color'], {
  bg: string; border: string; iconBg: string; iconText: string; value: string;
}> = {
  green:  { bg: 'bg-emerald-50', border: 'border-emerald-400', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', value: 'text-emerald-700' },
  blue:   { bg: 'bg-blue-50',    border: 'border-blue-400',    iconBg: 'bg-blue-100',    iconText: 'text-blue-600',    value: 'text-blue-700'    },
  amber:  { bg: 'bg-amber-50',   border: 'border-amber-400',   iconBg: 'bg-amber-100',   iconText: 'text-amber-600',   value: 'text-amber-700'   },
  purple: { bg: 'bg-violet-50',  border: 'border-violet-400',  iconBg: 'bg-violet-100',  iconText: 'text-violet-600',  value: 'text-violet-700'  },
  pink:   { bg: 'bg-pink-50',    border: 'border-pink-400',    iconBg: 'bg-pink-100',    iconText: 'text-pink-600',    value: 'text-pink-700'    },
};

export function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className={`rounded-2xl p-4 border-l-4 ${c.border} ${c.bg} shadow-sm flex items-start gap-3`}>
      <div className={`${c.iconBg} ${c.iconText} rounded-xl p-2.5 text-lg flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`text-xl font-black ${c.value} truncate`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
