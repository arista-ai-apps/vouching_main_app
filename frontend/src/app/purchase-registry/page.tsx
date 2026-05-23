"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { FileSpreadsheet, Info, Loader2, AlertCircle, Trash2, FileText, CheckCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { API_BASE } from "@/config";

export default function PurchaseRegistry() {
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [registerInfo, setRegisterInfo] = useState<{id: number, filename: string, rows: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engagementId, setEngagementId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch first available engagement
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
          if (data && data.length > 0) {
            setEngagementId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch engagements:", err);
      }
    };
    init();
  }, []);

  const fetchRegistry = async () => {
    if (!engagementId) return;
    setLoading(true);
    try {
      // Fetch register rows first — declare outside so it's available below
      let rowsData: any[] = [];
      const rowsResp = await fetch(`${API_BASE}/registers/${engagementId}/rows`);
      if (rowsResp.ok) {
        rowsData = await rowsResp.json();
        setRows(rowsData);
      }

      // Fetch register metadata
      const regResp = await fetch(`${API_BASE}/registers/${engagementId}`);
      if (regResp.ok) {
        const regData = await regResp.json();
        if (regData && regData.length > 0) {
          const latestReg = regData[0];
          setRegisterInfo({ id: latestReg.id, filename: latestReg.filename, rows: rowsData.length });
        }
      }
    } catch (err) {
      console.error("Failed to fetch registry:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (engagementId) {
      fetchRegistry();
    }
  }, [engagementId]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engagementId) return;

    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${API_BASE}/registers/upload/${engagementId}`, {
        method: 'POST',
        body: formData,
      });
      
      if (resp.ok) {
        const data = await resp.json();
        setRegisterInfo({ id: data.id, filename: data.filename, rows: data.rows });
        // After upload, fetch rows to populate table
        fetchRegistry();
      } else {
        const errData = await resp.json();
        setError(errData.detail || "Failed to upload register");
      }
    } catch (err) {
      setError("Connection error. Is the backend running?");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Registry</h1>
          <p className="text-slate-500">Upload and view your Purchase register excel data.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {loading ? (
           <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : rows.length === 0 ? (
          <div 
            onClick={handleUploadClick}
            className={`audit-card border-dashed border-2 py-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              uploading ? 'bg-slate-50 border-slate-300' : 'bg-slate-50 border-slate-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />
            <div className={`p-4 rounded-full text-white mb-4 shadow-lg ${uploading ? 'bg-blue-600' : 'bg-slate-800'}`}>
              {uploading ? <Loader2 size={32} className="animate-spin" /> : <FileSpreadsheet size={32} />}
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {uploading ? 'Analyzing Register...' : 'Upload Purchase Registry File'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mt-2">
              Select your purchase register data. Arista AI will automatically map fields.
            </p>
            {!uploading && (
              <button className="mt-6 bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-md active:scale-95">
                Select Excel File
              </button>
            )}
            <p className="mt-8 text-[10px] text-slate-400 uppercase font-black flex items-center gap-2">
              <Info size={12} />
              Required columns: Invoice No, Date, Vendor Name, Taxable, Total
            </p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="audit-card bg-emerald-50 border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 p-1 rounded-full text-white shadow-sm">
                  <CheckCircle size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">{registerInfo?.filename || 'Register Uploaded'}</p>
                  <p className="text-xs text-emerald-600 font-medium">{rows.length} records populated successfully</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleUploadClick}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline transition-colors"
                >
                  Upload Replacement
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".xlsx,.xls,.csv" 
                  className="hidden" 
                />
              </div>
            </div>

            {/* Registry Table */}
            <div className="bg-white rounded-xl shadow-xl shadow-slate-100 border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <FileText size={18} className="text-emerald-500" />
                   Purchase Registry Data
                 </h3>
                 <div className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                   {rows.length} rows loaded
                 </div>
               </div>
               
               <div className="overflow-x-auto max-h-[600px] overflow-y-auto w-full relative">
                 <table className="w-full text-[11px] whitespace-nowrap">
                    <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm border-b border-slate-200">
                      <tr>
                        <th className="audit-table-header text-center w-10">#</th>
                        <th className="audit-table-header">Inv Number</th>
                        <th className="audit-table-header">Inv Date</th>
                        <th className="audit-table-header">Vendor Name</th>
                        <th className="audit-table-header">GSTIN</th>
                        <th className="audit-table-header text-right">Taxable Val</th>
                        <th className="audit-table-header text-right">Total Val</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                          <td className="audit-table-cell text-center text-slate-400 font-mono">{i + 1}</td>
                          <td className="audit-table-cell font-mono text-slate-700 font-medium">{row.invoice_number || '—'}</td>
                          <td className="audit-table-cell text-slate-500">
                            {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="audit-table-cell font-semibold text-slate-800">{row.vendor_name || '—'}</td>
                          <td className="audit-table-cell font-mono text-[10px] text-slate-500">{row.vendor_gstin || '—'}</td>
                          <td className="audit-table-cell text-right text-slate-600">
                            {row.taxable_value ? `₹${row.taxable_value.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="audit-table-cell text-right font-black text-slate-900 border-l border-slate-50">
                            {row.total_value ? `₹${row.total_value.toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
