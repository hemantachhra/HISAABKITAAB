import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DB } from '../db';
import { Ledger, Receipt } from '../types';
import { useCustomModal } from '../App';

const ReceiptPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { showAlert } = useCustomModal();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ledgerName, setLedgerName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<'Cash' | 'Bank'>('Cash');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const refreshLedgers = () => {
    setLedgers(DB.getLedgers());
  };

  useEffect(() => {
    refreshLedgers();
    if (id) {
      const existing = DB.getReceipts().find(r => r.id === id);
      if (existing) {
        setIsEditMode(true);
        setDate(existing.date);
        setAmount(String(existing.amount));
        setMode(existing.mode);
        const currentLedgers = DB.getLedgers();
        setLedgerName(currentLedgers.find(l => l.id === existing.ledgerId)?.name || '');
      }
    }
  }, [id]);

  const suggestions = useMemo(() => {
    const q = ledgerName.trim().toLowerCase();
    if (!q) return [];
    return ledgers.filter(l => l.name.toLowerCase().includes(q)).slice(0, 10);
  }, [ledgerName, ledgers]);

  const handleSave = () => {
    const cleanName = ledgerName.trim().toUpperCase();
    const cleanAmount = parseFloat(amount);
    if (!cleanName || isNaN(cleanAmount) || cleanAmount <= 0) {
      showAlert("⚠️ ENTER VALID DETAILS");
      return;
    }
    let target = ledgers.find(l => l.name.toUpperCase() === cleanName);
    if (!target) {
      target = DB.saveLedger({ id: DB.generateId(), name: cleanName })!;
    }
    const receipt: Receipt = {
      id: isEditMode && id ? id : DB.generateId(),
      date, 
      ledgerId: target.id, 
      mode, 
      amount: cleanAmount
    };
    if (isEditMode ? DB.updateReceipt(receipt) : DB.saveReceipt(receipt)) {
      showAlert("✅ SAVED!");
      if (isEditMode) navigate('/reports');
      else { setLedgerName(''); setAmount(''); }
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white border-2 border-black p-3 md:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] pb-80 relative pt-0 mt-[-4px]">
      <div className="sticky top-0 bg-white z-[100] border-2 border-black p-1 mb-1.5 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h2 className="text-base font-black uppercase italic text-indigo-700 leading-none">Receipt</h2>
        </div>
        <button onClick={handleSave} className="bg-indigo-700 text-white p-1.5 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[7px] font-black uppercase text-black mb-1 block">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border-b-2 border-black py-0.5 font-bold text-xs outline-none bg-transparent" />
          </div>
          <div>
            <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5 inline-block">Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value as any)} className="w-full border-b-2 border-black py-0.5 font-bold text-xs bg-transparent outline-none">
              <option value="Cash">CASH</option>
              <option value="Bank">BANK</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5 mb-1 mx-auto block w-max">Client Name</label>
          <div className="relative w-full flex justify-center">
            <div className="relative w-full md:w-1/2">
              <input 
                type="text" 
                autoComplete="off" 
                value={ledgerName} 
                onFocus={() => { refreshLedgers(); setShowSuggestions(true); }}
                onChange={e => { setLedgerName(e.target.value); setShowSuggestions(true); }} 
                className="w-full border-b-2 border-black py-0.5 font-black uppercase text-lg outline-none bg-transparent text-center" 
                placeholder="NAME..." 
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[200] left-1/2 -translate-x-1/2 w-max min-w-[180px] max-w-full bg-indigo-50 border-2 border-black mt-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {suggestions.map(s => (
                    <div key={s.id} onClick={() => { setLedgerName(s.name); setShowSuggestions(false); }} className="p-3 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-sm truncate">
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5 block w-max mx-auto mb-1">Amount (₹)</label>
          <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border-b-2 border-black py-0.5 font-black text-4xl outline-none bg-transparent text-green-700 tracking-tighter text-center" placeholder="0.00" />
        </div>

        <button onClick={handleSave} className="w-full bg-black text-white py-3 font-black uppercase tracking-widest text-lg shadow-[4px_4px_0px_0px_rgba(79,70,229,1)] active:shadow-none active:translate-y-1 transition-all mt-1">
          {isEditMode ? 'Update' : 'Save Receipt'}
        </button>
      </div>
    </div>
  );
};

export default ReceiptPage;