
import React from 'react';
import { MarketingMetric } from '../types';

interface StatCardProps {
  metric: MarketingMetric;
}

const StatCard: React.FC<StatCardProps> = ({ metric }) => {
  const formatValue = (val: number, format: MarketingMetric['format']) => {
    if (format === 'currency') return `$${val.toLocaleString()}`;
    if (format === 'percentage') return `${val}%`;
    return val.toLocaleString();
  };

  const isPositive = metric.change >= 0;
  const trendColor = metric.trend === 'up' 
    ? (isPositive ? 'text-green-600' : 'text-red-600')
    : (!isPositive ? 'text-green-600' : 'text-red-600');

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{metric.label}</h3>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full bg-opacity-10 ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isPositive ? '+' : ''}{metric.change}%
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-slate-900">
          {formatValue(metric.value, metric.format)}
        </p>
      </div>
    </div>
  );
};

export default StatCard;
