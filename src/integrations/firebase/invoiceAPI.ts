import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { removeUndefined } from "./utils";

export interface InvoiceItem {
  description: string;
  quantity: number;
  taxPercent?: number;
  unitPrice: number;
}

export type InvoiceStatus = "Draft" | "Send" | "Pending" | "Approved" | "Reject" | "Expired" | "Cancelled";
export const INVOICE_STATUSES: InvoiceStatus[] = ["Draft", "Send", "Pending", "Approved", "Reject", "Expired", "Cancelled"];

export interface Invoice {
  id?: string;
  invoiceNo: string;
  issueDate: string;
  validTill: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  invoiceReference: string;
  fbrReference: string;
  items: InvoiceItem[];
  note: string;
  terms: string;
  companyProfileId?: string;
  companyProfileName?: string;
  sectorProjectId?: string;
  sectorProjectName?: string;
  status?: "draft" | "completed";
  invoiceStatus?: InvoiceStatus;
  sourceQuotationId?: string;
  sourceQuotationNo?: string;
  created_at?: string;
  updated_at?: string;
}

const INVOICES_COLLECTION = "invoices";

async function getLatestInvoiceSequence(): Promise<number> {
  const snapshot = await getDocs(collection(db, INVOICES_COLLECTION));
  return snapshot.docs.reduce((latest, invoice) => {
    const match = /^IN-OI-\\d{4}-(\\d+)$/.exec(invoice.data().invoiceNo || "");
    return match ? Math.max(latest, Number(match[1])) : latest;
  }, 0);
}

async function generateInvoiceNumber(issueDate?: string): Promise<string> {
  const latestInvoiceSequence = await getLatestInvoiceSequence();
  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterRef = doc(db, "sequences", "invoiceCounter");
    const counter = await transaction.get(counterRef);
    const next = (counter.exists() ? counter.data().nextNumber || 0 : latestInvoiceSequence) + 1;
    transaction.set(counterRef, { nextNumber: next, updated_at: new Date().toISOString() });
    return next;
  });
  const year = issueDate?.slice(0, 4) || String(new Date().getFullYear());
  return `IN-OI-${year}-${String(nextNumber).padStart(3, "0")}`;
}

function mapInvoice(id: string, data: Record<string, any>): Invoice {
  const legacyItems = Array.isArray(data.equipment)
    ? data.equipment.map((item: Record<string, any>) => ({
        description: [item.name, item.details].filter(Boolean).join(" — "),
        quantity: Number(item.quantity) || 0,
        taxPercent: Number(item.taxPercent) || 0,
        unitPrice: Number(item.unitPrice) || 0,
      }))
    : [];
  const items = Array.isArray(data.items) ? data.items : legacyItems;
  const invoiceStatus = INVOICE_STATUSES.includes(data.invoiceStatus) ? data.invoiceStatus : "Draft";
  return {
    id,
    ...data,
    invoiceNo: data.invoiceNo || "",
    issueDate: data.issueDate || data.date || "",
    validTill: data.validTill || "",
    customerName: data.customerName || data.invoiceTo || data.millName || "",
    customerAddress: data.customerAddress || data.location || "",
    customerPhone: data.customerPhone || "",
    invoiceReference: data.invoiceReference || data.quoteReference || data.poNumber || "",
    fbrReference: data.fbrReference || "",
    items,
    note: data.note || "",
    terms: data.terms || "",
    invoiceStatus,
  } as Invoice;
}

export const invoiceAPI = {
  subscribeAll(callback: (invoices: Invoice[]) => void, onError?: (error: Error) => void, maxItems = 50): Unsubscribe {
    const q = query(collection(db, INVOICES_COLLECTION), orderBy("created_at", "desc"), limit(maxItems));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((invoice) => mapInvoice(invoice.id, invoice.data())));
    }, onError);
  },

  async getById(id: string): Promise<Invoice | null> {
    const snapshot = await getDoc(doc(db, INVOICES_COLLECTION, id));
    return snapshot.exists() ? mapInvoice(snapshot.id, snapshot.data()) : null;
  },

  async getByQuotationId(quotationId: string): Promise<Invoice | null> {
    const snapshot = await getDocs(query(
      collection(db, INVOICES_COLLECTION),
      where("sourceQuotationId", "==", quotationId),
      limit(1),
    ));
    const invoice = snapshot.docs[0];
    return invoice ? mapInvoice(invoice.id, invoice.data()) : null;
  },

  async getNextSequence(): Promise<number> {
    const snapshot = await getDoc(doc(db, "sequences", "invoiceCounter"));
    return snapshot.exists()
      ? (snapshot.data().nextNumber || 0) + 1
      : (await getLatestInvoiceSequence()) + 1;
  },

  async setNextSequence(nextSequence: number): Promise<void> {
    if (!Number.isSafeInteger(nextSequence) || nextSequence < 1) {
      throw new Error("Invoice sequence must be a positive whole number");
    }
    await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, "sequences", "invoiceCounter");
      await transaction.get(counterRef);
      transaction.set(counterRef, { nextNumber: nextSequence - 1, updated_at: new Date().toISOString() });
    });
  },

  async create(invoice: Invoice): Promise<Invoice> {
    const invoiceNo = invoice.invoiceNo || await generateInvoiceNumber(invoice.issueDate);
    const now = new Date().toISOString();
    const data = removeUndefined({
      ...invoice,
      invoiceNo,
      status: "draft",
      invoiceStatus: invoice.invoiceStatus || "Draft",
      created_at: now,
      updated_at: now,
    });
    const ref = await addDoc(collection(db, INVOICES_COLLECTION), data);
    return { id: ref.id, ...data } as Invoice;
  },

  async update(id: string, invoice: Partial<Invoice>): Promise<void> {
    await updateDoc(doc(db, INVOICES_COLLECTION, id), removeUndefined({ ...invoice, updated_at: new Date().toISOString() }));
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, INVOICES_COLLECTION, id));
  },
};
