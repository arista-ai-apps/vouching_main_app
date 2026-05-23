"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Upload, FileSpreadsheet, Check, Info, Loader2, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { API_BASE } from "@/config";

export default function RegisterUpload() {
  const [uploading, setUploading] = useState(false);
  const [registerInfo, setRegisterInfo] = useState<{filename: string, rows: number} | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engagementId, setEngagementId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 1. Fetch first available engagement
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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        setRegisterInfo({ filename: data.filename, rows: data.rows });
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

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/reconcile/${engagementId}`, {
        method: 'POST',
      });
      if (resp.ok) {
        router.push('/vouching'); // Go back to inbox to see results
      } else {
        setError("Reconciliation failed. Check server logs.");
      }
    } catch (err) {
      setError("Network error during reconciliation.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Register Upload</h1>
          <p className="text-slate-500">Upload your Purchase or Sales register (Excel/CSV) for reconciliation.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {!registerInfo ? (
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
              {uploading ? 'Analyzing Register...' : 'Upload Register File'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mt-2">
              Select your purchase register data. Arista AI will automatically map fields and detect anomalies.
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
                  <Check size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">{registerInfo.filename}</p>
                  <p className="text-xs text-emerald-600 font-medium">{registerInfo.rows} audit records detected</p>
                </div>
              </div>
              <button 
                onClick={() => setRegisterInfo(null)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline transition-colors"
              >
                Change File
              </button>
            </div>

            <div className="audit-card">
              <h3 className="font-bold text-slate-800 mb-6 text-sm uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                Automatic Field Mapping
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Invoice Number', field: 'Invoice No' },
                  { label: 'Invoice Date', field: 'Date' },
                  { label: 'Vendor Name', field: 'Supplier' },
                  { label: 'Total Value', field: 'Gross_Amt' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-tight">{item.label}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">Auto-Detected</span>
                        <select className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 w-48 font-medium">
                           <option>{item.field}</option>
                           <option>Party_Name</option>
                           <option>GST_No</option>
                        </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex flex-col items-center gap-4">
                <button 
                  onClick={handleProcess}
                  disabled={processing}
                  className={`w-full py-4 rounded-xl font-black text-sm shadow-xl transition-all flex items-center justify-center gap-3 ${
                    processing 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  {processing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      RECONCILING AUDIT DATA...
                    </>
                  ) : (
                    <>
                      START RECONCILIATION ENGINE
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 font-medium italic">
                  * This will match {registerInfo.rows} entries from the register against the uploaded vouchers.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
