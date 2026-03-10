
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CompetitorData } from '../types';

interface CompetitorInsightsProps {
  competitors: CompetitorData[];
}

const CompetitorInsights: React.FC<CompetitorInsightsProps> = ({ competitors }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-96">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Market Share Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={competitors} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fill: '#64748b', fontSize: 12}} />
              <Tooltip 
                cursor={{fill: '#f8fafc'}}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="marketShare" name="Market Share %" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-96">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Engagement & Sentiment Comparison</h3>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart outerRadius="80%" data={competitors}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} hide />
              <Radar name="Engagement Rate (x10)" dataKey="engagementRate" stroke="#ec4899" fill="#ec4899" fillOpacity={0.4} />
              <Radar name="Brand Sentiment" dataKey="sentiment" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Brand</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Market Share</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Est. Monthly Ad Spend</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Engagement Rate</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Sentiment Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {competitors.map((comp) => (
              <tr key={comp.name} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <span className={`font-semibold ${comp.name === 'My Brand' ? 'text-indigo-600' : 'text-slate-800'}`}>
                    {comp.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">{comp.marketShare}%</td>
                <td className="px-6 py-4 text-slate-600">${comp.adSpend.toLocaleString()}</td>
                <td className="px-6 py-4 text-slate-600">{comp.engagementRate}%</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full max-w-[100px]">
                      <div 
                        className={`h-full rounded-full ${comp.sentiment > 80 ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ width: `${comp.sentiment}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-slate-600 font-medium">{comp.sentiment}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CompetitorInsights;
