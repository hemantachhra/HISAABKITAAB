
import { Ledger, Invoice, Receipt, StorageKeys } from './types';

const VERSION_KEY = 'CK_APP_DATA_VERSION';

const getPrefix = () => {
  return 'v' + (localStorage.getItem(VERSION_KEY) || '1') + '_';
};

const tryParse = (input: any): any => {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch (e) { return null; }
};

export const DB = {
  generateId: () => 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1000000),
  
  getLedgers: (): Ledger[] => tryParse(localStorage.getItem(getPrefix() + StorageKeys.LEDGERS)) || [],
  getInvoices: (): Invoice[] => tryParse(localStorage.getItem(getPrefix() + StorageKeys.INVOICES)) || [],
  getReceipts: (): Receipt[] => tryParse(localStorage.getItem(getPrefix() + StorageKeys.RECEIPTS)) || [],
  getNextSerial: (): number => Number(localStorage.getItem(getPrefix() + StorageKeys.SERIAL_COUNTER)) || 1,

  saveLedger: (ledger: Ledger) => {
    const list = DB.getLedgers();
    if (!list.find(l => l.id === ledger.id)) {
      localStorage.setItem(getPrefix() + StorageKeys.LEDGERS, JSON.stringify([...list, ledger]));
    }
  },

  saveInvoice: (invoice: Invoice) => {
    localStorage.setItem(getPrefix() + StorageKeys.INVOICES, JSON.stringify([...DB.getInvoices(), invoice]));
    localStorage.setItem(getPrefix() + StorageKeys.SERIAL_COUNTER, (invoice.serialNo + 1).toString());
    return true;
  },

  updateInvoice: (invoice: Invoice) => {
    const updated = DB.getInvoices().map(i => i.id === invoice.id ? invoice : i);
    localStorage.setItem(getPrefix() + StorageKeys.INVOICES, JSON.stringify(updated));
    return true;
  },

  saveReceipt: (receipt: Receipt) => {
    localStorage.setItem(getPrefix() + StorageKeys.RECEIPTS, JSON.stringify([...DB.getReceipts(), receipt]));
    return true;
  },

  updateReceipt: (receipt: Receipt) => {
    const updated = DB.getReceipts().map(r => r.id === receipt.id ? receipt : r);
    localStorage.setItem(getPrefix() + StorageKeys.RECEIPTS, JSON.stringify(updated));
    return true;
  },

  clearAll: () => {
    // 1. Clear everything
    localStorage.clear();
    sessionStorage.clear();
    
    // 2. Also explicitly remove version key
    localStorage.removeItem(VERSION_KEY);
    
    // 3. Set a fresh start
    localStorage.setItem(VERSION_KEY, '1');
    return true;
  },

  getFullBackup: () => ({
    ledgers: DB.getLedgers(),
    invoices: DB.getInvoices(),
    receipts: DB.getReceipts(),
    lastSerial: DB.getNextSerial(),
    version: localStorage.getItem(VERSION_KEY) || '1'
  }),

  restoreBackup: (data: any): boolean => {
    try {
      if (!data || typeof data !== 'object') return false;
      localStorage.clear();
      const ver = data.version || '1';
      localStorage.setItem(VERSION_KEY, ver);
      const prefix = 'v' + ver + '_';
      localStorage.setItem(prefix + StorageKeys.LEDGERS, JSON.stringify(data.ledgers || []));
      localStorage.setItem(prefix + StorageKeys.INVOICES, JSON.stringify(data.invoices || []));
      localStorage.setItem(prefix + StorageKeys.RECEIPTS, JSON.stringify(data.receipts || []));
      localStorage.setItem(prefix + StorageKeys.SERIAL_COUNTER, (data.lastSerial || 1).toString());
      return true;
    } catch (e) { return false; }
  },

  getStats: () => ({
    invoices: DB.getInvoices().length,
    ledgers: DB.getLedgers().length,
    receipts: DB.getReceipts().length,
    version: localStorage.getItem(VERSION_KEY) || '1'
  })
};
