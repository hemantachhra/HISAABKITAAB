import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DB } from '../db';
import { Ledger, InvoiceItem, Invoice } from '../types';
import { useCustomModal } from '../App';

const InvoicePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { showAlert } = useCustomModal();
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [serialNo, setSerialNo] = useState<number | string>(1);
  const [ledgerName, setLedgerName] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [nextFocusId, setNextFocusId] = useState<string | null>(null);

  const forceFocus = (elementId: string) => {
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.focus();
        if ('select' in el) (el as any).select();
      }
    }, 250);
  };

  useLayoutEffect(() => {
    if (nextFocusId) {
      forceFocus(nextFocusId);
      setNextFocusId(null);
    }
  }, [nextFocusId]);

  useEffect(() => {
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
      }
    } else {
      setIsEditMode(false);
      setSerialNo(DB.getNextSerial());
      setLedgerName('');
      setItems([{ id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [id]);

  const addItem = () => {
    const newId = DB.generateId();
    setItems(prev => [...prev, { id: newId, particulars: '', qty: '', rate: '', amount: 0 }]);
    setNextFocusId(`particulars-${newId}`);
  };

  const removeItem = (itemId: string) => {
    if (items.length === 1) {
      setItems([{ id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
      return;
    }
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const suggestions = useMemo(() => {
    const q = ledgerName.trim().toLowerCase();
    if (!q) return [];
    return ledgers
      .filter(l => l.name.toLowerCase().includes(q))
      .filter((v, i, a) => a.findIndex(t => t.name === v.name) === i)
      .slice(0, 5);
  }, [ledgerName, ledgers]);

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const handleItemChange = (itemId: string, field: keyof InvoiceItem, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value };
        if (field === 'particulars') {
          const currentLedger = ledgers.find(l => l.name.toUpperCase() === ledgerName.trim().toUpperCase());
          if (currentLedger) {
            const lastRate = DB.getLastRate(currentLedger.id, value);
            if (lastRate) {
              updated.rate = lastRate;
              const q = Number(item.qty) || 0;
              updated.amount = q * lastRate;
            }
          }
        }
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

  const handleKeyDown = (e: React.KeyboardEvent, type: string, itemId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'name') {
        setShowSuggestions(false);
        if (items.length > 0) setNextFocusId(`particulars-${items[0].id}`);
      } else if (type === 'particulars' && itemId) {
        setNextFocusId(`qty-${itemId}`);
      } else if (type === 'qty' && itemId) {
        setNextFocusId(`rate-${itemId}`);
      } else if (type === 'rate' && itemId) {
        const idx = items.findIndex(i => i.id === itemId);
        if (idx === items.length - 1) {
          if (items[idx].particulars.trim()) addItem();
        } else {
          setNextFocusId(`particulars-${items[idx + 1].id}`);
        }
      }
    }
  };

  const handleSave = () => {
    const name = ledgerName.trim().toUpperCase();
    const finalSerial = Number(serialNo);
    
    if (!name) {
      showAlert("⚠️ ENTER PARTY NAME");
      return;
    }
    if (isNaN(finalSerial) || finalSerial <= 0) {
      showAlert("⚠️ ENTER VALID SERIAL NO");
      return;
    }

    const cleanRows: InvoiceItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const p = row.particulars.trim();
      const q = parseFloat(String(row.qty));
      const r = parseFloat(String(row.rate));
      if (p || (!isNaN(q) && q !== 0) || (!isNaN(r) && r !== 0)) {
        if (!p || isNaN(q) || isNaN(r) || q <= 0 || r <= 0) {
          showAlert(`⚠️ CHECK ROW ${i + 1}`);
          return;
        }
        cleanRows.push({ ...row, particulars: p, qty: q, rate: r, amount: q * r });
      }
    }
    if (cleanRows.length === 0) {
      showAlert("⚠️ ADD AT LEAST ONE ITEM");
      return;
    }
    let ledger = ledgers.find(l => l.name.toUpperCase() === name);
    if (!ledger) {
      ledger = DB.saveLedger({ id: DB.generateId(), name })!;
    }
    const invoice: Invoice = {
      id: isEditMode && id ? id : DB.generateId(),
      serialNo: finalSerial,
      date,
      ledgerId: ledger.id,
      items: cleanRows,
      grandTotal: cleanRows.reduce((sum, row) => sum + row.amount, 0)
    };
    if (isEditMode ? DB.updateInvoice(invoice) : DB.saveInvoice(invoice)) {
      showAlert("✅ SAVED!");
      if (isEditMode) navigate('/reports');
      else {
        setLedgerName('');
        setItems([{ id: DB.generateId(), particulars: '', qty: '', rate: '', amount: 0 }]);
        setSerialNo(DB.getNextSerial());
      }
    }
  };

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="bg-white border-2 border-black p-2 md:p-8 invoice-font w-full mx-auto pb-64 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative pt-0">
      <div className="sticky top-0 bg-white z-[100] border-2 border-black p-2 mb-2 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-lg font-black uppercase italic text-indigo-700 leading-none tracking-tighter">Challan</h1>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-[9px] font-bold outline-none mt-0.5 bg-transparent block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[7px] font-black text-gray-500 uppercase leading-none">Serial</div>
            <div className="flex items-center justify-end">
              <span className="text-base font-black leading-none mr-0.5">#</span>
              <input 
                type="text" 
                inputMode="numeric"
                value={serialNo} 
                onChange={e => setSerialNo(e.target.value)}
                className="text-base font-black leading-none w-12 text-right bg-transparent border-b border-dashed border-black focus:border-black outline-none"
              />
            </div>
          </div>
          <button type="button" onClick={handleSave} className="bg-indigo-700 text-white p-2 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-col items-center">
        <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5 mb-1">Party Name</label>
        <div className="relative w-full">
          <input 
            id="party-input"
            type="text" 
            autoComplete="off"
            value={ledgerName}
            onKeyDown={(e) => handleKeyDown(e, 'name')}
            onChange={e => { setLedgerName(e.target.value); setShowSuggestions(true); }}
            className="w-full border-b-2 border-black py-0.5 text-lg font-black uppercase focus:outline-none bg-transparent text-center" 
            placeholder="TYPE NAME..."
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full bg-white border-2 border-black mt-1 shadow-2xl">
              {suggestions.map(s => (
                <div key={s.id} onClick={() => { setLedgerName(s.name); setShowSuggestions(false); }} className="p-2 border-b last:border-0 font-black uppercase hover:bg-black hover:text-white cursor-pointer text-sm">
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="grid grid-cols-12 gap-1 text-[7px] font-black uppercase text-black border-b border-black pb-0.5">
          <div className="col-span-3">Particulars</div>
          <div className="col-span-4 text-center">Qty</div>
          <div className="col-span-2 text-center">Rate</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-1"></div>
        </div>

        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-1 items-center border-b border-gray-100 pb-1">
            <div className="col-span-3">
              <input id={`particulars-${item.id}`} type="text" value={item.particulars} onKeyDown={(e) => handleKeyDown(e, 'particulars', item.id)} onChange={e => handleItemChange(item.id, 'particulars', e.target.value)} className="w-full font-bold uppercase text-[12px] outline-none bg-transparent" placeholder="..." />
            </div>
            <div className="col-span-4">
              <input id={`qty-${item.id}`} type="text" inputMode="decimal" value={item.qty} onKeyDown={(e) => handleKeyDown(e, 'qty', item.id)} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} className="w-full font-black text-[13px] text-center bg-transparent border-b border-transparent focus:border-black outline-none" placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <input id={`rate-${item.id}`} type="text" inputMode="decimal" value={item.rate} onKeyDown={(e) => handleKeyDown(e, 'rate', item.id)} onChange={e => handleItemChange(item.id, 'rate', e.target.value)} className="w-full font-black text-[13px] text-center bg-transparent border-b border-transparent focus:border-black outline-none" />
            </div>
            <div className="col-span-2 text-right font-black text-[13px] truncate">{formatNum(item.amount)}</div>
            <div className="col-span-1 text-right">
              <button type="button" onClick={() => removeItem(item.id)} className="text-black hover:text-red-600 p-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button type="button" onClick={addItem} className="px-4 py-1.5 border-2 border-dashed border-black font-black uppercase text-[8px] tracking-widest">+ Add Row</button>
      </div>

      <div className="flex justify-between items-end border-t-2 border-black pt-1">
        <div className="text-[7px] font-black uppercase text-gray-500 italic">Official</div>
        <div className="text-right">
          <div className="text-[9px] font-black uppercase opacity-60">Grand Total</div>
          <div className="text-3xl font-black">₹{formatNum(grandTotal)}</div>
        </div>
      </div>

      <div className="mt-6">
        <button type="button" onClick={handleSave} className="w-full bg-indigo-700 text-white py-4 font-black uppercase tracking-widest text-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
          {isEditMode ? 'Update' : 'Save Challan'}
        </button>
      </div>
    </div>
  );
};

export default InvoicePage;