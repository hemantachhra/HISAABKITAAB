
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const loadData = () => {
    const freshLedgers = DB.getLedgers();
    const freshInvoices = DB.getInvoices();
    const freshReceipts = DB.getReceipts();
    setLedgers([...freshLedgers]);
    setInvoices([...freshInvoices]);
    setReceipts([...freshReceipts]);
  };

  useEffect(() => {
    loadData();
  }, []);

  const ledgerMap = useMemo(() => {
    const map: Record<string, string> = {};
    ledgers.forEach(l => map[l.id] = l.name);
    return map;
  }, [ledgers]);

  const suggestions = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    if (!q) return [];
    return ledgers.filter(l => l.name.toLowerCase().includes(q));
  }, [filterName, ledgers]);

  const history = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    let items = [
      ...invoices.map(i => ({
        id: i.id, date: i.date, type: 'INV', no: i.serialNo, 
        name: ledgerMap[i.ledgerId] || 'Unknown',
        debit: i.grandTotal, credit: 0, ledgerId: i.ledgerId
      })),
      ...receipts.map(r => ({
        id: r.id, date: r.date, type: 'RCT', no: null, 
        name: ledgerMap[r.ledgerId] || 'Unknown',
        debit: 0, credit: Number(r.amount), ledgerId: r.ledgerId
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

  const summaries = useMemo(() => {
    const filtered = ledgers.map(l => {
      const lid = l.id;
      const d = invoices.filter(i => i.ledgerId === lid).reduce((s, i) => s + i.grandTotal, 0);
      const c = receipts.filter(r => r.ledgerId === lid).reduce((s, r) => s + Number(r.amount), 0);
      return { name: l.name, debit: d, credit: c, closing: d - c };
    });
    if (filterName) {
      return filtered.filter(s => s.name.toLowerCase().includes(filterName.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [ledgers, invoices, receipts, filterName]);

  const shareReport = () => {
    let msg = "";
    if (activeTab === 'balances') {
      msg = `*BALANCES SUMMARY*\nAs of ${new Date().toLocaleDateString()}\n------------------\n`;
      summaries.forEach(s => {
        if (s.closing !== 0) {
          msg += `${s.name.toUpperCase()}: ₹${formatNum(Math.abs(s.closing))} ${s.closing > 0 ? 'DR' : 'CR'}\n`;
        }
      });
    } else {
      const name = filterName || "ALL CUSTOMERS";
      msg = `*STATEMENT: ${name.toUpperCase()}*\nPeriod: ${startDate || 'Start'} to ${endDate || 'End'}\n------------------\n`;
      history.forEach(t => {
        msg += `${t.date} | ${t.type} | ${t.debit > 0 ? 'DR ' + formatNum(t.debit) : 'CR ' + formatNum(t.credit)} | Bal: ${formatNum(t.balance)}\n`;
      });
      if (history.length > 0) {
        const final = history[history.length - 1].balance;
        msg += `------------------\n*NET BALANCE: ₹${formatNum(Math.abs(final))} ${final > 0 ? 'DEBIT' : 'CREDIT'}*`;
      }
    }
    msg += `\n\n_Generated via Challan Kitab_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleEdit = (item: any) => {
    if (item.type === 'INV') navigate(`/edit-invoice/${item.id}`);
    else navigate(`/edit-receipt/${item.id}`);
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden pb-20 text-black">
      <div className="flex justify-between items-center p-2">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-indigo-700">Reports</h1>
        <button onClick={loadData} className="text-[10px] font-black border-2 border-black px-4 py-2 uppercase bg-white active:bg-black active:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Refresh</button>
      </div>

      <div className="bg-white border-2 border-black p-4 space-y-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="relative">
          <div className="inline-block bg-black px-3 py-1 mb-1">
            <label className="text-[10px] font-black uppercase text-white tracking-widest">Name</label>
          </div>
          <div className="relative">
            <input 
              type="text" 
              autoComplete="off"
              value={filterName} 
              onChange={e => { setFilterName(e.target.value); setShowSuggestions(true); }} 
              placeholder="SEARCH CUSTOMER..." 
              className="w-full border-b-2 border-black p-2 font-black uppercase text-lg focus:outline-none bg-transparent" 
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full bg-white border-2 border-black mt-1 shadow-2xl max-h-48 overflow-y-auto">
                {suggestions.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => { setFilterName(s.name); setShowSuggestions(false); }} 
                    className="p-3 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer transition-colors"
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <div className="inline-block bg-black px-3 py-1 mb-1">
              <label className="text-[10px] font-black uppercase text-white tracking-widest">From</label>
            </div>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="w-full border-b-2 border-black p-2 text-xs font-bold outline-none bg-transparent" 
            />
          </div>
          <div className="relative">
            <div className="inline-block bg-black px-3 py-1 mb-1">
              <label className="text-[10px] font-black uppercase text-white tracking-widest">To</label>
            </div>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="w-full border-b-2 border-black p-2 text-xs font-bold outline-none bg-transparent" 
            />
          </div>
        </div>
      </div>

      <div className="flex border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <button onClick={() => setActiveTab('balances')} className={`flex-1 p-4 font-black text-sm uppercase transition-all ${activeTab === 'balances' ? 'bg-black text-white' : 'bg-white text-black'}`}>Balances</button>
        <button onClick={() => setActiveTab('summary')} className={`flex-1 p-4 font-black text-sm uppercase border-l-2 border-black transition-all ${activeTab === 'summary' ? 'bg-black text-white' : 'bg-white text-black'}`}>Statements</button>
      </div>

      <div className="bg-white border-2 border-black overflow-x-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <table className="w-full min-w-[600px] text-xs">
          {activeTab === 'balances' ? (
            <>
              <thead className="bg-gray-100 border-b-2 border-black font-black uppercase">
                <tr>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-right">Debit (+)</th>
                  <th className="p-2 text-right">Credit (-)</th>
                  <th className="p-2 text-right bg-indigo-50">Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-2 font-black uppercase">{s.name}</td>
                    <td className="p-2 text-right">₹{formatNum(s.debit)}</td>
                    <td className="p-2 text-right">₹{formatNum(s.credit)}</td>
                    <td className={`p-2 text-right font-black bg-indigo-50 ${s.closing > 0 ? 'text-red-600' : (s.closing < 0 ? 'text-green-700' : 'text-gray-400')}`}>
                      ₹{formatNum(Math.abs(s.closing))} {s.closing > 0 ? 'DR' : (s.closing < 0 ? 'CR' : '')}
                    </td>
                  </tr>
                ))}
                {summaries.length === 0 && (
                  <tr><td colSpan={4} className="p-10 text-center font-black uppercase text-gray-400 italic">No records found</td></tr>
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead className="bg-gray-100 border-b-2 border-black font-black uppercase">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-right">Debit</th>
                  <th className="p-2 text-right">Credit</th>
                  <th className="p-2 text-right bg-indigo-50">Balance</th>
                  <th className="p-2 text-center">Edit</th>
                </tr>
              </thead>
              <tbody>
                {history.map((t, i) => (
                  <tr key={t.id + i} className="border-b last:border-0 hover:bg-gray-50 group">
                    <td className="p-2 whitespace-nowrap">{t.date}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${t.type === 'INV' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                        {t.type} {t.no ? `#${t.no}` : ''}
                      </span>
                    </td>
                    <td className="p-2 font-black uppercase max-w-[150px] truncate">{t.name}</td>
                    <td className="p-2 text-right text-red-600">{t.debit > 0 ? `₹${formatNum(t.debit)}` : '—'}</td>
                    <td className="p-2 text-right text-green-700">{t.credit > 0 ? `₹${formatNum(t.credit)}` : '—'}</td>
                    <td className="p-2 text-right font-black bg-indigo-50">₹{formatNum(t.balance)}</td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => handleEdit(t)} 
                        className="bg-black text-white w-6 h-6 rounded-full inline-flex items-center justify-center shadow hover:scale-110 active:scale-90 transition-transform"
                      >
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      </button>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center font-black uppercase text-gray-400 italic">No entries found for this selection</td></tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>

      <div className="pt-4">
        <button onClick={shareReport} className="w-full bg-green-600 text-white p-4 font-black uppercase tracking-widest text-sm border-b-8 border-green-800 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Share on WhatsApp
        </button>
      </div>
    </div>
  );
};

export default ReportsPage;
