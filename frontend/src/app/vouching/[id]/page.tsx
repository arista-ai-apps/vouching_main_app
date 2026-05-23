"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Save, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

export default function ReviewConsole() {
  const [formData, setFormData] = useState({
    invoice_number: 'INV/2024/001',
    invoice_date: '2026-03-25',
    vendor_name: 'Reliance Retail Limited',
    vendor_gstin: '27AAACR1234F1Z1',
    taxable_value: '10550.00',
    cgst: '950.00',
    sgst: '950.00',
    igst: '0.00',
    total_value: '12450.00',
  });

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Sidebar Tool Nav */}
      <div className="w-14 bg-slate-950 flex flex-col items-center py-4 border-r border-slate-800 space-y-6">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold cursor-pointer">A</div>
        <div className="flex-1 space-y-4">
           {/* Sidebar actions... */}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-6 justify-between text-white">
          <div className="flex items-center gap-4">
            <Link href="/vouching" className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white">
              <ChevronLeft size={20} />
            </Link>
            <div>
               <h2 className="text-sm font-bold">Reviewing: INV_2024_001.pdf</h2>
               <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Extracted by Arista AI Engine v1.2</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-emerald-900/30 text-emerald-400 border border-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
               <CheckCircle size={14} />
               Extraction Confidence: 98.4%
            </div>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/50">
               <Save size={16} />
               Verify & Approve
            </button>
          </div>
        </header>

        {/* Main Split Console */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: PDF Viewer (Mock) */}
          <div className="flex-1 bg-slate-800 relative flex flex-col">
             <div className="p-2 border-b border-slate-700 flex justify-center gap-4 text-xs text-slate-400">
                <button className="hover:text-white">Zoom In</button>
                <button className="hover:text-white">Zoom Out</button>
                <span>Page 1 of 1</span>
             </div>
             <div className="flex-1 overflow-auto p-8 flex justify-center">
                <div className="w-full max-w-[800px] bg-white shadow-2xl min-h-[1000px] p-12 text-slate-900 relative">
                   {/* Visual Overlay Marker */}
                   <div className="absolute top-[80px] left-[500px] w-48 h-8 border-2 border-blue-500 bg-blue-500/10 pointer-events-none rounded transition-all">
                      <div className="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-0.5 text-[8px] font-bold rounded uppercase">Invoice #</div>
                   </div>

                   <header className="flex justify-between border-b pb-8">
                      <div>
                         <h1 className="text-2xl font-black text-blue-800">RELIANCE RETAIL</h1>
                         <p className="text-xs text-slate-500">Opp. Civic Centre, Mumbai 400001</p>
                         <p className="text-[10px] font-bold mt-2">GSTIN: 27AAACR1234F1Z1</p>
                      </div>
                      <div className="text-right">
                         <h2 className="text-xl font-bold">TAX INVOICE</h2>
                      </div>
                   </header>
                   
                   <div className="mt-8 grid grid-cols-2 gap-12 text-sm">
                      <div className="space-y-4">
                        <section>
                          <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b mb-1">Bill To</h4>
                          <p className="font-bold">Acme Corp Private Limited</p>
                          <p className="text-xs text-slate-500">Plot 5, IT Park, Pune</p>
                        </section>
                      </div>
                      <div className="space-y-2 text-right">
                         <p><span className="text-slate-400 font-bold mr-2 uppercase text-[10px]">Invoice No:</span> <span className="font-bold">INV/2024/001</span></p>
                         <p><span className="text-slate-400 font-bold mr-2 uppercase text-[10px]">Date:</span> <span className="font-bold">25-03-2026</span></p>
                      </div>
                   </div>

                   <div className="mt-12">
                      <table className="w-full border-t border-b">
                         <thead className="text-[10px] uppercase text-slate-400 border-b">
                            <tr>
                               <th className="py-2 text-left">Description</th>
                               <th className="py-2 text-center w-16">Qty</th>
                               <th className="py-2 text-right w-24">Rate</th>
                               <th className="py-2 text-right w-24">Amount</th>
                            </tr>
                         </thead>
                         <tbody className="text-xs">
                            <tr>
                               <td className="py-3 border-b">MacBook Pro M3 Max 14-inch</td>
                               <td className="py-3 text-center border-b">1</td>
                               <td className="py-3 text-right border-b">199,999.00</td>
                               <td className="py-3 text-right border-b">199,999.00</td>
                            </tr>
                         </tbody>
                      </table>
                   </div>

                   <div className="mt-8 flex justify-end">
                      <div className="w-64 space-y-2">
                         <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Subtotal</span>
                            <span className="font-bold">₹10,550.00</span>
                         </div>
                         <div className="flex justify-between text-xs text-slate-400">
                            <span>CGST (9%)</span>
                            <span>₹950.00</span>
                         </div>
                         <div className="flex justify-between text-xs text-slate-400">
                            <span>SGST (9%)</span>
                            <span>₹950.00</span>
                         </div>
                         <div className="flex justify-between text-lg font-black border-t pt-2 text-blue-800">
                            <span>Total</span>
                            <span>₹12,450.00</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Right: Field Editor */}
          <div className="w-[450px] bg-white border-l border-slate-200 flex flex-col shadow-2xl">
              <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                 <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Verification Panel</h3>
                 <button className="text-blue-600 hover:text-blue-800">
                    <ExternalLink size={16} />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 p-1 px-2 border-l-2 border-slate-300">Basic Details</h4>
                    <div className="grid gap-4">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Number</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:bg-white transition-all outline-none font-medium"
                            value={formData.invoice_number}
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Date</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:bg-white transition-all outline-none"
                            value={formData.invoice_date}
                          />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 p-1 px-2 border-l-2 border-slate-300">Entity Information</h4>
                    <div className="grid gap-4">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vendor Name</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm outline-none font-bold text-slate-800"
                            value={formData.vendor_name}
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vendor GSTIN</label>
                          <div className="flex gap-2">
                             <input 
                                type="text" 
                                className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm font-mono"
                                value={formData.vendor_gstin}
                             />
                             <button className="bg-slate-100 p-2 rounded hover:bg-slate-200 text-slate-500">
                                <AlertTriangle size={16} />
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 p-1 px-2 border-l-2 border-slate-300">Financial Breakdown</h4>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Taxable Value</label>
                          <div className="relative">
                             <span className="absolute left-3 top-2 text-slate-400 text-sm">₹</span>
                             <input 
                               type="text" 
                               className="w-full bg-slate-50 border border-slate-200 rounded pl-7 pr-3 py-2 text-sm font-bold"
                               value={formData.taxable_value}
                             />
                          </div>
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CGST</label>
                          <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm" value={formData.cgst} />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SGST</label>
                          <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm" value={formData.sgst} />
                       </div>
                       <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Invoice Value</label>
                          <div className="relative">
                             <span className="absolute left-3 top-2 text-blue-500 text-sm font-bold">₹</span>
                             <input 
                               type="text" 
                               className="w-full bg-blue-50 border border-blue-200 rounded pl-7 pr-3 py-2 text-lg font-black text-blue-900"
                               value={formData.total_value}
                             />
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="p-2"></div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
