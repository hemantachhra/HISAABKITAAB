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
  
  // Date Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLedgers(DB.getLedgers());
    setInvoices(DB.getInvoices());
    setReceipts(DB.getReceipts());
  }, []);

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  
  const formatCompactDate = (d: string) => {
    if (!d) return '';
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  };

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
    let res = data.filter(d => !filterName || d.name.toLowerCase().includes(filterName.toLowerCase()));
    if (activeTab === 'balances') {
      res = res.filter(d => Math.abs(d.closing) >= 50);
    }
    return res.sort((a, b) => a.name.localeCompare(b.name));
  }, [ledgers, invoices, receipts, filterName, activeTab]);

  const history = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    let allTx = [
      ...invoices.map(i => ({
        id: i.id, date: i.date, type: 'CHALLAN', no: i.serialNo, 
        name: ledgerMap[i.ledgerId] || 'Unknown',
        debit: i.grandTotal, credit: 0, editUrl: `/edit-invoice/${i.id}`,
        ledgerId: i.ledgerId
      })),
      ...receipts.map(r => ({
        id: r.id, date: r.date, type: r.mode === 'Bank' ? 'RT-BANK' : 'RT-CASH', no: null, 
        name: ledgerMap[r.ledgerId] || 'Unknown',
        debit: 0, credit: Number(r.amount), editUrl: `/edit-receipt/${r.id}`,
        ledgerId: r.ledgerId
      }))
    ];
    allTx.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    // Calculate Opening Balance for filtered name if any
    let openingBalance = 0;
    const filteredTx = allTx.filter(t => !q || t.name.toLowerCase().includes(q));
    
    const prePeriodTx = filteredTx.filter(t => t.date < fromDate);
    openingBalance = prePeriodTx.reduce((sum, t) => sum + (t.debit - t.credit), 0);

    const inPeriodTx = filteredTx.filter(t => t.date >= fromDate && t.date <= toDate);

    let runningBal = openingBalance;
    const result = inPeriodTx.map(t => {
      runningBal += (t.debit - t.credit);
      return { ...t, balance: runningBal };
    });

    return { 
      items: result, 
      opening: openingBalance, 
      closing: runningBal 
    };
  }, [invoices, receipts, ledgerMap, filterName, fromDate, toDate]);

  const shareReport = async () => {
    let msg = `*CHALLAN KITAB REPORT*\n`;
    msg += `Period: ${formatDDMMYY(fromDate)} to ${formatDDMMYY(toDate)}\n\n`;
    
    if (activeTab === 'balances') {
      msg += `*PENDING BALANCES (₹50+)*\n`;
      const targetList = summaries.filter(s => s.closing !== 0);
      if (targetList.length === 0) msg += "_No pending balances_\n";
      targetList.forEach(s => {
        const type = s.closing > 0 ? 'LENA' : 'DENA';
        msg += `• ${s.name}: ₹${formatNum(Math.abs(s.closing))} ${type}\n`;
      });
    } else {
      msg += `*LEDGER: ${filterName || 'ALL RECORDS'}*\n`;
      msg += `Opening: ₹${formatNum(Math.abs(history.opening))} ${history.opening >= 0 ? 'LENA' : 'DENA'}\n`;
      msg += `--------------------------\n`;
      
      history.items.forEach(t => {
        const dateStr = formatCompactDate(t.date);
        const typeStr = getOriginLabel(t.type, t.no);
        if (t.debit > 0) {
          msg += `${dateStr} | ${typeStr} | *DR ₹${formatNum(t.debit)}*\n`;
        } else {
          msg += `${dateStr} | ${typeStr} | CR ₹${formatNum(t.credit)}\n`;
        }
      });
      
      msg += `--------------------------\n`;
      msg += `*NET BALANCE: ₹${formatNum(Math.abs(history.closing))} ${history.closing >= 0 ? 'LENA' : 'DENA'}*`;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Accounting Report', text: msg });
      } catch (e) { 
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const getOriginLabel = (type: string, no: number | null) => {
    if (type === 'CHALLAN') return `CH#${no}`;
    if (type === 'RT-CASH') return 'CSH';
    if (type === 'RT-BANK') return 'BK';
    return type;
  };

  return (
    <div className="space-y-4 pb-40 w-full overflow-x-hidden">
      <div className="bg-white border-2 border-black p-3 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
        <div className="relative w-full flex justify-center">
          <div className="relative w-full md:w-1/2">
            <input 
              type="text" 
              value={filterName} 
              onChange={e => { setFilterName(e.target.value); setShowSuggestions(true); }} 
              onFocus={() => setShowSuggestions(true)}
              placeholder="SEARCH CLIENT..." 
              className="w-full border-b-2 border-black p-2 font-black uppercase text-lg bg-transparent focus:outline-none text-center" 
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-[200] left-1/2 -translate-x-1/2 w-max min-w-[180px] max-w-full bg-indigo-50 border-2 border-black mt-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {suggestions.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => { setFilterName(s.name); setShowSuggestions(false); }} 
                    className="p-3 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-sm truncate"
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 items-center justify-center">
          <div className="flex-1">
            <label className="text-[8px] font-black uppercase block mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full text-xs font-bold border border-black p-1 rounded" />
          </div>
          <div className="flex-1">
            <label className="text-[8px] font-black uppercase block mb-1">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full text-xs font-bold border border-black p-1 rounded" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setActiveTab('balances'); setShowSuggestions(false); }} className={`flex-1 py-2 font-black text-[10px] uppercase border-2 border-black transition-colors ${activeTab === 'balances' ? 'bg-black text-white' : 'bg-white text-black'}`}>Balances (₹50+)</button>
          <button onClick={() => { setActiveTab('summary'); setShowSuggestions(false); }} className={`flex-1 py-2 font-black text-[10px] uppercase border-2 border-black transition-colors ${activeTab === 'summary' ? 'bg-black text-white' : 'bg-white text-black'}`}>Ledger</button>
        </div>
      </div>

      <div className="bg-white border-2 border-black w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <table className="w-full text-[10px] uppercase table-fixed">
          {activeTab === 'balances' ? (
            <>
              <thead className="bg-gray-50 border-b-2 border-black font-black">
                <tr>
                  <th className="p-1.5 text-left w-[40%]">Client</th>
                  <th className="p-1.5 text-right w-[20%]">Dr</th>
                  <th className="p-1.5 text-right w-[20%]">Cr</th>
                  <th className="p-1.5 text-right w-[20%]">Net</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center font-bold text-gray-400 italic">No records over ₹50</td></tr>
                ) : (
                  summaries.map((s, i) => (
                    <tr key={i} className="border-b last:border-0 font-bold">
                      <td className="p-1.5 truncate">{s.name}</td>
                      <td className="p-1.5 text-right text-red-600 truncate">{formatNum(s.debit)}</td>
                      <td className="p-1.5 text-right text-green-600 truncate">{formatNum(s.credit)}</td>
                      <td className={`p-1.5 text-right font-black truncate ${s.closing > 0 ? 'text-red-700' : 'text-green-800'}`}>
                        {formatNum(Math.abs(s.closing))} {s.closing >= 0 ? 'LENA' : 'DENA'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead className="bg-gray-50 border-b-2 border-black font-black">
                <tr>
                  <th className="p-1 text-left w-[12%]">Dt</th>
                  <th className="p-1 text-left w-[30%]">Name</th>
                  <th className="p-1 text-center w-[15%]">Org</th>
                  <th className="p-1 text-right w-[14%]">Dr</th>
                  <th className="p-1 text-right w-[14%]">Cr</th>
                  <th className="p-1 text-right w-[15%]">Bal</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-indigo-50 border-b border-black font-black italic">
                  <td colSpan={5} className="p-1 text-right">Opening Balance:</td>
                  <td className="p-1 text-right">{formatNum(history.opening)}</td>
                </tr>
                {history.items.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center font-bold text-gray-400">No records in this period</td></tr>
                ) : (
                  history.items.map((t, i) => (
                    <tr key={i} className="border-b last:border-0 cursor-pointer hover:bg-gray-50" onClick={() => navigate(t.editUrl)}>
                      <td className="p-1 whitespace-nowrap">{formatCompactDate(t.date)}</td>
                      <td className="p-1 font-bold truncate">{t.name}</td>
                      <td className="p-1 text-center font-black whitespace-nowrap">{getOriginLabel(t.type, t.no)}</td>
                      <td className="p-1 text-right text-red-600 truncate">{t.debit > 0 ? formatNum(t.debit) : ''}</td>
                      <td className="p-1 text-right text-green-600 truncate">{t.credit > 0 ? formatNum(t.credit) : ''}</td>
                      <td className={`p-1 text-right font-black truncate ${t.balance >= 0 ? 'text-red-700' : 'text-green-800'}`}>
                        {formatNum(t.balance)}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-black text-white font-black">
                  <td colSpan={5} className="p-2 text-right uppercase text-[8px]">Closing Balance ({history.closing >= 0 ? 'LENA' : 'DENA'}):</td>
                  <td className="p-2 text-right">{formatNum(Math.abs(history.closing))}</td>
                </tr>
              </tbody>
            </>
          )}
        </table>
      </div>

      <button onClick={shareReport} className="w-full bg-green-600 text-white p-4 font-black uppercase text-xs border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.481 8.413-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884 0 2.225.548 3.849 1.587 5.689l-.999 3.648 3.901-.988zM17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
        Share WhatsApp Report
      </button>
    </div>
  );
};

export default ReportsPage;