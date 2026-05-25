"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Upload, CheckCircle, AlertCircle, Loader2, Eye, Trash2, X, RefreshCw, Sparkles, ThumbsUp, ChevronDown, ChevronUp, Settings, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { API_BASE } from "@/config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HsnAlternative { hsn_cd: string; description: string; score: number; }
interface HsnRecommendation {
  item_description: string;
  recommended_hsn: string | null;
  recommended_hsn_description: string | null;
  confidence_score: number;
  status: 'AUTO' | 'REVIEW' | 'NEEDS_REVIEW';
  reasoning: string;
  top_alternatives: HsnAlternative[];
  accepted_hsn: string | null;
  reviewed_by: string | null;
}
interface TaxTypeMismatch {
  invoice_id: number;
  invoice_number: string | null;
  vendor_name: string | null;
  determined_supply_type: string;
  expected_tax_type: string;
  actual_tax_type: string;
  reason: string;
  suggestion: string;
  status: string;
  filename: string | null;
}
interface MissingHsnRow {
  file_id: number;
  filename: string;
  invoice_number: string | null;
  vendor_name: string | null;
  vendor_gstin: string | null;
  taxable_value: number | null;
  recommendation: HsnRecommendation | null;
}

// ─── Helper components ────────────────────────────────────────────────────────

