import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DB } from '../db';
import { Ledger, InvoiceItem, Invoice } from '../types';

const InvoicePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [serialNo, setSerialNo] = useState(1);
  const [ledgerName, setLedgerName] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }
  ]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const init = () => {
    const currentLedgers = DB.getLedgers();
    setLedgers(currentLedgers);
    if (id) {
      const existing = DB.getInvoices().find(inv => inv.id === id);
      if (existing) {
        setIsEditMode(true);
        setDate(existing.date);
        setSerialNo(existing.serialNo);
        setItems(existing.items);
        const l = currentLedgers.find(led => led.id === existing.ledgerId);
        setLedgerName(l?.name || '');
      } else { 
        setSerialNo(DB.getNextSerial()); 
      }
    } else {
      setIsEditMode(false);
      setSerialNo(DB.getNextSerial());
      setLedgerName('');
      setItems([{ id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
      setDate(new Date().toISOString().split('T')[0]);
    }
  };

  useEffect(() => { init(); }, [id]);

  const suggestions = useMemo(() => {
    const q = ledgerName.trim().toLowerCase();
    if (!q) return [];
    
    return ledgers
      .filter(l => l.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aLow = a.name.toLowerCase();
        const bLow = b.name.toLowerCase();
        const aStarts = aLow.startsWith(q);
        const bStarts = bLow.startsWith(q);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aLow.localeCompare(bLow);
      })
      .slice(0, 8);
  }, [ledgerName, ledgers]);

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const handleItemChange = (itemId: string, field: keyof InvoiceItem, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value };
        if (field === 'qty' || field === 'rate') {
          const q = field === 'qty' ? value : String(item.qty);
          const r = field === 'rate' ? value : String(item.rate);
          updated.amount = (parseFloat(q) || 0) * (parseFloat(r) || 0);
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
  };
  
  const removeItem = (itemId: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      setItems([{ id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
    }
  };

  const handleSave = () => {
    const name = ledgerName.trim();
    
    // 1. Check Name First
    if (!name) {
      alert("⚠️ ENTER CUSTOMER NAME\nPlease enter a name for the party.");
      const input = document.getElementById('customer-name-input');
      input?.focus();
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 2. Comprehensive Row Check
    // We check every row. If a row is partially filled, we force the user to complete it.
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const p = item.particulars.trim();
      const qVal = String(item.qty).trim();
      const rVal = String(item.rate).trim();
      
      const q = parseFloat(qVal) || 0;
      const r = parseFloat(rVal) || 0;

      // Logic: If any field in the row is filled, the whole row must be valid.
      const isDirty = p !== '' || qVal !== '' || rVal !== '' || q !== 0 || r !== 0;

      if (isDirty) {
        if (p === '') {
          alert(`⚠️ ROW #${i + 1} MISSING PARTICULARS\nPlease enter a description.`);
          const el = document.getElementById(`particulars-${item.id}`);
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (qVal === '' || q === 0) {
          alert(`⚠️ ROW #${i + 1} MISSING QUANTITY\nPlease enter a valid Qty.`);
          const el = document.getElementById(`qty-${item.id}`);
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (rVal === '' || r === 0) {
          alert(`⚠️ ROW #${i + 1} MISSING RATE\nPlease enter a valid Rate.`);
          const el = document.getElementById(`rate-${item.id}`);
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
    }

    // Filter out completely empty rows
    const validItems = items.filter(i => i.particulars.trim() !== '' && (parseFloat(String(i.qty)) > 0) && (parseFloat(String(i.rate)) > 0));
    
    if (!validItems.length) {
      alert("⚠️ NO ITEMS\nAdd at least one full row (Description, Qty, Rate).");
      return;
    }

    const cleanedItems = validItems.map(item => ({
      ...item,
      qty: parseFloat(String(item.qty)),
      rate: parseFloat(String(item.rate))
    }));

    let ledger = ledgers.find(l => l.name.toLowerCase() === name.toLowerCase());
    if (!ledger) {
      ledger = { id: DB.generateId(), name };
      DB.saveLedger(ledger);
    }

    const invoice: Invoice = {
      id: isEditMode && id ? id : DB.generateId(),
      serialNo, date, ledgerId: ledger.id, items: cleanedItems, grandTotal
    };

    if (isEditMode ? DB.updateInvoice(invoice) : DB.saveInvoice(invoice)) {
      if (isEditMode) {
        navigate('/reports');
      } else {
        alert("✅ CHALLAN SAVED!");
        setLedgerName('');
        setItems([{ id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
        setDate(new Date().toISOString().split('T')[0]);
        setSerialNo(DB.getNextSerial());
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const shareWhatsApp = () => {
    let msg = `*CHALLAN #${String(serialNo).padStart(2, '0')}*\nDate: ${date}\nParty: ${ledgerName.toUpperCase()}\n------------------\n`;
    items.forEach((item, idx) => {
      if (item.particulars) {
        msg += `${idx + 1}. ${item.particulars.toUpperCase()}\n   ${item.qty} x ${item.rate} = ₹${formatNum(item.amount)}\n`;
      }
    });
    msg += `------------------\n*TOTAL: ₹${formatNum(grandTotal)}*\n_Challan Kitab_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="bg-white border-2 border-black p-3 md:p-8 invoice-font w-full mx-auto pb-[60vh] text-black relative">
      
      {/* IMPROVED STICKY HEADER */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md z-[150] border-b-2 border-black pb-2 mb-6 flex justify-between items-start pt-2 px-1">
        <div className="flex flex-col">
          <h1 className="text-xl font-black uppercase italic tracking-tighter text-indigo-700 leading-none">Challan</h1>
          <div className="flex items-center gap-1 mt-1">
             <span className="text-[8px] font-black uppercase text-gray-500">Date:</span>
             <input 
               type="date" 
               value={date} 
               onChange={e => setDate(e.target.value)} 
               className="text-[10px] font-bold outline-none text-black bg-transparent" 
             />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[8px] font-black uppercase text-gray-400">No.</div>
            <div className="text-lg font-black text-black leading-none mt-1">
              #{String(serialNo).padStart(2, '0')}
            </div>
          </div>
          {/* THE TICK BUTTON - High visibility and reliability */}
          <button 
            type="button"
            onClick={handleSave}
            className="bg-indigo-700 text-white w-12 h-12 rounded shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center transition-all"
            aria-label="Save Entry"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Customer Input */}
      <div className="mb-8">
        <div className="inline-block bg-black px-2 py-0.5 mb-1">
          <label className="text-[8px] font-black uppercase text-white tracking-widest">Party Name</label>
        </div>
        <div className="relative">
          <input 
            id="customer-name-input"
            autoComplete="off" 
            type="text" 
            value={ledgerName} 
            onChange={e => { setLedgerName(e.target.value); setShowSuggestions(true); }} 
            className="w-full border-b-2 border-black py-2 text-xl font-black uppercase focus:outline-none bg-transparent text-black" 
            placeholder="TYPE NAME..." 
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-[200] w-full bg-white border-2 border-black mt-1 shadow-2xl max-h-48 overflow-y-auto">
              {suggestions.map(s => (
                <div key={s.id} onClick={() => { setLedgerName(s.name); setShowSuggestions(false); }} className="p-4 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-black">
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table Headers */}
      <div className="grid grid-cols-12 gap-1 text-[8px] font-black uppercase text-gray-400 mb-3 px-1">
        <div className="col-span-5">Particulars</div>
        <div className="col-span-2 text-center">Qty</div>
        <div className="col-span-2 text-center">Rate</div>
        <div className="col-span-3 text-right">Amount</div>
      </div>

      {/* Items List */}
      <div className="space-y-8">
        {items.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-start border-b border-gray-100 pb-6 relative group">
            <div className="col-span-5">
              <textarea 
                id={`particulars-${item.id}`}
                rows={1}
                value={item.particulars} 
                onChange={e => {
                  handleItemChange(item.id, 'particulars', e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }} 
                className="w-full font-bold uppercase text-[13px] outline-none bg-transparent resize-none leading-tight text-black border-b-2 border-black/10 focus:border-black transition-colors" 
                placeholder="DESCRIPTION..."
              />
            </div>
            <div className="col-span-2">
              <input 
                id={`qty-${item.id}`}
                type="text" 
                inputMode="decimal"
                value={item.qty} 
                onChange={e => handleItemChange(item.id, 'qty', e.target.value)} 
                className="w-full font-black text-[15px] py-1 text-center bg-transparent border-b-2 border-black focus:border-indigo-600 text-black outline-none" 
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <input 
                id={`rate-${item.id}`}
                type="text" 
                inputMode="decimal"
                value={item.rate} 
                onChange={e => handleItemChange(item.id, 'rate', e.target.value)} 
                className="w-full font-black text-[15px] py-1 text-center bg-transparent border-b-2 border-black focus:border-indigo-600 text-black outline-none" 
                placeholder="0"
              />
            </div>
            <div className="col-span-3 text-right flex items-center justify-end gap-1 pt-2">
              <span className="text-[13px] font-black whitespace-nowrap text-black">₹{formatNum(item.amount)}</span>
              {items.length > 1 && (
                <button onClick={() => removeItem(item.id)} className="text-red-500 font-bold text-2xl px-2 ml-1 leading-none hover:bg-red-50 rounded">×</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Controls */}
      <div className="mt-10 flex justify-between items-center bg-gray-50 p-4 border-2 border-dashed border-gray-300">
        <button 
          onClick={addItem} 
          className="bg-white border-2 border-black px-6 py-3 font-black uppercase text-[12px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
        >
          + Add New Row
        </button>
        <div className="text-right">
          <div className="text-[9px] font-black text-gray-400 uppercase leading-none tracking-widest">Total Payable</div>
          <div className="text-3xl font-black text-black">₹{formatNum(grandTotal)}</div>
        </div>
      </div>

      {/* Main Actions at Bottom */}
      <div className="mt-16 space-y-4">
        <button 
          onClick={handleSave} 
          className="w-full bg-indigo-700 text-white py-5 font-black uppercase tracking-widest text-lg border-b-8 border-indigo-900 active:border-b-0 active:translate-y-2 transition-all"
        >
          {isEditMode ? 'Update Record' : 'Save Entry & Reset'}
        </button>
        <button 
          onClick={shareWhatsApp} 
          className="w-full bg-green-600 text-white py-5 font-black uppercase tracking-widest text-lg border-b-8 border-green-800 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-2 transition-all"
        >
          Share on WhatsApp
        </button>
      </div>
    </div>
  );
};

export default InvoicePage;