import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../db.ts';
import { Ledger, Invoice, Receipt } from '../types.ts';

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'balances' | 'summary'>('balances');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filterName, setFilterName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  
  const formatDDMMYY = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y.slice(-2)}`;
  };

  useEffect(() => {
    setLedgers(DB.getLedgers());
    setInvoices(DB.getInvoices());
    setReceipts(DB.getReceipts());
  }, []);

  const dashboardStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const dailySales = invoices.filter(i => i.date === today).reduce((sum, i) => sum + i.grandTotal, 0);
    const dailyCash = receipts.filter(r => r.date === today).reduce((sum, r) => sum + Number(r.amount), 0);
    const totalReceivable = ledgers.reduce((sum, l) => {
      const d = invoices.filter(i => i.ledgerId === l.id).reduce((s, i) => s + i.grandTotal, 0);
      const c = receipts.filter(r => r.ledgerId === l.id).reduce((s, r) => s + Number(r.amount), 0);
      return sum + Math.max(0, d - c);
    }, 0);
    return { dailySales, dailyCash, totalReceivable };
  }, [invoices, receipts, ledgers]);

  const ledgerMap = useMemo(() => {
    const map: Record<string, string> = {};
    ledgers.forEach(l => map[l.id] = l.name);
    return map;
  }, [ledgers]);

  const suggestions = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    if (!q) return [];
    const uniqueNames = Array.from(new Set(ledgers.map(l => l.name.toUpperCase()))) as string[];
    return uniqueNames
      .filter(name => name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [filterName, ledgers]);

  const summaries = useMemo(() => {
    const data = ledgers.map(l => {
      const lid = l.id;
      const d = invoices.filter(i => i.ledgerId === lid).reduce((s, i) => s + i.grandTotal, 0);
      const c = receipts.filter(r => r.ledgerId === lid).reduce((s, r) => s + Number(r.amount), 0);
      return { id: l.id, name: l.name, debit: d, credit: c, closing: d - c };
    });
    
    const grouped = data.reduce((acc, curr) => {
      const name = curr.name.toUpperCase();
      if (!acc[name]) { acc[name] = { ...curr }; } 
      else {
        acc[name].debit += curr.debit;
        acc[name].credit += curr.credit;
        acc[name].closing += curr.closing;
      }
      return acc;
    }, {} as Record<string, any>);

    let res = Object.values(grouped);
    if (filterName) res = res.filter((s: any) => s.name.toLowerCase().includes(filterName.toLowerCase()));
    return res.sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [ledgers, invoices, receipts, filterName]);

  const history = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    let items = [
      ...invoices.map(i => ({
        id: i.id, date: i.date, type: 'INV', no: i.serialNo, 
        name: ledgerMap[i.ledgerId] || 'Unknown',
        debit: i.grandTotal, credit: 0
      })),
      ...receipts.map(r => ({
        id: r.id, date: r.date, type: 'RCT', no: null, 
        name: ledgerMap[r.ledgerId] || 'Unknown',
        debit: 0, credit: Number(r.amount)
      }))
    ];
    items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    
    const filtered = items.filter(t => {
      const nameMatch = !q || t.name.toLowerCase().includes(q);
      const dateMatch = (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate);
      return nameMatch && dateMatch;
    });
    
    let runningBal = 0;
    return filtered.map(t => {
      runningBal += (t.debit - t.credit);
      return { ...t, balance: runningBal };
    });
  }, [invoices, receipts, ledgerMap, filterName, startDate, endDate]);

  const shareReport = () => {
    let msg = `*CK REPORT - ${new Date().toLocaleDateString()}*\n\n`;
    if (activeTab === 'balances') {
      msg += `*LEDGER BALANCES*\n`;
      summaries.filter(s => s.closing !== 0).forEach(s => {
        msg += `${s.name}: ₹${formatNum(Math.abs(s.closing))} ${s.closing > 0 ? 'DR' : 'CR'}\n`;
      });
    } else {
      msg += `*STATEMENT: ${filterName || 'ALL'}*\n`;
      history.slice(-10).forEach(t => {
        msg += `${formatDDMMYY(t.date)}: ${t.debit > 0 ? 'DR '+formatNum(t.debit) : 'CR '+formatNum(t.credit)}\n`;
      });
      if (history.length > 0) msg += `\n*Final Bal: ₹${formatNum(history[history.length-1].balance)}*`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-40">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-indigo-600 text-white p-3 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-[8px] font-black uppercase opacity-70">Sales Today</div>
          <div className="text-sm font-black truncate">₹{formatNum(dashboardStats.dailySales)}</div>
        </div>
        <div className="bg-green-600 text-white p-3 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-[8px] font-black uppercase opacity-70">Cash Today</div>
          <div className="text-sm font-black truncate">₹{formatNum(dashboardStats.dailyCash)}</div>
        </div>
        <div className="bg-black text-white p-3 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-[8px] font-black uppercase opacity-70">Total Due</div>
          <div className="text-sm font-black truncate">₹{formatNum(dashboardStats.totalReceivable)}</div>
        </div>
      </div>

      <div className="bg-white border-2 border-black p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
        <div className="relative">
          <input 
            type="text" 
            autoComplete="off"
            value={filterName} 
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onChange={e => { setFilterName(e.target.value); setShowSuggestions(true); }} 
            placeholder="SEARCH CUSTOMER..." 
            className="w-full border-b-2 border-black p-2 font-black uppercase text-lg bg-transparent focus:outline-none" 
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-[100] w-full bg-white border-2 border-black mt-1 shadow-2xl max-h-48 overflow-y-auto">
              {suggestions.map((name, idx) => (
                <div 
                  key={idx} 
                  onClick={() => { setFilterName(name); setShowSuggestions(false); }} 
                  className="p-3 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-sm"
                >
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('balances')} className={`flex-1 py-2 font-black text-[10px] uppercase border-2 border-black ${activeTab === 'balances' ? 'bg-black text-white' : 'bg-white'}`}>Balances</button>
          <button onClick={() => setActiveTab('summary')} className={`flex-1 py-2 font-black text-[10px] uppercase border-2 border-black ${activeTab === 'summary' ? 'bg-black text-white' : 'bg-white'}`}>Ledger</button>
        </div>
      </div>

      <div className="bg-white border-2 border-black overflow-x-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <table className="w-full text-[10px] uppercase">
          {activeTab === 'balances' ? (
            <>
              <thead className="bg-gray-50 border-b-2 border-black font-black">
                <tr><th className="p-2 text-left">Party</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2 text-right">Net</th></tr>
              </thead>
              <tbody>
                {summaries.map((s: any, i) => (
                  <tr key={i} className="border-b last:border-0 font-bold">
                    <td className="p-2">{s.name}</td>
                    <td className="p-2 text-right text-red-600">{formatNum(s.debit)}</td>
                    <td className="p-2 text-right text-green-600">{formatNum(s.credit)}</td>
                    <td className={`p-2 text-right font-black ${s.closing > 0 ? 'text-red-700' : 'text-green-800'}`}>{formatNum(Math.abs(s.closing))} {s.closing > 0 ? 'DR' : 'CR'}</td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead className="bg-gray-50 border-b-2 border-black font-black">
                <tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Type</th><th className="p-2 text-right">Dr</th><th className="p-2 text-right">Cr</th><th className="p-2 text-right">Bal</th></tr>
              </thead>
              <tbody>
                {history.map((t, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2">{formatDDMMYY(t.date)}</td>
                    <td className="p-2 font-black">{t.type} {t.no || ''}</td>
                    <td className="p-2 text-right text-red-600">{t.debit > 0 ? formatNum(t.debit) : '—'}</td>
                    <td className="p-2 text-right text-green-600">{t.credit > 0 ? formatNum(t.credit) : '—'}</td>
                    <td className="p-2 text-right font-black">{formatNum(t.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>

      <button onClick={shareReport} className="w-full bg-green-600 text-white p-4 font-black uppercase text-xs border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all">Share on WhatsApp</button>
    </div>
  );
};

export default ReportsPage;