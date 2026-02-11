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
    }, 150);
  };

  useLayoutEffect(() => {
    if (nextFocusId) {
      forceFocus(nextFocusId);
      setNextFocusId(null);
    }
  }, [nextFocusId]);

  const refreshLedgers = () => {
    setLedgers(DB.getLedgers());
  };

  useEffect(() => {
    refreshLedgers();

    if (id) {
      const existing = DB.getInvoices().find(inv => inv.id === id);
      if (existing) {
        setIsEditMode(true);
        setDate(existing.date);
        setSerialNo(existing.serialNo);
        setItems(existing.items);
        const currentLedgers = DB.getLedgers();
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
      showAlert("⚠️ ENTER CLIENT NAME");
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

  const handleWhatsApp = () => {
    if (!ledgerName || items.length === 0) return;
    const cleanDate = date.split('-').reverse().join('-');
    let msg = `*CHALLAN KITAB*\n`;
    msg += `--------------------------\n`;
    msg += `*Challan No:* ${serialNo}\n`;
    msg += `*Date:* ${cleanDate}\n`;
    msg += `*Client:* ${ledgerName.toUpperCase()}\n`;
    msg += `--------------------------\n`;
    items.forEach(item => {
      if (item.particulars) {
        msg += `• ${item.particulars}\n  ${item.qty} x ${item.rate} = *₹${formatNum(item.amount)}*\n`;
      }
    });
    msg += `--------------------------\n`;
    msg += `*GRAND TOTAL: ₹${formatNum(grandTotal)} LENA*\n`;
    msg += `--------------------------\n`;
    msg += `Thank you!`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  // COLUMN SPECS:
  // Particulars: Max (1fr)
  // Qty: 52px (~7 spaces)
  // Rate: 52px (~7 spaces)
  // Total: 74px (~9 spaces)
  // Delete: 24px
  const GRID_CLASS = "grid grid-cols-[1fr_52px_52px_74px_24px] gap-x-0.5 items-start";

  return (
    <div className="bg-white border-2 border-black p-1 md:p-6 invoice-font w-full mx-auto pb-72 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative pt-0 mt-[-2px] overflow-x-hidden">
      {/* Header Section */}
      <div className="sticky top-0 bg-white z-[100] border-2 border-black p-2 mb-2 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-sm font-black uppercase italic text-indigo-700 leading-none tracking-tighter">Challan</h1>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-[10px] font-bold outline-none mt-1 bg-transparent block" />
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleWhatsApp} className="bg-green-600 text-white p-1.5 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          </button>
          <div className="text-right">
            <div className="text-[6px] font-black text-gray-500 uppercase leading-none">Serial</div>
            <div className="flex items-center justify-end">
              <span className="text-xs font-black leading-none mr-0.5">#</span>
              <input type="text" inputMode="numeric" value={serialNo} onChange={e => setSerialNo(e.target.value)} className="text-xs font-black leading-none w-8 text-right bg-transparent border-b border-dashed border-black outline-none" />
            </div>
          </div>
          <button type="button" onClick={handleSave} className="bg-indigo-700 text-white p-1.5 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
          </button>
        </div>
      </div>

      {/* Client Name Section */}
      <div className="mb-4 flex flex-col items-center">
        <label className="text-[7px] font-black uppercase bg-black text-white px-1.5 py-0.5 mb-1 z-10 block">Client Name</label>
        <div className="relative w-full flex justify-center mt-[-4px]">
          <div className="relative w-full md:w-1/2">
            <input 
              id="party-input"
              type="text" 
              autoComplete="off"
              value={ledgerName}
              onFocus={() => { refreshLedgers(); setShowSuggestions(true); }}
              onKeyDown={(e) => handleKeyDown(e, 'name')}
              onChange={e => { setLedgerName(e.target.value); setShowSuggestions(true); }}
              className="w-full border-b-2 border-black py-0.5 text-lg font-black uppercase focus:outline-none bg-transparent text-center" 
              placeholder="TYPE NAME..."
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

      {/* Items Grid */}
      <div className="space-y-0.5">
        <div className={`${GRID_CLASS} text-[7px] font-black uppercase text-black border-b border-black pb-1 px-1`}>
          <div className="pl-1">Particulars</div>
          <div className="text-center">Qty</div>
          <div className="text-center">Rate</div>
          <div className="text-right pr-2">Total</div>
          <div></div>
        </div>

        {items.map((item) => (
          <div key={item.id} className={`${GRID_CLASS} border-b border-gray-100 py-1.5 px-0.5 min-h-[44px]`}>
            <div className="relative pt-0.5">
              <textarea 
                id={`particulars-${item.id}`} 
                rows={1}
                value={item.particulars} 
                onKeyDown={(e) => handleKeyDown(e, 'particulars', item.id)} 
                onChange={e => handleItemChange(item.id, 'particulars', e.target.value)} 
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
                className="w-full font-bold uppercase text-[12px] outline-none bg-transparent resize-none overflow-hidden block min-h-[1.5rem] leading-tight pr-1" 
                placeholder="..." 
              />
            </div>
            <div>
              <input 
                id={`qty-${item.id}`} 
                type="text" 
                inputMode="decimal" 
                value={item.qty} 
                onKeyDown={(e) => handleKeyDown(e, 'qty', item.id)} 
                onChange={e => handleItemChange(item.id, 'qty', e.target.value)} 
                className="w-full font-black text-[11px] text-center bg-white border border-gray-400 p-1 rounded outline-none focus:border-indigo-600" 
                placeholder="0" 
              />
            </div>
            <div>
              <input 
                id={`rate-${item.id}`} 
                type="text" 
                inputMode="decimal" 
                value={item.rate} 
                onKeyDown={(e) => handleKeyDown(e, 'rate', item.id)} 
                onChange={e => handleItemChange(item.id, 'rate', e.target.value)} 
                className="w-full font-black text-[11px] text-center bg-white border border-gray-400 p-1 rounded outline-none focus:border-indigo-600" 
                placeholder="0"
              />
            </div>
            <div className="text-right font-black text-[11px] truncate leading-tight pr-2 pt-2">{formatNum(item.amount)}</div>
            <div className="flex justify-center pt-1">
              <button type="button" onClick={() => removeItem(item.id)} className="w-5 h-5 flex items-center justify-center border border-black rounded-full text-black hover:bg-red-500 hover:text-white transition-colors">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end pr-2">
        <button type="button" onClick={addItem} className="px-3 py-1.5 border-2 border-dashed border-black font-black uppercase text-[8px] tracking-widest bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5">+ Add Row</button>
      </div>

      <div className="flex justify-between items-end border-t-2 border-black pt-2 mt-4">
        <div className="text-[7px] font-black uppercase text-gray-400 italic">Accounting System v1.1</div>
        <div className="text-right">
          <div className="text-[8px] font-black uppercase opacity-60">Grand Total</div>
          <div className="text-xl font-black">₹{formatNum(grandTotal)} LENA</div>
        </div>
      </div>

      <div className="mt-4">
        <button type="button" onClick={handleSave} className="w-full bg-indigo-700 text-white py-4 font-black uppercase tracking-widest text-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
          {isEditMode ? 'Update Record' : 'Save Challan'}
        </button>
      </div>
    </div>
  );
};

export default InvoicePage;