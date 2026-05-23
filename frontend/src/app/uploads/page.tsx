"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { 
  FileSpreadsheet, 
  CloudUpload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Eye, 
  ShoppingBag, 
  TrendingUp, 
  Search,
  Info,
  X,
  FileText
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { API_BASE } from "@/config";

interface RegistryStatus {
  loaded: boolean;
  filename: string;
  rowCount: number;
}

export default function UploadsPortal() {
  const [engagementId, setEngagementId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseStatus, setPurchaseStatus] = useState<RegistryStatus>({ loaded: false, filename: '', rowCount: 0 });
  const [salesStatus, setSalesStatus] = useState<RegistryStatus>({ loaded: false, filename: '', rowCount: 0 });
  const [gstr2bStatus, setGstr2bStatus] = useState<RegistryStatus>({ loaded: false, filename: '', rowCount: 0 });
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  
  // Inline Viewer States
  const [activeViewer, setActiveViewer] = useState<string | null>(null);
  const [viewerRows, setViewerRows] = useState<any[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadType, setCurrentUploadType] = useState<string | null>(null);

  // 1. Initialize Engagement Context
  useEffect(() => {
    const eid = localStorage.getItem('engagementId');
    if (eid) setEngagementId(parseInt(eid));
    else {
        fetch(`${API_BASE}/engagements/`)
            .then(r => r.json())
            .then(data => { if(data?.length) setEngagementId(data[0].id) });
    }
  }, []);

  // 2. Fetch Statuses
  const fetchStatuses = async () => {
    if (!engagementId) return;
    setLoading(true);
    try {
      const [pReg, sReg, gReg, pRows, sRows, gRows] = await Promise.all([
        fetch(`${API_BASE}/registers?engagement_id=${engagementId}&register_type=purchase`),
        fetch(`${API_BASE}/registers?engagement_id=${engagementId}&register_type=sales`),
        fetch(`${API_BASE}/registers?engagement_id=${engagementId}&register_type=gstr2b`),
        fetch(`${API_BASE}/registers/${engagementId}/rows`),
        fetch(`${API_BASE}/registers/sales/${engagementId}/rows`),
        fetch(`${API_BASE}/registers/gstr2b/${engagementId}/rows`),
      ]);

      const pData = await pReg.json();
      const sData = await sReg.json();
      const gData = await gReg.json();
      const pRowsData = await pRows.json();
      const sRowsData = await sRows.json();
      const gRowsData = await gRows.json();

      setPurchaseStatus({
        loaded: pData && pData.length > 0,
        filename: pData && pData.length > 0 ? pData[0].filename : '',
        rowCount: pRowsData.length
      });

      setSalesStatus({
        loaded: sData && sData.length > 0,
        filename: sData && sData.length > 0 ? sData[0].filename : '',
        rowCount: sRowsData.length
      });

      setGstr2bStatus({
        loaded: gData && gData.length > 0,
        filename: gData && gData.length > 0 ? gData[0].filename : '',
        rowCount: gRowsData.length
      });

      // If a viewer is active, refresh its rows too
      if (activeViewer) fetchViewerRows(activeViewer, false);

    } catch (err) {
      console.error("Failed to fetch registry statuses:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchViewerRows = async (type: string, showLoader = true) => {
    if (!engagementId) return;
    if (showLoader) setViewerLoading(true);
    try {
        let endpoint = "";
        if (type === 'purchase') endpoint = `${API_BASE}/registers/${engagementId}/rows`;
        else if (type === 'sales') endpoint = `${API_BASE}/registers/sales/${engagementId}/rows`;
        else if (type === 'gstr2b') endpoint = `${API_BASE}/registers/gstr2b/${engagementId}/rows`;

        const resp = await fetch(endpoint);
        if (resp.ok) setViewerRows(await resp.json());
    } catch (err) {
        console.error("Failed to fetch viewer rows:", err);
    } finally {
        setViewerLoading(false);
    }
  };

  useEffect(() => {
    if (engagementId) fetchStatuses();
  }, [engagementId]);

  const handleUploadClick = (type: string) => {
    setCurrentUploadType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engagementId || !currentUploadType) return;

    setUploadingType(currentUploadType);
    const formData = new FormData();
    formData.append("file", file);

    let endpoint = "";
    if (currentUploadType === 'purchase') endpoint = `${API_BASE}/registers/upload/${engagementId}`;
    else if (currentUploadType === 'sales') endpoint = `${API_BASE}/registers/upload-sales/${engagementId}`;
    else if (currentUploadType === 'gstr2b') endpoint = `${API_BASE}/registers/upload-gstr2b/${engagementId}`;

    try {
      const resp = await fetch(endpoint, { method: 'POST', body: formData });
      if (resp.ok) await fetchStatuses();
    } catch (err) {
      alert("Error connecting to backend.");
    } finally {
      setUploadingType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleView = (type: string) => {
    if (activeViewer === type) {
        setActiveViewer(null);
        setViewerRows([]);
    } else {
        setActiveViewer(type);
        fetchViewerRows(type);
    }
  };

  const Card = ({ title, status, icon: Icon, type }: { title: string, status: RegistryStatus, icon: any, type: string }) => (
    <div className={`audit-card bg-white p-5 relative overflow-hidden group hover:border-blue-500 transition-all ${activeViewer === type ? 'ring-2 ring-blue-500 border-transparent shadow-xl' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-slate-900 rounded-lg text-white">
             <Icon size={18} />
           </div>
           <div>
             <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none">{title}</h3>
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Audit Input</p>
           </div>
        </div>
        <div>
           {status.loaded ? (
             <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wider border border-emerald-100">
                <CheckCircle size={10} /> READY
             </span>
           ) : (
             <span className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-black uppercase tracking-wider border border-rose-100">
                <AlertCircle size={10} /> MISSING
             </span>
           )}
        </div>
      </div>

      <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg py-2 px-3 mb-4">
         <div className="flex-1 truncate mr-2">
            <p className="text-[8px] text-slate-400 font-black uppercase mb-0.5">Filename</p>
            <p className="text-[10px] font-bold text-slate-700 truncate">{status.loaded ? status.filename : 'Waiting...'}</p>
         </div>
         <div className="text-right">
            <p className="text-[8px] text-slate-400 font-black uppercase mb-0.5">Records</p>
            <p className="text-[10px] font-black text-blue-600 tabular-nums">{status.rowCount}</p>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => handleView(type)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black transition-all ${
                activeViewer === type ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Eye size={12} /> {activeViewer === type ? 'CLOSE' : 'VIEW DATA'}
          </button>
          <button 
            onClick={() => handleUploadClick(type)}
            disabled={!!uploadingType}
            className="flex items-center justify-center gap-1.5 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black hover:bg-black transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {uploadingType === type ? <Loader2 size={12} className="animate-spin" /> : <CloudUpload size={12} />}
            {status.loaded ? 'UPDATE' : 'UPLOAD'}
          </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase tracking-[0.1em]">Registry Upload Portal</h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 border px-3 py-1.5 rounded-lg border-slate-200">
             <Info size={12} />
             ALL DATA IS SCOPED TO THE CURRENT AUDIT ENGAGEMENT
          </div>
        </div>

        {loading && !uploadingType && !activeViewer ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card title="Purchase Registry" status={purchaseStatus} icon={ShoppingBag} type="purchase" />
            <Card title="Sales Registry" status={salesStatus} icon={TrendingUp} type="sales" />
            <Card title="GSTR-2B Registry" status={gstr2bStatus} icon={Search} type="gstr2b" />
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".xlsx,.xls,.csv" 
          className="hidden" 
        />
        
        {/* Inline Data Viewer Section */}
        {activeViewer && (
            <div className="animate-in slide-in-from-top-4 duration-500 overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xl">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg text-white">
                            <FileText size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase">
                                Inline Viewer: {activeViewer === 'purchase' ? 'Purchase Registry' : activeViewer === 'sales' ? 'Sales Registry' : 'GSTR-2B Registry'}
                            </h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Live Data Stream</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setActiveViewer(null); setViewerRows([]); }}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-900"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-0 overflow-x-auto max-h-[500px] overflow-y-auto relative">
                    {viewerLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <Loader2 size={32} className="animate-spin text-blue-600" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Streaming Records...</p>
                        </div>
                    ) : viewerRows.length === 0 ? (
                        <div className="py-20 text-center space-y-3">
                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                <Search size={24} />
                            </div>
                            <p className="text-sm font-bold text-slate-500">No data records found in this registry.</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Upload a file to populate this table</p>
                        </div>
                    ) : (
                        <table className="w-full text-[11px] whitespace-nowrap">
                            <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">#</th>
                                    <th className="px-4 py-3 text-left font-black text-slate-800 uppercase tracking-widest bg-slate-50 border-b border-slate-100">Invoice No</th>
                                    <th className="px-4 py-3 text-left font-black text-slate-800 uppercase tracking-widest bg-slate-50 border-b border-slate-100">Date</th>
                                    <th className="px-4 py-3 text-left font-black text-slate-800 uppercase tracking-widest bg-slate-50 border-b border-slate-100">Name</th>
                                    <th className="px-4 py-3 text-left font-black text-slate-800 uppercase tracking-widest bg-slate-50 border-b border-slate-100">GSTIN</th>
                                    <th className="px-4 py-3 text-right font-black text-slate-800 uppercase tracking-widest bg-slate-50 border-b border-slate-100">Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewerRows.map((row, i) => (
                                    <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-blue-50/30 transition-colors">
                                        <td className="px-4 py-3 text-slate-400 font-mono italic">{i + 1}</td>
                                        <td className="px-4 py-3 font-bold text-slate-700 font-mono tracking-tighter">{row.invoice_number || row.sale_number || "—"}</td>
                                        <td className="px-4 py-3 font-bold text-slate-500">
                                            {row.invoice_date || row.sale_date ? new Date(row.invoice_date || row.sale_date).toLocaleDateString('en-IN') : "—"}
                                        </td>
                                        <td className="px-4 py-3 font-black text-slate-800">{row.vendor_name || row.buyer_name || "—"}</td>
                                        <td className="px-4 py-3 font-mono text-slate-500 tracking-tight text-[10px] uppercase">
                                            {row.vendor_gstin || row.buyer_gstin || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-blue-600 bg-slate-50/30">
                                            {row.total_value ? `₹${row.total_value.toLocaleString('en-IN')}` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                
                <div className="p-4 border-top border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Displaying {viewerRows.length} most recent records</p>
                    <div className="flex gap-2">
                        <button className="text-[10px] font-black text-blue-600 bg-white border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">EXPORT DATA</button>
                    </div>
                </div>
            </div>
        )}

        <div className="audit-card bg-slate-900 text-white p-6 overflow-hidden relative opacity-80 group">
           <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tighter mb-1 uppercase tracking-widest">3-Way Match Synchronizer</h3>
                <p className="text-slate-400 text-[11px] max-w-xl font-medium leading-relaxed">
                  Arista AI automatically compares Purchase, Sales, and GSTR-2B datasets once they are uploaded. 
                  Upload status updates in real-time as background processing completes.
                </p>
              </div>
              <CloudUpload size={48} className="text-slate-800 group-hover:text-blue-900 transition-colors duration-500" />
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
