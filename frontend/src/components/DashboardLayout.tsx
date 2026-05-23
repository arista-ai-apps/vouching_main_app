"use client";

import Sidebar from "@/components/Sidebar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [period, setPeriod] = useState("March 2026");
  const router = useRouter();

  useEffect(() => {
    // Auth guard — runs only on client
    const storedLoginStatus = localStorage.getItem("isLoggedIn");
    if (storedLoginStatus !== "true") {
      router.replace("/login");
      return;
    }
    // Period detection
    const eid = localStorage.getItem("engagementId");
    setPeriod(eid === "12" ? "April 2026" : "March 2026");
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] border-r pr-4 border-slate-200">
              Audit Workspace
            </h2>
            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">
              Engagement: {period}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">User: Admin</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
              AD
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-rose-100"
              title="Logout"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
