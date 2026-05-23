"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Download, FileText, PieChart, TrendingUp, ShieldCheck, CheckCircle, AlertCircle, Loader2, RefreshCw, Building2, Receipt, Users } from 'lucide-react';
import { useState, useEffect } from 'react';

import { API_BASE } from "@/config";

interface InvoiceSummary {
  total: number;
  matched: number;
  not_in_registry: number;
  missing_in_2b_itc: number;
  missing_only_from_pr: number;
  missing_in_2b_and_pr: number;
  failed: number;
  pending: number;
  match_rate: number;
  quality_score: number;
  total_value: number;
  total_matched_value: number;
  vendor_breakdown: { vendor: string; count: number; total: number }[];
}

interface BosSummary {
  total: number;
  extracted: number;
  matched: number;
  not_in_registry: number;
  failed: number;
  pending: number;
  extraction_rate: number;
  total_value: number;
  total_taxable: number;
  total_matched_value: number;
  buyer_breakdown: { buyer: string; count: number; total: number }[];
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="audit-card bg-white text-center">
      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [invSummary, setInvSummary] = useState<InvoiceSummary | null>(null);
  const [bosSummary, setBosSummary] = useState<BosSummary | null>(null);
  const [engagementId, setEngagementId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      try {
        const storedId = localStorage.getItem('engagementId');
        if (storedId) {
          setEngagementId(parseInt(storedId));
          return;
        }

        const resp = await fetch(`${API_BASE}/engagements/`);
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.length > 0) setEngagementId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch engagements:", err);
      }
    };
    init();
  }, []);

  const fetchSummary = async () => {
    if (!engagementId) return;
    setLoading(true);
    try {
      const [invResp, bosResp] = await Promise.all([
        fetch(`${API_BASE}/files/summary/${engagementId}`),
        fetch(`${API_BASE}/bill-of-sale/summary/${engagementId}`),
      ]);
      if (invResp.ok) setInvSummary(await invResp.json());
      if (bosResp.ok) setBosSummary(await bosResp.json());
      setLastUpdated(new Date().toLocaleTimeString('en-IN'));
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (engagementId) fetchSummary();
  }, [engagementId]);

  const scoreColor = !invSummary ? 'text-slate-400' :
    invSummary.quality_score >= 80 ? 'text-emerald-600' :
    invSummary.quality_score >= 50 ? 'text-amber-500' : 'text-rose-600';

  const scoreBg = !invSummary ? 'bg-slate-200' :
    invSummary.quality_score >= 80 ? 'bg-emerald-500' :
    invSummary.quality_score >= 50 ? 'bg-amber-400' : 'bg-rose-500';

  const bosScoreColor = !bosSummary ? 'text-slate-400' :
    bosSummary.extraction_rate >= 80 ? 'text-emerald-600' :
    bosSummary.extraction_rate >= 50 ? 'text-amber-500' : 'text-rose-600';

  const bosScoreBg = !bosSummary ? 'bg-slate-200' :
    bosSummary.extraction_rate >= 80 ? 'bg-emerald-500' :
    bosSummary.extraction_rate >= 50 ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 border-b-4 border-blue-600 inline-block pb-1">Verification Report</h1>
            <p className="text-slate-500 mt-2">Engagement: Acme Corp — March 2026 Audit</p>
            {lastUpdated && (
              <p className="text-[10px] text-slate-400 mt-1 font-mono">Last refreshed: {lastUpdated}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchSummary}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded font-bold text-sm hover:bg-slate-200 transition-all border"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded font-bold text-sm hover:bg-slate-200 transition-all border">
              <Download size={16} />
              Excel Export
            </button>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
              <FileText size={16} />
              Print PDF Report
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-4">
            <Loader2 size={40} className="animate-spin text-blue-500" />
            <p className="font-semibold tracking-wide text-sm">Loading verification data...</p>
          </div>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════ */}
            {/* SECTION 1: PURCHASE VOUCHING (INVOICES)             */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="space-y-1">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-blue-100">
                <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-sm">
                  <FileText size={16} />
                </div>
                <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">Purchase Vouching — Invoice Summary</h2>
              </div>
            </div>

            {invSummary ? (
              <>
                {/* Stat Cards */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total Vouchers', value: invSummary.total.toString(), color: 'text-slate-800' },
                    { label: 'Matched', value: invSummary.matched.toString(), color: 'text-emerald-600' },
                    { label: 'Exceptions', value: invSummary.not_in_registry.toString(), color: 'text-rose-600' },
                    { label: 'Failed / Pending', value: (invSummary.failed + invSummary.pending).toString(), color: 'text-amber-500' },
                  ].map(m => <StatCard key={m.label} {...m} />)}
                </div>

                {/* Value Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="audit-card bg-white">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Total Invoice Value (All)</p>
                    <p className="text-2xl font-black text-slate-800">{fmt(invSummary.total_value)}</p>
                  </div>
                  <div className="audit-card bg-white relative overflow-hidden group">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Total Matched Value</p>
                    <p className="text-2xl font-black text-emerald-600">{fmt(invSummary.total_matched_value)}</p>
                    <div className="mt-2 flex items-center gap-2">
                       <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.round((invSummary.total_matched_value / invSummary.total_value) * 100) || 0}%` }}
                          />
                       </div>
                       <span className="text-xs font-black text-emerald-600">
                          {Math.round((invSummary.total_matched_value / invSummary.total_value) * 100) || 0}%
                       </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 font-bold italic uppercase">
                      of total purchase value verified
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-6">
                    {/* Quality Score */}
                    <div className="audit-card flex items-center gap-8">
                      <div className="relative w-40 h-40 shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle
                            className="text-slate-100"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                          />
                          <circle
                            className={`${scoreColor} transition-all duration-1000 ease-out`}
                            strokeWidth="8"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * invSummary.match_rate) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-4xl font-black ${scoreColor}`}>{invSummary.match_rate}%</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Score</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2 mb-2">
                          <TrendingUp size={16} className="text-blue-500" />
                          Vouching Quality Score
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                          {invSummary.matched} of {invSummary.total} vouchers successfully matched, yielding a confidence score of <strong>{invSummary.match_rate}%</strong>.
                        </p>
                        <div className="mt-6 space-y-2">
                          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span>Audit Standard Threshold</span>
                            <span className="text-emerald-600">95% Target</span>
                          </div>
                          <div className="relative h-2 bg-slate-100 rounded-full">
                            <div className={`h-full ${scoreBg} rounded-full`} style={{ width: `${invSummary.match_rate}%` }} />
                            <div className="absolute h-4 w-0.5 bg-slate-800 -top-1 left-[95%]" title="95% Global Standard" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vendor Breakdown */}
                    <div className="audit-card">
                      <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2 mb-4">
                        <Building2 size={16} className="text-blue-500" />
                        Vendor Breakdown (Top {invSummary.vendor_breakdown.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left text-[10px] uppercase font-black text-slate-400 tracking-widest pb-2">Vendor</th>
                              <th className="text-right text-[10px] uppercase font-black text-slate-400 tracking-widest pb-2">Invoices</th>
                              <th className="text-right text-[10px] uppercase font-black text-slate-400 tracking-widest pb-2">Total Value</th>
                              <th className="text-right text-[10px] uppercase font-black text-slate-400 tracking-widest pb-2">Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invSummary.vendor_breakdown.map((v, i) => {
                              const share = invSummary.total_value > 0 ? Math.round((v.total / invSummary.total_value) * 100) : 0;
                              return (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                  <td className="py-2 font-semibold text-slate-700">{v.vendor}</td>
                                  <td className="py-2 text-right text-slate-500 font-mono">{v.count}</td>
                                  <td className="py-2 text-right font-bold text-slate-800">{fmt(v.total)}</td>
                                  <td className="py-2 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${share}%` }} />
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-400 w-8 text-right">{share}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Exception Split */}
                    <div className="audit-card">
                      <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2 mb-4">
                        <PieChart size={16} className="text-amber-500" />
                        Exception Split
                      </h3>
                      <div className="space-y-3">
                        {[
                          { label: 'Missing in PR & 2B', count: invSummary.missing_in_2b_and_pr, color: 'bg-rose-500' },
                          { label: 'Missing in 2B (ITC Review)', count: invSummary.missing_in_2b_itc, color: 'bg-amber-600' },
                          { label: 'Missing from PR Only', count: invSummary.missing_only_from_pr, color: 'bg-rose-400' },
                          { label: 'Extraction Failed', count: invSummary.failed, color: 'bg-slate-400' },
                          { label: 'Pending Review', count: invSummary.pending, color: 'bg-slate-300' },
                        ].filter(e => e.count > 0).map(e => (
                          <div key={e.label} className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${e.color} shrink-0`} />
                            <div className="flex-1">
                              <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                                <span>{e.label}</span>
                                <span className="font-black">{e.count}</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${e.color} rounded-full`} style={{ width: invSummary.total > 0 ? `${(e.count / invSummary.total) * 100}%` : '0%' }} />
                              </div>
                            </div>
                          </div>
                        ))}
                        {invSummary.not_in_registry === 0 && invSummary.failed === 0 && invSummary.pending === 0 && (
                          <p className="text-xs text-emerald-600 italic py-2 text-center font-bold">✓ No exceptions — All vouchers matched!</p>
                        )}
                      </div>
                    </div>

                    {/* System Insights */}
                    <div className="audit-card bg-blue-900 text-white border-0">
                      <h3 className="font-bold text-blue-200 text-xs uppercase tracking-widest mb-4">Purchase Insights</h3>
                      <div className="space-y-3 text-sm">
                        <p className="border-l-2 border-blue-400 pl-3 py-1 leading-relaxed">
                          <strong>{invSummary.matched}</strong> of <strong>{invSummary.total}</strong> invoices verified against purchase registry.
                        </p>
                        <p className="border-l-2 border-rose-400 pl-3 py-1 leading-relaxed text-blue-100">
                          <strong>{invSummary.not_in_registry}</strong> invoices flagged as <span className="text-rose-300 font-bold">not in purchase registry</span>.
                        </p>
                        {invSummary.total_value > 0 && (
                          <p className="border-l-2 border-emerald-400 pl-3 py-1 leading-relaxed text-blue-100">
                            <strong>{fmt(invSummary.total_matched_value)}</strong> worth of invoices successfully reconciled.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="audit-card text-center py-10 text-slate-400 italic">No invoice data. Upload vouchers to generate the purchase vouching report.</div>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* SECTION 2: SALES VOUCHING (BILLS OF SALE)          */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="space-y-1 mt-10">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-emerald-100">
                <div className="bg-emerald-600 p-1.5 rounded-lg text-white shadow-sm">
                  <Receipt size={16} />
                </div>
                <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">Sales Vouching — Bill of Sale Summary</h2>
              </div>
            </div>

            {bosSummary ? (
              <>
                {/* Stat Cards */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total Bills', value: bosSummary.total.toString(), color: 'text-slate-800' },
                    { label: 'Matched', value: bosSummary.matched.toString(), color: 'text-emerald-600' },
                    { label: 'Not in Registry', value: bosSummary.not_in_registry.toString(), color: 'text-rose-600' },
                    { label: 'Failed / Pending', value: (bosSummary.failed + bosSummary.pending).toString(), color: 'text-amber-500' },
                  ].map(m => <StatCard key={m.label} {...m} />)}
                </div>

                {/* Value Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="audit-card bg-white">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Total Sale Value (All)</p>
                    <p className="text-2xl font-black text-slate-800">{fmt(bosSummary.total_value)}</p>
                  </div>
                  <div className="audit-card bg-white relative overflow-hidden group">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Total Matched Value</p>
                    <p className="text-2xl font-black text-emerald-600">{fmt(bosSummary.total_matched_value)}</p>
                    <div className="mt-2 flex items-center gap-2">
                       <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.round((bosSummary.total_matched_value / bosSummary.total_value) * 100) || 0}%` }}
                          />
                       </div>
                       <span className="text-xs font-black text-emerald-600">
                          {Math.round((bosSummary.total_matched_value / bosSummary.total_value) * 100) || 0}%
                       </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 font-bold italic uppercase">
                      of total sale value verified
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-6">
                    {/* Extraction Rate */}
                    <div className="audit-card flex items-center gap-8">
                      <div className="relative w-40 h-40 shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle
                            className="text-slate-100"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                          />
                          <circle
                            className={`${bosScoreColor} transition-all duration-1000 ease-out`}
                            strokeWidth="8"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * ((bosSummary.matched / bosSummary.total) * 100 || 0)) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-4xl font-black ${bosScoreColor}`}>
                             {((bosSummary.matched / bosSummary.total) * 100 || 0).toFixed(0)}%
                          </span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Score</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2 mb-2">
                          <TrendingUp size={16} className="text-emerald-500" />
                          Sales Quality Score
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                          {bosSummary.matched} of {bosSummary.total} bills of sale matched, yielding a confidence score of <strong>{((bosSummary.matched / bosSummary.total) * 100 || 0).toFixed(1)}%</strong>.
                        </p>
                        <div className="mt-6 space-y-2">
                          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span>Audit Standard Threshold</span>
                            <span className="text-emerald-600">95% Target</span>
                          </div>
                          <div className="relative h-2 bg-slate-100 rounded-full">
                            <div className={`h-full ${bosScoreBg} rounded-full`} style={{ width: `${(bosSummary.matched / bosSummary.total) * 100 || 0}%` }} />
                            <div className="absolute h-4 w-0.5 bg-slate-800 -top-1 left-[95%]" title="95% Global Standard" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Buyer Breakdown */}
                    <div className="audit-card">
                      <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2 mb-4">
                        <Users size={16} className="text-emerald-500" />
                        Buyer Breakdown (Top {bosSummary.buyer_breakdown.length})
                      </h3>
                      {bosSummary.buyer_breakdown.length === 0 ? (
                        <p className="text-slate-400 italic text-sm text-center py-4">No bills of sale extracted yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="text-left text-[10px] uppercase font-black text-slate-400 tracking-widest pb-2">Buyer</th>
                                <th className="text-right text-[10px] uppercase font-black text-slate-400 tracking-widest pb-2">Bills</th>
                                <th className="text-right text-[10px] uppercase font-black text-slate-400 tracking-widest pb-2">Total Value</th>
                                <th className="text-right text-[10px] uppercase font-black text-slate-400 tracking-widest pb-2">Share</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bosSummary.buyer_breakdown.map((b, i) => {
                                const share = bosSummary.total_value > 0 ? Math.round((b.total / bosSummary.total_value) * 100) : 0;
                                return (
                                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="py-2 font-semibold text-slate-700">{b.buyer}</td>
                                    <td className="py-2 text-right text-slate-500 font-mono">{b.count}</td>
                                    <td className="py-2 text-right font-bold text-slate-800">{fmt(b.total)}</td>
                                    <td className="py-2 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${share}%` }} />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 w-8 text-right">{share}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* BOS Status Split */}
                    <div className="audit-card">
                      <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2 mb-4">
                        <PieChart size={16} className="text-emerald-500" />
                        Extraction Status
                      </h3>
                      <div className="space-y-3">
                        {[
                          { label: 'Matched', count: bosSummary.matched, color: 'bg-emerald-500' },
                          { label: 'Not in Registry', count: bosSummary.not_in_registry, color: 'bg-rose-500' },
                          { label: 'Extraction Failed', count: bosSummary.failed, color: 'bg-amber-400' },
                          { label: 'Pending', count: bosSummary.pending, color: 'bg-slate-300' },
                        ].map(e => (
                          <div key={e.label} className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${e.color} shrink-0`} />
                            <div className="flex-1">
                              <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                                <span>{e.label}</span>
                                <span className="font-black">{e.count}</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${e.color} rounded-full`} style={{ width: bosSummary.total > 0 ? `${(e.count / bosSummary.total) * 100}%` : '0%' }} />
                              </div>
                            </div>
                          </div>
                        ))}
                        {bosSummary.total === 0 && (
                          <p className="text-xs text-slate-400 italic py-2 text-center">No bills uploaded yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Sales Insights */}
                    <div className="audit-card bg-emerald-900 text-white border-0">
                      <h3 className="font-bold text-emerald-200 text-xs uppercase tracking-widest mb-4">Sales Insights</h3>
                      <div className="space-y-3 text-sm">
                        <p className="border-l-2 border-emerald-400 pl-3 py-1 leading-relaxed">
                          <strong>{bosSummary.matched}</strong> of <strong>{bosSummary.total}</strong> bills of sale verified against sales registry.
                        </p>
                        <p className="border-l-2 border-rose-400 pl-3 py-1 leading-relaxed text-emerald-100">
                          <strong>{bosSummary.not_in_registry}</strong> bills flagged as <span className="text-rose-300 font-bold">not in sales registry</span>.
                        </p>
                        {bosSummary.total_value > 0 && (
                          <p className="border-l-2 border-emerald-400 pl-3 py-1 leading-relaxed text-emerald-100">
                            <strong>{fmt(bosSummary.total_matched_value)}</strong> worth of sales successfully reconciled.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="audit-card text-center py-10 text-slate-400 italic">No bill of sale data. Upload bills to generate the sales vouching report.</div>
            )}

            {/* Auditor Sign-off */}
            <div className="audit-card">
              <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2 mb-4">
                <ShieldCheck size={16} className="text-emerald-500" />
                Auditor's Sign-off
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border rounded-md italic text-sm text-slate-600">
                  "Detailed vouching performed for the period March 2026 covering both purchase invoices and bills of sale. Samples selected based on high-value thresholds. All material discrepancies have been reviewed and remarked. No major compliance violations detected in GST input/output tax credit matching."
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">CA Rajesh Kumar</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Lead Partner</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 italic">Digitally Signed on 28-03-2026</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
