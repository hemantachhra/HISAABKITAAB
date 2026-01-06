import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DB } from '../db';
import { Ledger, Receipt } from '../types';

const ReceiptPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ledgerName, setLedgerName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<'Cash' | 'Bank'>('Cash');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  useEffect(() => {
    setLedgers(DB.getLedgers());
    if (id) {
      const existing = DB.getReceipts().find(r => r.id === id);
      if (existing) {
        setIsEditMode(true);
        setDate(existing.date);
        setAmount(String(existing.amount));
        setMode(existing.mode);
        setLedgerName(DB.getLedgers().find(l => l.id === existing.ledgerId)?.name || '');
      }
    }
  }, [id]);

  const suggestions = useMemo(() => {
    const q = ledgerName.trim().toLowerCase();
    return q ? ledgers.filter(l => l.name.toLowerCase().includes(q)) : [];
  }, [ledgerName, ledgers]);

  const handleInputFocus = (e: React.FocusEvent<any>) => {
    const target = e.target;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 450);
  };

  const handleSave = () => {
    const cleanName = ledgerName.trim();
    const cleanAmount = parseFloat(amount);
    if (!cleanName || isNaN(cleanAmount) || cleanAmount <= 0) return alert("Check Name/Amount.");

    let target = ledgers.find(l => l.name.toLowerCase() === cleanName.toLowerCase());
    if (!target) {
      if (confirm(`Create new customer "${cleanName}"?`)) {
        target = { id: DB.generateId(), name: cleanName };
        DB.saveLedger(target);
      } else return;
    }

    const receipt: Receipt = {
      id: isEditMode && id ? id : DB.generateId(),
      date, ledgerId: target.id, mode, amount: cleanAmount
    };

    if (isEditMode ? DB.updateReceipt(receipt) : DB.saveReceipt(receipt)) {
      if (isEditMode) navigate('/reports');
      else { 
        setLedgerName(''); 
        setAmount(''); 
        setDate(new Date().toISOString().split('T')[0]); 
        alert("Receipt Saved!");
      }
    }
  };

  const shareWhatsApp = () => {
    const amt = parseFloat(amount) || 0;
    const msg = `*RECEIPT*\nDate: ${date}\nCustomer: ${ledgerName.toUpperCase()}\nAmount: ₹${formatNum(amt)}\nMode: ${mode}\n_Challan Kitab_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="max-w-md mx-auto mt-4 bg-white border-2 border-black p-6 shadow-xl pb-[70vh]">
      <div className="bg-black text-white p-4 -mx-6 -mt-6 mb-6">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Receipt Entry</h2>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-black uppercase text-gray-400">Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="w-full border-b-2 border-black p-2 font-bold text-sm text-black bg-white" 
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-gray-400">Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value as any)} className="w-full border-b-2 border-black p-2 font-bold text-sm bg-transparent text-black">
              <option value="Cash">CASH</option>
              <option value="Bank">BANK</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <label className="text-[9px] font-black uppercase text-gray-400">Customer</label>
          <input 
            type="text" 
            autoComplete="off" 
            value={ledgerName} 
            onChange={e => { setLedgerName(e.target.value); setShowSuggestions(true); }} 
            onFocus={handleInputFocus}
            className="w-full border-b-2 border-black p-2 font-black uppercase text-xl focus:outline-none placeholder:text-gray-100 text-black bg-transparent" 
            placeholder="NAME..." 
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full bg-white border-2 border-black mt-1 shadow-2xl">
              {suggestions.map(s => <div key={s.id} onClick={() => { setLedgerName(s.name); setShowSuggestions(false); }} className="p-3 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-black">{s.name}</div>)}
            </div>
          )}
        </div>

        <div>
          <label className="text-[9px] font-black uppercase text-gray-400">Amount (₹)</label>
          <input 
            type="text" 
            inputMode="decimal"
            value={amount} 
            onFocus={handleInputFocus}
            onChange={e => setAmount(e.target.value)} 
            className="w-full border-b-2 border-black p-2 font-black text-4xl focus:outline-none text-black bg-transparent" 
            placeholder="..." 
          />
        </div>

        <div className="pt-4 flex flex-col gap-2">
          {/* Swapped order: Save is now first */}
          <button onClick={handleSave} className="w-full bg-black text-white py-4 font-black uppercase tracking-widest border-b-4 border-gray-700 active:border-b-0 active:translate-y-1">{isEditMode ? 'Update' : 'Save'}</button>
          <button onClick={shareWhatsApp} className="w-full bg-green-600 text-white py-4 font-black uppercase tracking-widest border-b-4 border-green-800 active:border-b-0 active:translate-y-1">Share WhatsApp</button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPage;