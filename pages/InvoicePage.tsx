
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
    return q ? ledgers.filter(l => l.name.toLowerCase().includes(q)) : [];
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

  const addItem = () => setItems(prev => [...prev, { id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
  const removeItem = (itemId: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      setItems([{ id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<any>) => {
    const target = e.target;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 450);
  };

  const handleSave = () => {
    const name = ledgerName.trim();
    if (!name) return alert("Customer Name required.");
    const validItems = items.filter(i => i.particulars.trim() !== '');
    if (!validItems.length) return alert("Add at least one item.");
    if (grandTotal <= 0) return alert("Grand Total must be greater than zero.");

    const cleanedItems = validItems.map(item => ({
      ...item,
      qty: parseFloat(String(item.qty)) || 0,
      rate: parseFloat(String(item.rate)) || 0
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
      if (isEditMode) navigate('/reports');
      else {
        setLedgerName('');
        setItems([{ id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
        init();
        alert("Challan Saved!");
        window.scrollTo(0, 0);
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
    <div className="bg-white border-2 border-black p-3 md:p-8 invoice-font w-full mx-auto pb-[70vh] text-black">
      <div className="flex justify-between items-start mb-4 border-b-2 border-black pb-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-black uppercase italic tracking-tighter text-indigo-700 leading-none">Challan</h1>
          <div className="flex items-center gap-1 mt-1">
             <span className="text-[8px] font-black uppercase text-gray-500">Date:</span>
             <input 
               type="date" 
               value={date} 
               onChange={e => setDate(e.target.value)} 
               className="text-[10px] font-bold outline-none text-black bg-transparent border-b border-gray-300" 
             />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[8px] font-black uppercase text-gray-400">No.</div>
          <div className="text-lg font-black text-black">
            #{String(serialNo).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="inline-block bg-black px-2 py-0.5 mb-1">
          <label className="text-[8px] font-black uppercase text-white tracking-widest">Customer Name</label>
        </div>
        <div className="relative">
          <input 
            autoComplete="off" 
            type="text" 
            value={ledgerName} 
            onChange={e => { setLedgerName(e.target.value); setShowSuggestions(true); }} 
            onFocus={handleInputFocus}
            className="w-full border-b-2 border-black py-1 text-lg font-black uppercase focus:outline-none bg-transparent text-black placeholder:text-gray-200" 
            placeholder="NAME..." 
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full bg-white border-2 border-black mt-1 shadow-2xl max-h-48 overflow-y-auto">
              {suggestions.map(s => <div key={s.id} onClick={() => { setLedgerName(s.name); setShowSuggestions(false); }} className="p-3 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-black">{s.name}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1 text-[8px] font-black uppercase text-gray-400 mb-1 px-1">
        <div className="col-span-5">Item Particulars</div>
        <div className="col-span-2 text-center">Qty</div>
        <div className="col-span-2 text-center">Rate</div>
        <div className="col-span-3 text-right">Sum</div>
      </div>

      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-12 gap-1 items-start border-b border-gray-100 pb-1 relative group">
            <div className="col-span-5">
              <textarea 
                rows={1}
                value={item.particulars} 
                onFocus={handleInputFocus}
                onChange={e => {
                  handleItemChange(item.id, 'particulars', e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }} 
                className="w-full font-bold uppercase text-[11px] outline-none bg-transparent resize-none leading-tight text-black placeholder:text-gray-200" 
                placeholder="PARTICULARS..."
              />
            </div>
            <div className="col-span-2">
              <input 
                type="text" 
                inputMode="decimal"
                value={item.qty} 
                onFocus={handleInputFocus} 
                onChange={e => handleItemChange(item.id, 'qty', e.target.value)} 
                className="w-full font-bold text-[11px] p-0 text-center bg-transparent border-b border-gray-100 text-black appearance-none" 
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <input 
                type="text" 
                inputMode="decimal"
                value={item.rate} 
                onFocus={handleInputFocus} 
                onChange={e => handleItemChange(item.id, 'rate', e.target.value)} 
                className="w-full font-bold text-[11px] p-0 text-center bg-transparent border-b border-gray-100 text-black appearance-none" 
                placeholder="0"
              />
            </div>
            <div className="col-span-3 text-right flex items-center justify-end gap-1">
              <span className="text-[11px] font-black whitespace-nowrap text-black">₹{formatNum(item.amount)}</span>
              {items.length > 1 && (
                <button onClick={() => removeItem(item.id)} className="text-red-400 font-bold text-xs p-1">×</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-between items-center">
        <button 
          onClick={addItem} 
          className="bg-white border border-black px-3 py-1 font-black uppercase text-[9px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
        >
          + Add Row
        </button>
        <div className="text-right">
          <div className="text-[8px] font-black text-gray-400 uppercase leading-none">Total</div>
          <div className="text-xl font-black text-black">₹{formatNum(grandTotal)}</div>
        </div>
      </div>

      <div className="mt-8 space-y-2">
        <button 
          onClick={handleSave} 
          className="w-full bg-indigo-700 text-white py-3 font-black uppercase tracking-widest text-xs border-b-4 border-indigo-900 active:border-b-0 active:translate-y-1"
        >
          {isEditMode ? 'Update Entry' : 'Save & Next'}
        </button>
        <button 
          onClick={shareWhatsApp} 
          className="w-full bg-green-600 text-white py-3 font-black uppercase tracking-widest text-xs border-b-4 border-green-800 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2"
        >
          Share on WhatsApp
        </button>
      </div>
    </div>
  );
};

export default InvoicePage;
