import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../db';
import { Ledger, Invoice, Receipt } from '../types';

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'balances' | 'summary'>('balances');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filterName, setFilterName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setLedgers(DB.getLedgers());
    setInvoices(DB.getInvoices());
    setReceipts(DB.getReceipts());
  }, []);

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const formatDDMMYY = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y.slice(-2)}`;
  };

  const suggestions = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    if (!q || !showSuggestions) return [];
    return ledgers.filter(l => l.name.toLowerCase().includes(q)).slice(0, 5);
  }, [filterName, ledgers, showSuggestions]);

  const ledgerMap = useMemo(() => {
    const map: Record<string, string> = {};
    ledgers.forEach(l => map[l.id] = l.name);
    return map;
  }, [ledgers]);

  const summaries = useMemo(() => {
    const data = ledgers.map(l => {
      const lid = l.id;
      const d = invoices.filter(i => i.ledgerId === lid).reduce((s, i) => s + i.grandTotal, 0);
      const c = receipts.filter(r => r.ledgerId === lid).reduce((s, r) => s + Number(r.amount), 0);
      return { id: l.id, name: l.name, debit: d, credit: c, closing: d - c };
    });
    // If filterName is present, we filter the summaries to show only matching parties
    let res = data.filter(d => !filterName || d.name.toLowerCase().includes(filterName.toLowerCase()));
    return res.sort((a, b) => a.name.localeCompare(b.name));
  }, [ledgers, invoices, receipts, filterName]);

  const history = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    let items = [
      ...invoices.map(i => ({
        id: i.id, date: i.date, type: 'INV', no: i.serialNo, 
        name: ledgerMap[i.ledgerId] || 'Unknown',
        debit: i.grandTotal, credit: 0, editUrl: `/edit-invoice/${i.id}`,
        ledgerId: i.ledgerId
      })),
      ...receipts.map(r => ({
        id: r.id, date: r.date, type: `RT-${r.mode.toUpperCase()}`, no: null, 
        name: ledgerMap[r.ledgerId] || 'Unknown',
        debit: 0, credit: Number(r.amount), editUrl: `/edit-receipt/${r.id}`,
        ledgerId: r.ledgerId
      }))
    ];
    items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    
    // Filtering history by name
    const filtered = items.filter(t => !q || t.name.toLowerCase().includes(q));
    
    let runningBal = 0;
    return filtered.map(t => {
      runningBal += (t.debit - t.credit);
      return { ...t, balance: runningBal };
    });
  }, [invoices, receipts, ledgerMap, filterName]);

  const shareReport = async () => {
    const today = new Date().toLocaleDateString();
    let msg = `*CHALLAN KITAB REPORT - ${today}*\n\n`;
    
    if (activeTab === 'balances') {
      msg += `*PENDING BALANCES*\n`;
      const targetList = summaries.filter(s => s.closing !== 0);
      if (targetList.length === 0) msg += "_No pending balances_\n";
      targetList.forEach(s => {
        msg += `• ${s.name}: ₹${formatNum(Math.abs(s.closing))} ${s.closing > 0 ? 'DR' : 'CR'}\n`;
      });
    } else {
      msg += `*LEDGER: ${filterName || 'ALL RECORDS'}*\n`;
      history.slice(-15).forEach(t => {
        msg += `${formatDDMMYY(t.date)}: ${t.type} ${t.no || ''} | ${t.debit > 0 ? 'DR '+formatNum(t.debit) : 'CR '+formatNum(t.credit)}\n`;
      });
      if (history.length > 0) {
        const final = history[history.length-1];
        msg += `\n*CURRENT BALANCE: ₹${formatNum(final.balance)}*`;
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Accounting Report', text: msg });
      } catch (e) { console.error('Error sharing', e); }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return (
    <div className="space-y-6 pb-40">
      <div className="bg-white border-2 border-black p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
        <div className="relative w-full">
          <input 
            type="text" 
            value={filterName} 
            onChange={e => { setFilterName(e.target.value); setShowSuggestions(true); }} 
            onFocus={() => setShowSuggestions(true)}
            placeholder="SEARCH CUSTOMER..." 
            className="w-full border-b-2 border-black p-2 font-black uppercase text-lg bg-transparent focus:outline-none" 
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full bg-white border-2 border-black mt-1 shadow-2xl">
              {suggestions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => { setFilterName(s.name); setShowSuggestions(false); }} 
                  className="p-2 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-sm"
                >
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setActiveTab('balances'); setShowSuggestions(false); }} className={`flex-1 py-2 font-black text-[10px] uppercase border-2 border-black transition-colors ${activeTab === 'balances' ? 'bg-black text-white' : 'bg-white text-black'}`}>Balances</button>
          <button onClick={() => { setActiveTab('summary'); setShowSuggestions(false); }} className={`flex-1 py-2 font-black text-[10px] uppercase border-2 border-black transition-colors ${activeTab === 'summary' ? 'bg-black text-white' : 'bg-white text-black'}`}>Ledger</button>
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
                {summaries.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center font-bold text-gray-400">No records found</td></tr>
                ) : (
                  summaries.map((s, i) => (
                    <tr key={i} className="border-b last:border-0 font-bold">
                      <td className="p-2">{s.name}</td>
                      <td className="p-2 text-right text-red-600">{formatNum(s.debit)}</td>
                      <td className="p-2 text-right text-green-600">{formatNum(s.credit)}</td>
                      <td className={`p-2 text-right font-black ${s.closing > 0 ? 'text-red-700' : 'text-green-800'}`}>{formatNum(Math.abs(s.closing))} {s.closing > 0 ? 'DR' : 'CR'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead className="bg-gray-50 border-b-2 border-black font-black">
                <tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Origin</th><th className="p-2 text-right">Dr/Cr</th><th className="p-2 text-right">Bal</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center font-bold text-gray-400">No records found</td></tr>
                ) : (
                  history.map((t, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2 whitespace-nowrap">{formatDDMMYY(t.date)}</td>
                      <td className="p-2 font-black">{t.type} {t.no || ''}</td>
                      <td className="p-2 text-right">{t.debit > 0 ? <span className="text-red-600">DR {formatNum(t.debit)}</span> : <span className="text-green-600">CR {formatNum(t.credit)}</span>}</td>
                      <td className="p-2 text-right font-black">{formatNum(t.balance)}</td>
                      <td className="p-2 text-center">
                        <button onClick={() => navigate(t.editUrl)} className="p-1 bg-black text-white rounded shadow-[1px_1px_0px_0px_rgba(79,70,229,1)] active:translate-y-0.5 active:shadow-none">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}
        </table>
      </div>

      <button onClick={shareReport} className="w-full bg-green-600 text-white p-4 font-black uppercase text-xs border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
        Share Report
      </button>
    </div>
  );
};

export default ReportsPage;