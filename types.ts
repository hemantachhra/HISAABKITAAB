export interface Ledger {
  id: string;
  name: string;
}

export interface InvoiceItem {
  id: string;
  particulars: string;
  qty: number | string;
  rate: number | string;
  amount: number;
}

export interface Invoice {
  id: string;
  serialNo: number;
  date: string;
  ledgerId: string;
  items: InvoiceItem[];
  grandTotal: number;
}

export interface Receipt {
  id: string;
  date: string;
  ledgerId: string;
  mode: 'Cash' | 'Bank';
  amount: number | string;
}

export interface LedgerSummary {
  name: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

export const StorageKeys = {
  LEDGERS: 'CK_PRO_DATA_LEDGERS',
  INVOICES: 'CK_PRO_DATA_INVOICES',
  RECEIPTS: 'CK_PRO_DATA_RECEIPTS',
  SERIAL_COUNTER: 'CK_PRO_DATA_SERIAL'
} as const;