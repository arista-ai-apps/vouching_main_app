"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Inbox, 
  FileText,
  Building2,
  Settings,
  LogOut,
  CloudUpload,
  Receipt,
  TrendingUp
} from 'lucide-react';

const menuItems = [
  { name: 'Voucher Inbox', icon: Inbox, path: '/vouching' },
  { name: 'Bill of Sale Inbox', icon: Receipt, path: '/bill-of-sale' },
  { name: 'Registry Uploads', icon: CloudUpload, path: '/uploads' },
  { name: 'Verification Report', icon: FileText, path: '/reports' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [companyContext, setCompanyContext] = useState({ name: 'Acme Corporation', gstin: '27ABCDE1234F1Z5' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
       const eid = localStorage.getItem('engagementId');
       if (eid === '12') {
         setCompanyContext({ name: 'RB systems', gstin: '27RBSYS1234P1Z1' });
       } else {
         setCompanyContext({ name: 'Acme Corporation', gstin: '27ABCDE1234F1Z5' });
       }
    }
  }, []);

  return (
    <div className="w-64 bg-[#0f172a] text-slate-300 flex flex-col h-full border-r border-slate-800 shadow-2xl">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-blue-900/50">
          <Building2 size={20} />
        </div>
        <span className="font-black text-white text-lg tracking-tighter">ARISTA AI</span>
      </div>

      <div className="px-4 py-2">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Company Context</p>
          <p className="text-sm font-bold text-white truncate">{companyContext.name}</p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{companyContext.gstin}</p>
        </div>
      </div>

      <nav className="flex-1 mt-6 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 group ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 translate-x-1'
                  : 'hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <item.icon size={18} className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors cursor-pointer">
          <Settings size={14} />
          System Settings
        </div>
        <Link 
          href="/" 
          onClick={() => localStorage.removeItem('engagementId')}
          className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          Switch Company
        </Link>
      </div>
    </div>
  );
}
