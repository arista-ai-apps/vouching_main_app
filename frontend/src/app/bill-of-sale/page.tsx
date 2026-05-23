"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Eye, Trash2, X, Receipt, RotateCcw } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { API_BASE } from "@/config";

export default function BillOfSaleInbox() {
  const [bills, setBills] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [engagementId, setEngagementId] = useState<number | null>(null);
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const fetchBills = async () => {
    if (!engagementId) return;
    try {
      const resp = await fetch(`${API_BASE}/bill-of-sale/${engagementId}`);
      if (resp.ok) setBills(await resp.json());
    } catch (err) {
      console.error("Failed to fetch bills:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (engagementId) fetchBills();
  }, [engagementId]);

  // Intelligent polling
  useEffect(() => {
    if (!engagementId) return;
    const interval = setInterval(() => {
      const hasPending = bills.some(b =>
        b.status === 'uploaded' || b.status === 'processing' ||
        (b.status === 'extracted' && !b.sale_number)
      );
      if (hasPending) fetchBills();
    }, 3000);
    return () => clearInterval(interval);
  }, [bills, engagementId]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !engagementId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        await fetch(`${API_BASE}/bill-of-sale/upload/${engagementId}`, {
          method: 'POST',
          body: formData,
        });
      } catch (err) {
        console.error("Upload failed for", file.name, err);
      }
    }
    setUploading(false);
    fetchBills();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      const resp = await fetch(`${API_BASE}/bill-of-sale/${fileToDelete}`, { method: 'DELETE' });
      if (resp.ok) {
        setBills(prev => prev.filter(b => b.id !== fileToDelete));
      } else {
        const err = await resp.json();
        alert("Failed to delete: " + (err.detail || "Unknown error"));
      }
    } catch (err) {
      alert("Error connecting to server.");
    } finally {
      setFileToDelete(null);
    }
  };

  const retryBill = async (id: number) => {
    try {
      await fetch(`${API_BASE}/bill-of-sale/retry/${id}`, { method: 'POST' });
      fetchBills();
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  const retryAll = async () => {
    if (!engagementId) return;
    try {
      await fetch(`${API_BASE}/bill-of-sale/retry-all/${engagementId}`, { method: 'POST' });
      fetchBills();
    } catch (err) {
      console.error("Retry all failed:", err);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bill of Sale Inbox</h1>
            <p className="text-slate-500">Upload and manage Bills of Sale for AI-powered extraction.</p>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onClick={handleUploadClick}
          className={`audit-card border-dashed border-2 py-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            uploading ? 'bg-slate-50 border-slate-300' : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
          }`}
        >
          <input
            type="file"
            multiple
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="bg-emerald-600 p-4 rounded-full text-white shadow-lg shadow-emerald-200/50 mb-4">
            {uploading ? <Loader2 size={32} className="animate-spin" /> : <Upload size={32} />}
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {uploading ? 'Uploading Bills of Sale...' : 'Upload New Bills of Sale'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mt-2">
            Click to <span className="text-emerald-600 font-bold">browse files</span> or drag and drop Bill of Sale PDFs here. Supports bulk upload.
          </p>
        </div>

        <div className="flex items-center justify-between border-b pb-1">
          <div className="flex items-center gap-6">
            <button className="text-sm font-bold text-emerald-600 border-b-2 border-emerald-600 pb-2 px-1">All Bills</button>
            <button className="text-sm font-medium text-slate-500 pb-2 px-1 hover:text-slate-700 transition-colors">Extracted</button>
            <button className="text-sm font-medium text-slate-500 pb-2 px-1 hover:text-slate-700 transition-colors">Processing</button>
            <button className="text-sm font-medium text-slate-500 pb-2 px-1 hover:text-slate-700 transition-colors">Failed</button>
          </div>
          {bills.some(b => b.status === 'failed') && (
            <button
              onClick={retryAll}
              className="flex items-center gap-2 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 transition-all mb-1"
            >
              <RotateCcw size={12} />
              Retry All Failed
            </button>
          )}
        </div>

        {/* Table */}
        <div className="audit-card p-0 overflow-x-auto bg-white shadow-xl shadow-slate-100 border-slate-200">
          <table className="w-full text-[11px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="audit-table-header text-center w-10">#</th>
                <th className="audit-table-header">File Name</th>
                <th className="audit-table-header">Sale Number</th>
                <th className="audit-table-header">Sale Date</th>
                <th className="audit-table-header">Buyer Name</th>
                <th className="audit-table-header">Buyer GSTIN</th>
                <th className="audit-table-header text-right">Taxable Val</th>
                <th className="audit-table-header text-right">CGST</th>
                <th className="audit-table-header text-right">SGST</th>
                <th className="audit-table-header text-right">IGST</th>
                <th className="audit-table-header text-right">Total Value</th>
                <th className="audit-table-header text-right px-4">Match Status</th>
                <th className="audit-table-header text-right px-8">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={13} className="py-20 text-center text-slate-400 italic font-medium text-sm">No bills of sale uploaded yet.</td></tr>
              ) : bills.map((b, i) => (
                <tr key={b.id} className="hover:bg-emerald-50/30 group transition-colors border-b border-slate-100 last:border-0">
                  <td className="audit-table-cell text-center text-slate-400 font-mono">{i + 1}</td>
                  <td className="audit-table-cell">
                    <div className="flex items-center gap-2 max-w-[150px] overflow-hidden">
                      <Receipt size={14} className="text-emerald-500 shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">{b.filename}</span>
                    </div>
                  </td>
                  <td className="audit-table-cell font-mono text-slate-600 uppercase">{b.sale_number || '—'}</td>
                  <td className="audit-table-cell text-slate-500">
                    {b.sale_date ? new Date(b.sale_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="audit-table-cell font-bold text-slate-800">{b.buyer_name || '—'}</td>
                  <td className="audit-table-cell font-mono text-[10px] text-slate-500">{b.buyer_gstin || '—'}</td>
                  <td className="audit-table-cell text-right font-medium text-slate-600">
                    {b.taxable_value ? `₹${b.taxable_value.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="audit-table-cell text-right text-slate-500">
                    {b.cgst ? `₹${b.cgst.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="audit-table-cell text-right text-slate-500">
                    {b.sgst ? `₹${b.sgst.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="audit-table-cell text-right text-slate-500">
                    {b.igst ? `₹${b.igst.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="audit-table-cell text-right font-black text-slate-900 border-r border-slate-50">
                    {b.total_value ? `₹${b.total_value.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="audit-table-cell text-right">
                    <div className="flex items-center justify-end">
                      {b.match_status ? (
                        <div className="flex items-center gap-1.5">
                          {b.match_status === 'matched' ? (
                            <CheckCircle size={12} className="text-emerald-500" />
                          ) : (
                            <AlertCircle size={12} className="text-rose-500" />
                          )}
                          <span className={`text-[9px] font-black uppercase tracking-tighter ${
                            b.match_status === 'matched' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {b.match_status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ) : b.status === 'extracted' ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={12} className="text-emerald-500" />
                          <span className="text-[9px] font-black uppercase tracking-tighter text-emerald-600">Extracted</span>
                        </div>
                      ) : b.status === 'failed' ? (
                        <div className="flex items-center gap-1.5 text-rose-600">
                          <AlertCircle size={12} />
                          <span className="text-[9px] font-black uppercase tracking-tighter">Failed</span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-400 uppercase italic flex items-center gap-1.5">
                          <Loader2 size={10} className="animate-spin" />
                          Processing...
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="audit-table-cell text-right px-8">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {b.status === 'failed' && (
                        <button
                          onClick={() => retryBill(b.id)}
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-600 transition-colors"
                          title="Retry Extraction"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <a
                        href={`http://localhost:8000/storage/${engagementId}/bills_of_sale/${b.filename}`}
                        target="_blank"
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                        title="View PDF"
                      >
                        <Eye size={14} />
                      </a>
                      <button
                        onClick={() => setFileToDelete(b.id)}
                        className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-100 p-2 rounded-full text-rose-600">
                    <AlertCircle size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Delete Bill of Sale</h3>
                </div>
                <button onClick={() => setFileToDelete(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <p className="text-slate-600">
                Are you sure you want to permanently delete this Bill of Sale? This action will remove the physical PDF and all extracted data. This cannot be undone.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setFileToDelete(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-md shadow-rose-200 transition-colors flex items-center gap-2">
                <Trash2 size={16} />
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
