"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Filter, Calendar } from 'lucide-react';

const engagements = [
  { id: 1, client: 'Acme Corp', period: 'March 2026', type: 'Purchase Register Vouching', status: 'In Progress', files: 45 },
  { id: 2, client: 'Globex Inc', period: 'Q1 2026', type: 'Statutory Audit', status: 'Review Pending', files: 128 },
  { id: 3, client: 'Soylent Corp', period: 'Feb 2026', type: 'Tax Audit', status: 'Planning', files: 0 },
];

export default function EngagementsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Engagements</h1>
            <p className="text-slate-500">View and manage audit engagements for your clients.</p>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={18} />
            New Engagement
          </button>
        </div>

        <div className="audit-card flex items-center justify-between bg-white px-6">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer font-medium hover:text-blue-600">
               <Filter size={16} />
               All Statuses
             </div>
             <div className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer font-medium hover:text-blue-600">
               <Calendar size={16} />
               This Financial Year
             </div>
          </div>
          <p className="text-xs text-slate-400">Showing {engagements.length} active engagements</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {engagements.map((eng) => (
            <div key={eng.id} className="audit-card flex items-center justify-between hover:border-blue-200 transition-all cursor-pointer">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center border text-slate-400">
                   <Calendar size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{eng.client}</h3>
                  <p className="text-xs text-slate-500">{eng.type} — {eng.period}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-12">
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-tight">Vouchers</p>
                  <p className="text-sm font-bold text-slate-700">{eng.files}</p>
                </div>
                <div className="w-32">
                  <span className={`block text-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    eng.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                    eng.status === 'Review Pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {eng.status}
                  </span>
                </div>
                <button className="text-sm font-bold text-blue-600 hover:text-blue-700">Open Workspace</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
