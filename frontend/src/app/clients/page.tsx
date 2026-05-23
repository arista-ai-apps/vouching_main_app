"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Search, Building2 } from 'lucide-react';

const clients = [
  { id: 1, name: 'Acme Corp', pan: 'ABCDE1234F', gstin: '27ABCDE1234F1Z5', address: 'Mumbai, Maharashtra' },
  { id: 2, name: 'Globex Inc', pan: 'FGHIJ5678K', gstin: '24FGHIJ5678K1Z2', address: 'Ahmedabad, Gujarat' },
  { id: 3, name: 'Soylent Corp', pan: 'KLMNO9012P', gstin: '07KLMNO9012P1Z9', address: 'New Delhi, Delhi' },
];

export default function ClientsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="text-slate-500">Manage your audit clients and their profiles.</p>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={18} />
            Add New Client
          </button>
        </div>

        <div className="audit-card flex items-center gap-3 bg-white">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by client name, PAN or GSTIN..." 
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div key={client.id} className="audit-card hover:border-blue-300 transition-all cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className="bg-slate-50 p-3 rounded-lg group-hover:bg-blue-50 transition-colors">
                  <Building2 size={24} className="text-slate-600 group-hover:text-blue-600" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">ACTIVE</span>
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-slate-900 text-lg">{client.name}</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">PAN:</span> {client.pan}</p>
                  <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">GSTIN:</span> {client.gstin}</p>
                </div>
                <p className="mt-4 text-xs text-slate-400 flex items-center gap-1 italic">
                  Last audit: Mar 2026
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
