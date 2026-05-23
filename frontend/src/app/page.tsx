"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Building2, ChevronRight, Search } from "lucide-react";

const clients = [
  { id: "acme", name: "Acme Corp", gstin: "27ABCDE1234F1Z5", industry: "Manufacturing", location: "Mumbai" },
  { id: "rb-systems", name: "RB Systems", gstin: "27RBSYS1234P1Z1", industry: "Logistics", location: "Pune" },
];

export default function CompanySelection() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (isLoggedIn !== "true") {
        router.replace("/login");
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-block p-3 bg-blue-600 rounded-xl mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Arista AI — SV-CIE</h1>
          <p className="text-slate-500 font-medium">Select a client to begin the audit workspace</p>
        </div>

        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search clients..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => {
                localStorage.setItem("engagementId", client.id === "acme" ? "1" : "12");
                router.push("/reports");
              }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-xl hover:shadow-blue-50 transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-lg font-black text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  {client.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{client.name}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{client.gstin}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-2">
                    {client.industry} • {client.location}
                  </p>
                </div>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
          ))}

          <div className="border-2 border-dashed border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 mb-2">
              +
            </div>
            <p className="text-xs font-bold text-slate-400 group-hover:text-blue-600">Onboard New Client</p>
          </div>
        </div>

        <div className="pt-12 text-center">
          <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em]">
            Licensed to Arista Audit Partners LLP
          </p>
        </div>
      </div>
    </div>
  );
}