function ConfidenceBadge({ status, score }: { status: string; score: number }) {
  const pct = Math.round((score || 0) * 100);
  if (status === 'AUTO') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
      <CheckCircle size={10} /> AUTO · {pct}%
    </span>
  );
  if (status === 'REVIEW') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200">
      <AlertCircle size={10} /> REVIEW · {pct}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">
      <AlertCircle size={10} /> NEEDS REVIEW · {pct}%
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VoucherInbox() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [reprocessingIds, setReprocessingIds] = useState<Set<number>>(new Set());
  const [engagementId, setEngagementId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'missing_data' | 'missing_hsn' | 'missing_eway' | 'tax_type_mismatch'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Missing e-Way Bill logic
  const isServiceInvoice = (hsn: string | null) => hsn?.startsWith('99');
  const missingEwayRows = vouchers.filter(v => 
    (v.total_value || 0) > 50000 && 
    !isServiceInvoice(v.hsn_code) && 
    (!v.eway_bill_no || v.eway_bill_no.trim() === '')
  );

  // Missing HSN tab state
  const [missingHsnRows, setMissingHsnRows] = useState<MissingHsnRow[]>([]);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [runningRecommendations, setRunningRecommendations] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [acceptingIds, setAcceptingIds] = useState<Set<number>>(new Set());
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);

  // Tax Type Mismatch tab state
  const [taxMismatchRows, setTaxMismatchRows] = useState<TaxTypeMismatch[]>([]);
  const [missingDataRows, setMissingDataRows] = useState<TaxTypeMismatch[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [missingDataLoading, setMissingDataLoading] = useState(false);

  const [hsnFilter, setHsnFilter] = useState<'all' | 'auto' | 'review' | 'not_analysed'>('all');

  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'inv_number', 'hsn', 'inv_date', 'vendor_name', 'vendor_gstin', 
    'taxable_val', 'cgst', 'sgst', 'igst', 'total_value', 'match_status'
  ]));

  const allColumns = [
    { id: 'inv_number', label: 'Invoice Number' },
    { id: 'hsn', label: 'HSN' },
    { id: 'inv_date', label: 'Date' },
    { id: 'vendor_name', label: 'Vendor Name' },
    { id: 'vendor_gstin', label: 'Vendor GSTIN' },
    { id: 'buyer_name', label: 'Buyer Name' },
    { id: 'buyer_gstin', label: 'Buyer GSTIN' },
    { id: 'shipping_address', label: 'Shipping Address' },
    { id: 'billing_address', label: 'Billing Address' },
    { id: 'place_of_supply', label: 'Place of Supply' },
    { id: 'eway_bill_no', label: 'e-Way Bill' },
    { id: 'description_of_goods', label: 'Item Description' },
    { id: 'taxable_val', label: 'Taxable Value' },
    { id: 'discount', label: 'Discount' },
    { id: 'cgst_rate', label: 'CGST %' },
    { id: 'sgst_rate', label: 'SGST %' },
    { id: 'igst_rate', label: 'IGST %' },
    { id: 'cgst', label: 'CGST Amt' },
    { id: 'sgst', label: 'SGST Amt' },
    { id: 'igst', label: 'IGST Amt' },
    { id: 'total_value', label: 'Grand Total' },
    { id: 'match_status', label: 'Match Status' },
  ];

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleCount = visibleColumns.size + 2; // + index and actions

  // ─── Init engagement ────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const storedId = localStorage.getItem('engagementId');
        if (storedId) { setEngagementId(parseInt(storedId)); return; }
        const resp = await fetch(`${API_BASE}/engagements/`);
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.length > 0) setEngagementId(data[0].id);
        }
      } catch (err) { console.error("Failed to fetch engagements:", err); }
    };
    init();
  }, []);

  // ─── Fetch vouchers (All tab) ───────────────────────────────────────────────
  const fetchVouchers = async () => {
    if (!engagementId) return;
    try {
      const resp = await fetch(`${API_BASE}/files/${engagementId}`);
      if (resp.ok) setVouchers(await resp.json());
    } catch (err) { console.error("Failed to fetch vouchers:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (engagementId) fetchVouchers(); }, [engagementId]);

  useEffect(() => {
    if (!engagementId) return;
    const interval = setInterval(() => {
      const hasPending = vouchers.some(v => v.status === 'uploaded' || v.status === 'processing');
      if (hasPending) {
        fetchVouchers();
        fetchTaxMismatches();
        fetchMissingData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [vouchers, engagementId]);

  // ─── Fetch missing HSN status ───────────────────────────────────────────────
  const fetchMissingHsn = async () => {
    if (!engagementId) return;
    setHsnLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/hsn/status/${engagementId}`);
      if (resp.ok) setMissingHsnRows(await resp.json());
    } catch (err) { console.error("Failed to fetch HSN status:", err); }
    finally { setHsnLoading(false); }
  };

  useEffect(() => {
    if (engagementId) fetchMissingHsn();
  }, [engagementId]);

  // ─── Fetch Tax Type Mismatches ─────────────────────────────────────────────
  const fetchTaxMismatches = async () => {
    if (!engagementId) return;
    setTaxLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/files/tax-mismatches/${engagementId}?status=MISMATCH`);
      if (resp.ok) setTaxMismatchRows(await resp.json());
    } catch (err) { console.error("Failed to fetch tax mismatches:", err); }
    finally { setTaxLoading(false); }
  };

  useEffect(() => {
    if (engagementId) fetchTaxMismatches();
  }, [engagementId]);

  // ─── Fetch Missing Data ────────────────────────────────────────────────────
  const fetchMissingData = async () => {
    if (!engagementId) return;
    setMissingDataLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/files/tax-mismatches/${engagementId}?status=NEEDS_REVIEW`);
      if (resp.ok) setMissingDataRows(await resp.json());
    } catch (err) { console.error("Failed to fetch missing data:", err); }
    finally { setMissingDataLoading(false); }
  };

  useEffect(() => {
    if (engagementId) fetchMissingData();
  }, [engagementId]);

  // ─── Upload ─────────────────────────────────────────────────────────────────
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!engagementId) { alert('No engagement selected. Please set up an engagement first.'); return; }
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("engagement_id", String(engagementId));
      try {
        const resp = await fetch(`/api/v1/files/upload`, { method: 'POST', body: formData });
        if (resp.ok) {
          const dbFile = await resp.json();
          
          // Use FileReader to extract the base64 representation of the file in the browser 
          // Fire the Netlify background function DIRECTLY — bypassing the CDN rewrite.
          // Netlify rewrites do NOT reliably forward large POST bodies (base64 PDF data).
          // On localhost fall back to the Next.js API route.
          const reader = new FileReader();
          reader.onload = async () => {
            const base64String = (reader.result as string).split(',')[1];
            try {
              const isNetlify = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
              const processUrl = isNetlify
                ? `/.netlify/functions/process-pdf-background?fileId=${dbFile.id}`
                : `/api/v1/files/${dbFile.id}/process`;

              console.log(`[CLIENT-OCR] Triggering background extraction for file ${dbFile.id} via ${processUrl}...`);
              fetch(processUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  engagement_id: engagementId,
                  buffer_b64: base64String
                })
              }).then((processResp) => {
                // Background function returns 202 immediately — that means it was queued successfully.
                // Actual completion is reflected in DB and picked up by the 3-second polling interval.
                if (processResp.ok || processResp.status === 202) {
                  console.log(`[CLIENT-OCR] Background function queued for file ${dbFile.id} (status ${processResp.status}). Polling will update UI.`);
                  fetchVouchers();
                } else {
                  processResp.text().then(body => {
                    console.error(`[CLIENT-OCR] Background function error for ${dbFile.id}: ${processResp.status} — ${body}`);
                  });
                }
              }).catch((e) => {
                console.error(`[CLIENT-OCR] Network error triggering processing for ${dbFile.id}:`, e);
              });
            } catch (err) {
              console.error("[CLIENT-OCR] Failed inside load block:", err);
            }
          };
          reader.readAsDataURL(file);
        } else {
          const err = await resp.json().catch(() => ({}));
          console.error("Upload failed for", file.name, err);
        }
      } catch (err) { console.error("Upload failed for", file.name, err); }
    }
    setUploading(false);
    fetchVouchers();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Actions (All tab) ──────────────────────────────────────────────────────
  const handleReprocess = async (fileId: number) => {
    setReprocessingIds(prev => new Set(prev).add(fileId));
    try {
      const resp = await fetch(`${API_BASE}/files/${fileId}/reprocess`, { method: 'POST' });
      if (resp.ok) {
        setVouchers(prev => prev.map(v => v.id === fileId ? { ...v, status: 'uploaded', match_status: null } : v));
        await fetchVouchers();
      }
    } catch (err) { console.error("Reprocess failed", err); }
    finally {
      setReprocessingIds(prev => { const n = new Set(prev); n.delete(fileId); return n; });
    }
  };

  const handleDeleteClick = (fileId: number) => setFileToDelete(fileId);

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      const resp = await fetch(`${API_BASE}/files/${fileToDelete}`, { method: 'DELETE' });
      if (resp.ok) { setVouchers(prev => prev.filter(v => v.id !== fileToDelete)); }
      else { const e = await resp.json(); alert("Failed to delete: " + (e.detail || "Unknown error")); }
    } catch (err) { alert("Error connecting to server for deletion."); }
    finally { setFileToDelete(null); }
  };

  const handleRefreshReconciliation = async () => {
    if (!engagementId) return;
    setReconciling(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      const resp = await fetch(`${API_BASE}/files/reconcile/${engagementId}`, { method: 'POST' });
      if (resp.ok) await fetchVouchers();
      else { const e = await resp.json(); alert("Failed to reconcile: " + (e.detail || "Unknown error")); }
    } catch (err) { alert("Error connecting to server."); }
    finally { setReconciling(false); }
  };

  // ─── HSN Recommendation actions ─────────────────────────────────────────────
  const handleRunRecommendations = async () => {
    if (!engagementId) return;
    setRunningRecommendations(true);
    try {
      await fetch(`${API_BASE}/hsn/recommend/${engagementId}`, { method: 'POST' });
      // Poll until recommendations appear — recheck after 8 seconds
      setTimeout(async () => {
        await fetchMissingHsn();
        setRunningRecommendations(false);
      }, 8000);
    } catch (err) {
      console.error("Failed to trigger HSN recommendations:", err);
      setRunningRecommendations(false);
    }
  };

  const handleRunSingleRecommendation = async (fileId: number) => {
    setAcceptingIds(prev => new Set(prev).add(fileId));
    try {
      await fetch(`${API_BASE}/hsn/recommend/single/${fileId}`, { method: 'POST' });
      setTimeout(async () => {
        await fetchMissingHsn();
        setAcceptingIds(prev => { const n = new Set(prev); n.delete(fileId); return n; });
      }, 6000);
    } catch (err) {
      console.error("Failed single HSN recommendation:", err);
      setAcceptingIds(prev => { const n = new Set(prev); n.delete(fileId); return n; });
    }
  };

  const handleAcceptHsn = async (fileId: number, hsnCode: string) => {
    setAcceptingIds(prev => new Set(prev).add(fileId));
    try {
      const resp = await fetch(`${API_BASE}/hsn/accept/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hsn_code: hsnCode, reviewed_by: 'reviewer' }),
      });
      if (resp.ok) {
        // Remove from missing HSN list and refresh main vouchers
        setMissingHsnRows(prev => prev.filter(r => r.file_id !== fileId));
        await fetchVouchers();
      } else {
        const e = await resp.json();
        alert("Failed to accept HSN: " + (e.detail || "Unknown error"));
      }
    } catch (err) { alert("Error connecting to server."); }
    finally { setAcceptingIds(prev => { const n = new Set(prev); n.delete(fileId); return n; }); }
  };

  const toggleExpand = (fileId: number) => {
    setExpandedRows(prev => {
      const n = new Set(prev);
      if (n.has(fileId)) n.delete(fileId); else n.add(fileId);
      return n;
    });
  };

  // ─── Derived state ──────────────────────────────────────────────────────────
  const isMissingHsn = (hsn: any) => !hsn || hsn === 'null' || hsn === 'None' || hsn === 'missing' || hsn === '0000';
  
  const filteredVouchers = vouchers.filter(v => activeTab === 'all' || isMissingHsn(v.hsn_code));
  const missingHsnCount = vouchers.filter(v => v.status === 'extracted' && isMissingHsn(v.hsn_code)).length;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Voucher Inbox</h1>
            <p className="text-slate-500 text-sm">Manage and review purchase vouchers for this engagement.</p>
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="file" 
              multiple 
              accept=".pdf" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                uploading 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-200'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload Vouchers</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabs + Actions Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('all')}
              className={`text-sm pb-2 px-1 transition-all ${activeTab === 'all' ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'font-medium text-slate-500 hover:text-slate-700'}`}
            >
              All Vouchers
            </button>
            <button
               onClick={() => setActiveTab('missing_data')}
               className={`text-sm pb-2 px-1 transition-all flex items-center gap-2 ${activeTab === 'missing_data' ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'font-medium text-slate-500 hover:text-slate-700'}`}
            >
              Missing Data
              {missingDataRows.length > 0 && (
                <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{missingDataRows.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('missing_hsn')}
              className={`text-sm pb-2 px-1 transition-all flex items-center gap-2 ${activeTab === 'missing_hsn' ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'font-medium text-slate-500 hover:text-slate-700'}`}
            >
              Missing HSN
              {missingHsnCount > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{missingHsnCount}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('missing_eway')}
              className={`text-sm pb-2 px-1 transition-all flex items-center gap-2 ${activeTab === 'missing_eway' ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'font-medium text-slate-500 hover:text-slate-700'}`}
            >
              Missing Eway Bill
              {missingEwayRows.length > 0 && (
                <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{missingEwayRows.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tax_type_mismatch')}
              className={`text-sm pb-2 px-1 transition-all flex items-center gap-2 ${activeTab === 'tax_type_mismatch' ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'font-medium text-slate-500 hover:text-slate-700'}`}
            >
              Tax Type Mismatch
              {taxMismatchRows.length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{taxMismatchRows.length}</span>
              )}
            </button>
          </div>
          {activeTab === 'all' && (
            <div className="flex items-center gap-2 relative">
              <button
                onClick={handleRefreshReconciliation}
                disabled={reconciling}
                className="flex items-center gap-2 text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
              >
                {reconciling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {reconciling ? 'Reconciling...' : 'Refresh Reconciliation'}
              </button>
              
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className={`p-1.5 rounded-lg border transition-all ${showColumnSettings ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                title="Table Settings"
              >
                <Settings size={16} />
              </button>

              {showColumnSettings && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowColumnSettings(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden transform origin-top-right animate-in fade-in zoom-in duration-100">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manage Columns</p>
                    </div>
                    <div className="p-2 max-h-80 overflow-y-auto">
                      {allColumns.map(col => (
                        <button
                          key={col.id}
                          onClick={() => toggleColumn(col.id)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                          <span className={`text-[11px] font-medium ${visibleColumns.has(col.id) ? 'text-slate-700' : 'text-slate-400 font-normal line-through'}`}>
                            {col.label}
                          </span>
                          <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${visibleColumns.has(col.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                            {visibleColumns.has(col.id) && <Check size={10} className="text-white" />}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="p-2 border-t border-slate-100">
                      <button 
                        onClick={() => setVisibleColumns(new Set(allColumns.map(c => c.id)))}
                        className="w-full py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === 'missing_hsn' && (
            <button
              onClick={handleRunRecommendations}
              disabled={runningRecommendations || missingHsnRows.length === 0}
              className="flex items-center gap-2 text-xs font-bold bg-violet-100 text-violet-700 px-3 py-1.5 rounded-lg hover:bg-violet-200 transition-colors disabled:opacity-50"
            >
              {runningRecommendations ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {runningRecommendations ? 'AI Running...' : 'Run HSN Recommendations'}
            </button>
          )}
        </div>

        {/* ── ALL VOUCHERS TABLE ─────────────────────────────────────────────── */}
        {activeTab === 'all' && (
          <div className="audit-card p-0 overflow-x-auto bg-white shadow-xl shadow-slate-100 border-slate-200">
            <table className="w-full text-[11px] whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="audit-table-header text-center w-10">#</th>
                  {visibleColumns.has('inv_number') && <th className="audit-table-header">Inv Number</th>}
                  {visibleColumns.has('hsn') && <th className="audit-table-header">HSN</th>}
                  {visibleColumns.has('inv_date') && <th className="audit-table-header">Inv Date</th>}
                  {visibleColumns.has('vendor_name') && <th className="audit-table-header">Vendor Name</th>}
                  {visibleColumns.has('vendor_gstin') && <th className="audit-table-header">Vendor GSTIN</th>}
                  {visibleColumns.has('buyer_name') && <th className="audit-table-header">Buyer Name</th>}
                  {visibleColumns.has('buyer_gstin') && <th className="audit-table-header">Buyer GSTIN</th>}
                  {visibleColumns.has('shipping_address') && <th className="audit-table-header">Shipping Addr</th>}
                  {visibleColumns.has('billing_address') && <th className="audit-table-header">Billing Addr</th>}
                  {visibleColumns.has('place_of_supply') && <th className="audit-table-header">POS</th>}
                  {visibleColumns.has('eway_bill_no') && <th className="audit-table-header">e-Way Bill</th>}
                  {visibleColumns.has('description_of_goods') && <th className="audit-table-header">Item Description</th>}
                  {visibleColumns.has('taxable_val') && <th className="audit-table-header text-right">Taxable Val</th>}
                  {visibleColumns.has('discount') && <th className="audit-table-header text-right">Discount</th>}
                  {visibleColumns.has('cgst_rate') && <th className="audit-table-header text-right">CGST %</th>}
                  {visibleColumns.has('sgst_rate') && <th className="audit-table-header text-right">SGST %</th>}
                  {visibleColumns.has('igst_rate') && <th className="audit-table-header text-right">IGST %</th>}
                  {visibleColumns.has('cgst') && <th className="audit-table-header text-right">CGST Amt</th>}
                  {visibleColumns.has('sgst') && <th className="audit-table-header text-right">SGST Amt</th>}
                  {visibleColumns.has('igst') && <th className="audit-table-header text-right">IGST Amt</th>}
                  {visibleColumns.has('total_value') && <th className="audit-table-header text-right">Grand Total</th>}
                  {visibleColumns.has('match_status') && <th className="audit-table-header text-right">Match Status</th>}
                  <th className="audit-table-header text-right px-8">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={visibleCount} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></td></tr>
                ) : filteredVouchers.length === 0 ? (
                  <tr><td colSpan={visibleCount} className="py-20 text-center text-slate-400 italic font-medium text-sm">No vouchers uploaded yet.</td></tr>
                ) : filteredVouchers.map((v, i) => (
                  <tr key={v.id} className="hover:bg-blue-50/30 group transition-colors border-b border-slate-100 last:border-0">
                    <td className="audit-table-cell text-center text-slate-400 font-mono">{i + 1}</td>
                    
                    {visibleColumns.has('inv_number') && (
                      <td className="audit-table-cell font-mono text-slate-600 uppercase">{v.invoice_number || '—'}</td>
                    )}
                    
                    {visibleColumns.has('hsn') && (
                      <td className="audit-table-cell font-mono font-bold">
                        {!isMissingHsn(v.hsn_code)
                          ? <span className="text-emerald-700">{v.hsn_code}</span>
                          : <span className="text-rose-400 italic text-[10px]">Missing</span>}
                      </td>
                    )}
                    
                    {visibleColumns.has('inv_date') && (
                      <td className="audit-table-cell text-slate-500">
                        {v.invoice_date ? new Date(v.invoice_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                    )}
                    
                    {visibleColumns.has('vendor_name') && (
                      <td className="audit-table-cell font-bold text-slate-800">{v.vendor_name || '—'}</td>
                    )}
                    
                    {visibleColumns.has('vendor_gstin') && (
                      <td className="audit-table-cell font-mono text-[10px] text-slate-500">{v.vendor_gstin || '—'}</td>
                    )}

                    {visibleColumns.has('buyer_name') && (
                      <td className="audit-table-cell font-bold text-slate-800">{v.buyer_name || '—'}</td>
                    )}

                    {visibleColumns.has('buyer_gstin') && (
                      <td className="audit-table-cell font-mono text-[10px] text-slate-500">{v.buyer_gstin || '—'}</td>
                    )}

                    {visibleColumns.has('shipping_address') && (
                      <td className="audit-table-cell text-slate-500 max-w-[120px] truncate" title={v.shipping_address}>{v.shipping_address || '—'}</td>
                    )}

                    {visibleColumns.has('billing_address') && (
                      <td className="audit-table-cell text-slate-500 max-w-[120px] truncate" title={v.billing_address}>{v.billing_address || '—'}</td>
                    )}

                    {visibleColumns.has('place_of_supply') && (
                      <td className="audit-table-cell text-slate-500">{v.place_of_supply || '—'}</td>
                    )}

                    {visibleColumns.has('eway_bill_no') && (
                      <td className="audit-table-cell font-mono text-slate-600">{v.eway_bill_no || '—'}</td>
                    )}

                    {visibleColumns.has('description_of_goods') && (
                      <td className="audit-table-cell text-slate-600 italic max-w-[150px] truncate" title={v.description_of_goods}>{v.description_of_goods || '—'}</td>
                    )}
                    
                    {visibleColumns.has('taxable_val') && (
                      <td className="audit-table-cell text-right font-medium text-slate-600">
                        {v.taxable_value ? `₹${v.taxable_value.toLocaleString('en-IN')}` : '—'}
                      </td>
                    )}

                    {visibleColumns.has('discount') && (
                      <td className="audit-table-cell text-right text-rose-600">
                        {v.discount ? `-₹${v.discount.toLocaleString('en-IN')}` : '—'}
                      </td>
                    )}

                    {visibleColumns.has('cgst_rate') && (
                      <td className="audit-table-cell text-right text-slate-400">{v.cgst_rate ? `${v.cgst_rate}%` : '—'}</td>
                    )}
                    {visibleColumns.has('sgst_rate') && (
                      <td className="audit-table-cell text-right text-slate-400">{v.sgst_rate ? `${v.sgst_rate}%` : '—'}</td>
                    )}
                    {visibleColumns.has('igst_rate') && (
                      <td className="audit-table-cell text-right text-slate-400">{v.igst_rate ? `${v.igst_rate}%` : '—'}</td>
                    )}
                    
                    {visibleColumns.has('cgst') && (
                      <td className="audit-table-cell text-right text-slate-500">{v.cgst ? `₹${v.cgst.toLocaleString('en-IN')}` : '—'}</td>
                    )}
                    
                    {visibleColumns.has('sgst') && (
                      <td className="audit-table-cell text-right text-slate-500">{v.sgst ? `₹${v.sgst.toLocaleString('en-IN')}` : '—'}</td>
                    )}
                    
                    {visibleColumns.has('igst') && (
                      <td className="audit-table-cell text-right text-slate-500">{v.igst ? `₹${v.igst.toLocaleString('en-IN')}` : '—'}</td>
                    )}
                    
                    {visibleColumns.has('total_value') && (
                      <td className="audit-table-cell text-right font-black text-slate-900">
                        {v.total_value ? `₹${v.total_value.toLocaleString('en-IN')}` : '—'}
                      </td>
                    )}
                    
                    {visibleColumns.has('match_status') && (
                      <td className="audit-table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {v.match_status ? (
                            <div className="flex items-center gap-1.5">
                              {v.match_status === 'matched'
                                ? <CheckCircle size={12} className="text-emerald-500" />
                                : <AlertCircle size={12} className={v.match_status?.includes('itc_review') ? "text-amber-500" : "text-rose-500"} />}
                              <span className={`text-[9px] font-black uppercase tracking-tighter ${v.match_status === 'matched' ? 'text-emerald-600' : v.match_status?.includes('itc_review') ? 'text-amber-600' : 'text-rose-600'}`}>
                                {v.match_status?.replace(/_/g, ' ').replace('itc review', '(ITC Review)')}
                              </span>
                            </div>
                          ) : v.status === 'failed' ? (
                            <div className="flex items-center gap-1.5 text-rose-600 animate-pulse">
                              <AlertCircle size={12} />
                              <span className="text-[9px] font-black uppercase tracking-tighter">Extraction Failed</span>
                            </div>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-400 uppercase italic flex items-center gap-1.5">
                              <Loader2 size={10} className="animate-spin" /> Processing...
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="audit-table-cell text-right px-8">
                      {(reconciling || reprocessingIds.has(v.id)) ? (
                        <div className="flex items-center justify-end gap-2 text-blue-600 animate-pulse">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-[10px] font-black uppercase tracking-tighter">
                            {reprocessingIds.has(v.id) ? 'Processing...' : 'Reconciling...'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <a href={`http://localhost:8000/storage/${engagementId}/${v.filename}`} target="_blank"
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="View PDF"><Eye size={14} /></a>
                          <button onClick={() => handleReprocess(v.id)}
                            className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Reprocess">
                            <RefreshCw size={14} />
                          </button>
                          <button onClick={() => handleDeleteClick(v.id)}
                            className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── MISSING HSN TAB ───────────────────────────────────────────────── */}
        {activeTab === 'missing_hsn' && (
          <div className="space-y-3">
            {hsnLoading ? (
              <div className="py-24 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></div>
            ) : missingHsnRows.length === 0 ? (
              <div className="audit-card py-20 text-center text-slate-400">
                <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400" />
                <p className="font-bold text-slate-600">All vouchers have HSN codes!</p>
                <p className="text-sm mt-1">No missing HSN entries for this engagement.</p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium px-1">
                  <button 
                    onClick={() => setHsnFilter('all')}
                    className={`hover:text-slate-800 transition-colors ${hsnFilter === 'all' ? 'font-bold text-slate-900 border-b border-slate-900' : ''}`}
                  >
                    {missingHsnRows.length} voucher{missingHsnRows.length !== 1 ? 's' : ''} missing HSN
                  </button>
                  <span>·</span>
                  <button 
                    onClick={() => setHsnFilter('auto')}
                    className={`text-emerald-600 hover:text-emerald-800 transition-colors ${hsnFilter === 'auto' ? 'font-bold border-b border-emerald-600' : ''}`}
                  >
                    {missingHsnRows.filter(r => r.recommendation?.status === 'AUTO').length} auto-ready
                  </button>
                  <span>·</span>
                  <button 
                    onClick={() => setHsnFilter('review')}
                    className={`text-amber-600 hover:text-amber-800 transition-colors ${hsnFilter === 'review' ? 'font-bold border-b border-amber-600' : ''}`}
                  >
                    {missingHsnRows.filter(r => r.recommendation?.status === 'REVIEW' || r.recommendation?.status === 'NEEDS_REVIEW').length} need review
                  </button>
                  <span>·</span>
                  <button 
                    onClick={() => setHsnFilter('not_analysed')}
                    className={`text-rose-600 hover:text-rose-800 transition-colors ${hsnFilter === 'not_analysed' ? 'font-bold border-b border-rose-600' : ''}`}
                  >
                    {missingHsnRows.filter(r => !r.recommendation).length} not yet analysed
                  </button>
                </div>

                {missingHsnRows.filter(row => {
                  if (hsnFilter === 'auto') return row.recommendation?.status === 'AUTO';
                  if (hsnFilter === 'review') return row.recommendation?.status === 'REVIEW' || row.recommendation?.status === 'NEEDS_REVIEW';
                  if (hsnFilter === 'not_analysed') return !row.recommendation;
                  return true;
                }).map((row) => {
                  const rec = row.recommendation;
                  const isExpanded = expandedRows.has(row.file_id);
                  const isProcessing = acceptingIds.has(row.file_id);

                  return (
                    <div key={row.file_id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      {/* Row header */}
                      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase tracking-wide">{row.invoice_number || row.filename}</p>
                            <p className="text-[11px] text-slate-500">{row.vendor_name || 'Unknown vendor'} {row.vendor_gstin ? `· ${row.vendor_gstin}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {row.taxable_value && (
                            <span className="text-xs font-bold text-slate-600">₹{row.taxable_value.toLocaleString('en-IN')}</span>
                          )}
                          {rec && <ConfidenceBadge status={rec.status} score={rec.confidence_score} />}
                          <button
                            onClick={() => handleRunSingleRecommendation(row.file_id)}
                            disabled={isProcessing}
                            className="p-1.5 rounded hover:bg-violet-50 text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-40"
                            title="Re-run AI recommendation"
                          >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          </button>
                          <button onClick={() => toggleExpand(row.file_id)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Recommendation body */}
                      {!rec ? (
                        <div className="px-5 py-4 text-center text-sm text-slate-400 italic">
                          No recommendation yet. Click <Sparkles size={12} className="inline" /> to run AI analysis, or use the button above.
                        </div>
                      ) : (
                        <div className="px-5 py-4 space-y-3">
                          {/* Main recommendation */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Recommended HSN</p>
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-black text-slate-800 font-mono tracking-tight">{rec.recommended_hsn || '—'}</span>
                              </div>
                              <p className="text-xs text-slate-600 font-medium">{rec.recommended_hsn_description || '—'}</p>
                              <p className="text-[11px] text-slate-400 italic mt-1">"{rec.reasoning}"</p>
                            </div>

                            {/* Accept / Accept alternatives */}
                            <div className="flex flex-col gap-2 min-w-[120px]">
                              {rec.recommended_hsn && (
                                <button
                                  onClick={() => handleAcceptHsn(row.file_id, rec.recommended_hsn!)}
                                  disabled={isProcessing}
                                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-colors disabled:opacity-50"
                                >
                                  {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                                  Accept {rec.recommended_hsn}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Alternatives (expandable) */}
                          {isExpanded && rec.top_alternatives && rec.top_alternatives.length > 0 && (
                            <div className="border-t border-slate-100 pt-3">
                              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Top Alternatives</p>
                              <div className="space-y-2">
                                {rec.top_alternatives.map((alt, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                    <div>
                                      <span className="font-mono font-black text-xs text-slate-700">{alt.hsn_cd}</span>
                                      <p className="text-[11px] text-slate-500">{alt.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-400 font-mono">{Math.round((alt.score || 0) * 100)}%</span>
                                      <button
                                        onClick={() => handleAcceptHsn(row.file_id, alt.hsn_cd)}
                                        disabled={isProcessing}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                                      >
                                        Use this
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Accepted overlay */}
                      {rec?.accepted_hsn && (
                        <div className="bg-emerald-50 border-t border-emerald-100 px-5 py-2 flex items-center gap-2">
                          <CheckCircle size={12} className="text-emerald-600" />
                          <p className="text-[11px] font-bold text-emerald-700">Accepted: HSN {rec.accepted_hsn}</p>
                          {rec.reviewed_by && <span className="text-[10px] text-emerald-500">by {rec.reviewed_by}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── MISSING EWAY BILL TAB ───────────────────────────────────────────── */}
        {activeTab === 'missing_eway' && (
          <div className="space-y-4">
            <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex items-start gap-3">
              <div className="bg-orange-100 p-2 rounded-lg text-orange-600 mt-0.5"><AlertCircle size={20} /></div>
              <div>
                <h4 className="text-sm font-bold text-orange-800">Compliance Audit: Missing e-Way Bills</h4>
                <p className="text-xs text-orange-600 leading-relaxed mt-0.5">
                  Showing invoices where <strong>Value &gt; ₹50,000</strong> and <strong>Type is Goods</strong> (Non-Service) but no e-Way bill number was found. 
                  Invoices for Services (SAC starting with 99) are excluded from this requirement.
                </p>
              </div>
            </div>

            <div className="audit-card p-0 overflow-x-auto bg-white shadow-xl shadow-slate-100 border-slate-200">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="audit-table-header text-center w-10">#</th>
                    <th className="audit-table-header">Invoice #</th>
                    <th className="audit-table-header">Vendor</th>
                    <th className="audit-table-header">HSN / SAC</th>
                    <th className="audit-table-header text-right">Invoice Value</th>
                    <th className="audit-table-header text-right">EBN Status</th>
                    <th className="audit-table-header text-right px-8">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {missingEwayRows.length === 0 ? (
                    <tr><td colSpan={7} className="py-20 text-center text-slate-400 font-medium italic">No missing e-way bills detected. Excellent compliance!</td></tr>
                  ) : missingEwayRows.map((v, i) => (
                    <tr key={v.id} className="hover:bg-orange-50/20 border-b border-slate-50 last:border-0 transition-colors">
                      <td className="audit-table-cell text-center text-slate-400 font-mono italic">{i + 1}</td>
                      <td className="audit-table-cell font-bold text-slate-800">{v.invoice_number}</td>
                      <td className="audit-table-cell">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{v.vendor_name || 'Unknown'}</span>
                          <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{v.vendor_gstin}</span>
                        </div>
                      </td>
                      <td className="audit-table-cell font-mono text-slate-500">{v.hsn_code || '—'}</td>
                      <td className="audit-table-cell text-right font-black text-slate-900 italic">₹{v.total_value?.toLocaleString('en-IN') || '0'}</td>
                      <td className="audit-table-cell text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">
                          Missing EBN
                        </span>
                      </td>
                      <td className="audit-table-cell text-right px-8">
                        <div className="flex items-center justify-end gap-2">
                           <a href={`http://localhost:8000/storage/${engagementId}/${v.filename}`} target="_blank"
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-600" title="View PDF"><Eye size={14} /></a>
                          <button onClick={() => handleReprocess(v.id)}
                            className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Reprocess">
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MISSING DATA TAB ─────────────────────────────────────────────── */}
        {activeTab === 'missing_data' && (
          <div className="audit-card p-0 overflow-x-auto bg-white shadow-xl shadow-slate-100 border-slate-200">
            <table className="w-full text-[11px] whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="audit-table-header text-center w-10">#</th>
                  <th className="audit-table-header">Invoice Number</th>
                  <th className="audit-table-header">Vendor</th>
                  <th className="audit-table-header">Status</th>
                  <th className="audit-table-header">Missing Info</th>
                  <th className="audit-table-header">Suggestion</th>
                  <th className="audit-table-header text-right px-8">Actions</th>
                </tr>
              </thead>
              <tbody>
                {missingDataLoading ? (
                  <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></td></tr>
                ) : missingDataRows.length === 0 ? (
                  <tr><td colSpan={7} className="py-20 text-center text-slate-400 italic font-medium text-sm">No vouchers with missing data found.</td></tr>
                ) : missingDataRows.map((row, i) => (
                  <tr key={row.invoice_id} className="hover:bg-blue-50/30 group transition-colors border-b border-slate-100 last:border-0">
                    <td className="audit-table-cell text-center text-slate-400 font-mono">{i + 1}</td>
                    <td className="audit-table-cell font-mono text-slate-600 uppercase">{row.invoice_number || '—'}</td>
                    <td className="audit-table-cell font-bold text-slate-800">{row.vendor_name || '—'}</td>
                    <td className="audit-table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200">
                        <AlertCircle size={10} /> NEEDS REVIEW
                      </span>
                    </td>
                    <td className="audit-table-cell text-slate-500 max-w-[300px] truncate" title={row.reason}>{row.reason.replace('Insufficient data to determine supply type. Missing: ', '')}</td>
                    <td className="audit-table-cell font-medium text-blue-700 italic">{row.suggestion}</td>
                    <td className="audit-table-cell text-right px-8">
                       <a href={`http://localhost:8000/storage/${engagementId}/${row.filename}`} target="_blank"
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 inline-block" title="View PDF"><Eye size={14} /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TAX TYPE MISMATCH TAB ─────────────────────────────────────────── */}
        {activeTab === 'tax_type_mismatch' && (
          <div className="audit-card p-0 overflow-x-auto bg-white shadow-xl shadow-slate-100 border-slate-200">
            <table className="w-full text-[11px] whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="audit-table-header text-center w-10">#</th>
                  <th className="audit-table-header">Invoice Number</th>
                  <th className="audit-table-header">Vendor</th>
                  <th className="audit-table-header">Supply Type</th>
                  <th className="audit-table-header">Expected Tax</th>
                  <th className="audit-table-header">Actual Tax</th>
                  <th className="audit-table-header">Status</th>
                  <th className="audit-table-header">Reason</th>
                  <th className="audit-table-header">Suggestion</th>
                  <th className="audit-table-header text-right px-8">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taxLoading ? (
                  <tr><td colSpan={10} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></td></tr>
                ) : taxMismatchRows.length === 0 ? (
                  <tr><td colSpan={10} className="py-20 text-center text-slate-400 italic font-medium text-sm">No tax type mismatches detected.</td></tr>
                ) : taxMismatchRows.map((row, i) => (
                  <tr key={row.invoice_id} className="hover:bg-blue-50/30 group transition-colors border-b border-slate-100 last:border-0">
                    <td className="audit-table-cell text-center text-slate-400 font-mono">{i + 1}</td>
                    <td className="audit-table-cell font-mono text-slate-600 uppercase">{row.invoice_number || '—'}</td>
                    <td className="audit-table-cell font-bold text-slate-800">{row.vendor_name || '—'}</td>
                    <td className="audit-table-cell text-slate-600">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                        {row.determined_supply_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="audit-table-cell font-bold text-slate-700">{row.expected_tax_type}</td>
                    <td className="audit-table-cell font-bold text-rose-600">{row.actual_tax_type}</td>
                    <td className="audit-table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        row.status === 'MISMATCH' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        <AlertCircle size={10} /> {row.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="audit-table-cell text-slate-500 max-w-[200px] truncate" title={row.reason}>{row.reason}</td>
                    <td className="audit-table-cell font-medium text-blue-700 italic">{row.suggestion}</td>
                    <td className="audit-table-cell text-right px-8">
                       <a href={`http://localhost:8000/storage/${engagementId}/${row.filename}`} target="_blank"
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 inline-block" title="View PDF"><Eye size={14} /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-100 p-2 rounded-full text-rose-600"><AlertCircle size={24} /></div>
                  <h3 className="text-xl font-bold text-slate-900">Delete Invoice</h3>
                </div>
                <button onClick={() => setFileToDelete(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>
              <p className="text-slate-600">Are you sure you want to permanently delete this invoice? This will remove the PDF and all extraction data. This cannot be undone.</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-md transition-colors flex items-center gap-2">
                <Trash2 size={16} /> Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
