
import React, { useState } from 'react';
import { MarketingTask } from '../types';

const INITIAL_TASKS: MarketingTask[] = [
  { id: '1', title: 'SEO Keyword Research - Q3', status: 'done', priority: 'high', assignee: 'Jane', campaign: 'SEO' },
  { id: '2', title: 'Social Media Asset Design', status: 'progress', priority: 'medium', assignee: 'Alex', campaign: 'Brand' },
  { id: '3', title: 'Weekly Newsletter Copy', status: 'ideation', priority: 'low', assignee: 'Sam', campaign: 'Email' },
  { id: '4', title: 'Competitor Analysis Report', status: 'review', priority: 'high', assignee: 'Jane', campaign: 'Strategy' },
];

const WorkflowPanel: React.FC = () => {
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  const getStatusColor = (status: MarketingTask['status']) => {
    switch(status) {
      case 'ideation': return 'bg-slate-100 text-slate-600';
      case 'progress': return 'bg-blue-100 text-blue-600';
      case 'review': return 'bg-amber-100 text-amber-600';
      case 'done': return 'bg-emerald-100 text-emerald-600';
    }
  };

  const getPriorityColor = (p: MarketingTask['priority']) => {
    switch(p) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-slate-300';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Team Workflow</h2>
          <p className="text-slate-500">Managing tasks for 4 active campaigns</p>
        </div>
        <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition-all">+ Create Task</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(['ideation', 'progress', 'review', 'done'] as const).map((colStatus) => (
          <div key={colStatus} className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{colStatus}</h4>
              <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                {tasks.filter(t => t.status === colStatus).length}
              </span>
            </div>
            
            <div className="space-y-3">
              {tasks.filter(t => t.status === colStatus).map((task) => (
                <div key={task.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-1 h-4 rounded-full ${getPriorityColor(task.priority)}`}></div>
                    <span className="text-[10px] font-bold text-slate-300 group-hover:text-indigo-400">#{task.id}</span>
                  </div>
                  <h5 className="font-bold text-slate-800 text-sm mb-4 leading-snug">{task.title}</h5>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                        {task.assignee[0]}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{task.campaign}</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowPanel;
