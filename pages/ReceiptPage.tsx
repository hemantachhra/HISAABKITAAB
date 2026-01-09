import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DB } from '../db.ts';
import { Ledger, Receipt } from '../types.ts';

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
    if (!q) return [];
    const uniqueMap = new Map();
    ledgers.forEach(l => {
      const name = l.name.toUpperCase();
      if (!uniqueMap.has(name)) uniqueMap.set(name, l);
    });
    return Array.from(uniqueMap.values()).filter((l: any) => l.name.toLowerCase().includes(q)).slice(0, 10);
  }, [ledgerName, ledgers]);

  const handlePartyFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.target;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  };

  const handleSave = () => {
    const cleanName = ledgerName.trim().toUpperCase();
    const cleanAmount = parseFloat(amount);

    if (!cleanName) {
      alert("⚠️ ENTER PARTY NAME");
      return;
    }

    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      alert("⚠️ INVALID AMOUNT");
      return;
    }

    let target = ledgers.find(l => l.name.toUpperCase() === cleanName);
    if (!target) {
      const newLedger = DB.saveLedger({ id: DB.generateId(), name: cleanName });
      if (!newLedger) {
        alert("❌ ERROR: Party fail.");
        return;
      }
      target = newLedger;
      setLedgers(DB.getLedgers());
    }

    const receipt: Receipt = {
      id: isEditMode && id ? id : DB.generateId(),
      date, 
      ledgerId: target.id, 
      mode, 
      amount: cleanAmount
    };

    if (isEditMode ? DB.updateReceipt(receipt) : DB.saveReceipt(receipt)) {
      alert("✅ SAVED!");
      if (isEditMode) {
        navigate('/reports');
      } else { 
        setLedgerName(''); 
        setAmount(''); 
      }
    } else {
      alert("❌ FAILED");
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white border-2 border-black p-3 md:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] pb-64 relative pt-0">
      {/* Tight Header */}
      <div className="sticky top-0 bg-white z-[100] border-2 border-black p-2 mb-2 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h2 className="text-lg font-black uppercase italic text-indigo-700 leading-none tracking-tighter">Receipt</h2>
          <div className="text-[7px] font-black uppercase text-gray-500 mt-0.5">Voucher</div>
        </div>
        <button 
          onClick={handleSave} 
          className="bg-indigo-700 text-white p-2 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/>
          </svg>
        </button>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5">Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="w-full border-b-2 border-black py-0.5 font-bold text-xs text-black bg-white outline-none" 
            />
          </div>
          <div>
            <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5">Mode</label>
            <select 
              value={mode} 
              onChange={e => setMode(e.target.value as any)} 
              className="w-full border-b-2 border-black py-0.5 font-bold text-xs bg-transparent text-black outline-none"
            >
              <option value="Cash">CASH</option>
              <option value="Bank">BANK</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5">Customer Name</label>
          <div className="relative mt-0.5">
            <input 
              id="party-input"
              type="text" 
              autoComplete="off" 
              value={ledgerName} 
              onFocus={handlePartyFocus}
              onChange={e => { setLedgerName(e.target.value); setShowSuggestions(true); }} 
              className="w-full border-b-2 border-black py-0.5 font-black uppercase text-lg focus:outline-none bg-transparent" 
              placeholder="NAME..." 
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full bg-white border-2 border-black mt-1 shadow-2xl max-h-48 overflow-y-auto">
                {suggestions.map((s: any) => (
                  <div 
                    key={s.id} 
                    onClick={() => { setLedgerName(s.name); setShowSuggestions(false); }} 
                    className="p-2 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-sm"
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5">Amount (₹)</label>
          <input 
            type="text" 
            inputMode="decimal"
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            className="w-full border-b-2 border-black py-0.5 font-black text-4xl focus:outline-none bg-transparent text-green-700 tracking-tighter" 
            placeholder="0.00" 
          />
        </div>

        <button 
          onClick={handleSave} 
          className="w-full bg-black text-white py-4 font-black uppercase tracking-widest text-lg shadow-[4px_4px_0px_0px_rgba(79,70,229,1)] active:shadow-none active:translate-y-1 transition-all mt-4"
        >
          {isEditMode ? 'Update' : 'Save Receipt'}
        </button>
      </div>
    </div>
  );
};

export default ReceiptPage;