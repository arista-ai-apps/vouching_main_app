"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { AlertCircle, FileText, CheckCircle, MessageSquare, ChevronRight } from 'lucide-react';

const exceptions: any[] = [];

export default function ExceptionsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Exceptions</h1>
            <p className="text-slate-500">Review discrepancies found during the reconciliation process.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {exceptions.map((ex) => (
            <div key={ex.id} className="audit-card flex items-start justify-between border-l-4 border-l-rose-500 hover:bg-slate-50 transition-colors cursor-pointer group">
              <div className="flex gap-4">
                <div className={`p-2 rounded mt-1 ${ex.severity === 'Critical' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                   <AlertCircle size={20} />
                </div>
                <div>
                   <div className="flex items-center gap-2">
                     <h3 className="font-bold text-slate-900">{ex.type}</h3>
                     <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                       ex.severity === 'Critical' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                     }`}>{ex.severity}</span>
                   </div>
                   <p className="text-sm text-slate-600 mt-1 italic">"{ex.desc}"</p>
                   <div className="mt-3 flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><FileText size={12} /> {ex.vendor}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={12} /> 2 Comments</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                 <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      ex.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ex.status}
                    </span>
                 </div>
                 <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
