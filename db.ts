import { Ledger, Invoice, Receipt, StorageKeys } from './types';

const tryParse = (input: string | null): any => {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch (e) { 
    return null; 
  }
};

export const DB = {
  generateId: () => 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1000000),
  
  getLedgers: (): Ledger[] => tryParse(localStorage.getItem(StorageKeys.LEDGERS)) || [],
  getInvoices: (): Invoice[] => tryParse(localStorage.getItem(StorageKeys.INVOICES)) || [],
  getReceipts: (): Receipt[] => tryParse(localStorage.getItem(StorageKeys.RECEIPTS)) || [],
  getNextSerial: (): number => {
    const s = localStorage.getItem(StorageKeys.SERIAL_COUNTER);
    return s ? Number(s) : 1;
  },

  saveLedger: (ledger: Ledger): Ledger | null => {
    try {
      const list = DB.getLedgers();
      const existing = list.find(l => l.name.toUpperCase() === ledger.name.toUpperCase());
      if (existing) return existing;
      
      const newList = [...list, ledger];
      localStorage.setItem(StorageKeys.LEDGERS, JSON.stringify(newList));
      return ledger;
    } catch (e) {
      return null;
    }
  },

  saveInvoice: (invoice: Invoice): boolean => {
    try {
      const invoices = DB.getInvoices();
      invoices.push(invoice);
      localStorage.setItem(StorageKeys.INVOICES, JSON.stringify(invoices));
      // Always store next serial as invoice.serialNo + 1
      localStorage.setItem(StorageKeys.SERIAL_COUNTER, (invoice.serialNo + 1).toString());
      return true;
    } catch (e) {
      console.error("Save Error:", e);
      return false;
    }
  },

  updateInvoice: (invoice: Invoice): boolean => {
    try {
      const updated = DB.getInvoices().map(i => i.id === invoice.id ? invoice : i);
      localStorage.setItem(StorageKeys.INVOICES, JSON.stringify(updated));
      return true;
    } catch (e) {
      return false;
    }
  },

  saveReceipt: (receipt: Receipt): boolean => {
    try {
      const receipts = DB.getReceipts();
      receipts.push(receipt);
      localStorage.setItem(StorageKeys.RECEIPTS, JSON.stringify(receipts));
      return true;
    } catch (e) {
      return false;
    }
  },

  updateReceipt: (receipt: Receipt): boolean => {
    try {
      const updated = DB.getReceipts().map(r => r.id === receipt.id ? receipt : r);
      localStorage.setItem(StorageKeys.RECEIPTS, JSON.stringify(updated));
      return true;
    } catch (e) {
      return false;
    }
  },

  getLastRate: (ledgerId: string, particulars: string): number | null => {
    const invoices = DB.getInvoices();
    const cleanPart = particulars.trim().toUpperCase();
    for (let i = invoices.length - 1; i >= 0; i--) {
      if (invoices[i].ledgerId === ledgerId) {
        const item = invoices[i].items.find(it => it.particulars.trim().toUpperCase() === cleanPart);
        if (item && Number(item.rate) > 0) return Number(item.rate);
      }
    }
    return null;
  },

  clearAll: () => {
    localStorage.clear();
    return true;
  },

  getStats: () => ({
    invoices: DB.getInvoices().length,
    ledgers: DB.getLedgers().length,
    receipts: DB.getReceipts().length,
    version: '1'
  }),

  getFullBackup: () => ({
    ledgers: DB.getLedgers(),
    invoices: DB.getInvoices(),
    receipts: DB.getReceipts(),
    lastSerial: DB.getNextSerial(),
    version: '1'
  }),

  restoreBackup: (data: any): boolean => {
    try {
      localStorage.clear();
      localStorage.setItem(StorageKeys.LEDGERS, JSON.stringify(data.ledgers || []));
      localStorage.setItem(StorageKeys.INVOICES, JSON.stringify(data.invoices || []));
      localStorage.setItem(StorageKeys.RECEIPTS, JSON.stringify(data.receipts || []));
      localStorage.setItem(StorageKeys.SERIAL_COUNTER, (data.lastSerial || 1).toString());
      return true;
    } catch (e) { return false; }
  }
};