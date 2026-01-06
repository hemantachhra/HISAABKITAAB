import React, { useState, useEffect, useRef } from 'react';
import { DB } from '../db';

const SettingsPage: React.FC = () => {
  const [stats, setStats] = useState({ invoices: 0, ledgers: 0, receipts: 0, version: '1' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshStats = () => {
    setStats(DB.getStats());
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleExport = () => {
    const backup = DB.getFullBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Challan_Kitab_Backup.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (DB.restoreBackup(json)) {
          alert("Backup Restored!");
          window.location.href = window.location.origin + window.location.pathname;
        } else {
          alert("Invalid backup file.");
        }
      } catch (err) {
        alert("Error reading file.");
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    // Explicit warning before anything happens
    const confirmed = window.confirm("⚠️ FATAL: ERASE ALL DATA? ⚠️\n\nThis will wipe your current bookkeeping book completely. This action IS IRREVERSIBLE.");
    
    if (confirmed) {
      // 1. Wipe the data
      DB.clearAll();
      
      // 2. Update local display state immediately to show 0
      setStats({ invoices: 0, ledgers: 0, receipts: 0, version: '1' });
      
      // 3. Short delay before redirect to allow state update to be visible
      setTimeout(() => {
        window.location.replace(window.location.origin + window.location.pathname);
      }, 500);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-8">
      <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-2xl font-black uppercase mb-6 italic border-b-2 border-black pb-2">Storage Status</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="border-2 border-black p-3 bg-indigo-50">
            <div className="text-2xl font-black">{stats.invoices}</div>
            <div className="text-[8px] font-bold uppercase text-gray-500 tracking-tighter">Invoices</div>
          </div>
          <div className="border-2 border-black p-3 bg-green-50">
            <div className="text-2xl font-black">{stats.receipts}</div>
            <div className="text-[8px] font-bold uppercase text-gray-500 tracking-tighter">Receipts</div>
          </div>
          <div className="border-2 border-black p-3 bg-orange-50">
            <div className="text-2xl font-black">{stats.ledgers}</div>
            <div className="text-[8px] font-bold uppercase text-gray-500 tracking-tighter">Parties</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button 
          onClick={handleExport} 
          className="w-full bg-black text-white p-5 font-black uppercase tracking-widest text-sm border-b-8 border-gray-700 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          Export Backup
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="w-full bg-white text-black border-4 border-black p-5 font-black uppercase tracking-widest text-sm border-b-8 border-gray-300 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          Import Backup
        </button>
        <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
        
        <div className="pt-24">
          <button 
            onClick={handleReset} 
            className="w-full bg-red-600 text-white p-6 font-black uppercase tracking-widest text-xl border-b-[12px] border-red-900 active:border-b-0 active:translate-y-3"
          >
            ERASE ALL DATA
          </button>
          <p className="mt-4 text-center text-[10px] font-black text-red-600 uppercase tracking-widest animate-pulse">
            💥 WARNING: Permanent deletion of all records 💥
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;