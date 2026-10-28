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
} from "firebase/firestore";
import { db } from "./config";
import { removeUndefined } from "./utils";

export interface QuotationItem {
  itemType?: "Hardware" | "Software";
  description: string;
  quantity: number;
  taxPercent?: number;
  unitPrice: number;
}

export type QuotationStatus = "Draft" | "Send" | "Pending" | "Approved" | "Reject" | "Expired" | "Cancelled";

export const QUOTATION_STATUSES: QuotationStatus[] = ["Draft", "Send", "Pending", "Approved", "Reject", "Expired", "Cancelled"];

export interface Quotation {
  id?: string;
  quotationNo: string;
  issueDate: string;
  validTill: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  quoteReference: string;
  fbrReference: string;
  items: QuotationItem[];
  note: string;
  terms: string;
  companyProfileId?: string;
  companyProfileName?: string;
  sectorProjectId?: string;
  sectorProjectName?: string;
  status?: "draft" | "completed";
  quotationStatus?: QuotationStatus;
  created_at?: string;
  updated_at?: string;
}

const QUOTATIONS_COLLECTION = "quotations";

async function generateQuotationNumber(sectorName?: string, issueDate?: string): Promise<string> {
  const sectorCode = sectorName?.trim().slice(0, 2).toUpperCase() || "GE";
  const year = issueDate?.slice(0, 4) || String(new Date().getFullYear());
  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterRef = doc(db, "sequences", "quotationCounter");
    const counter = await transaction.get(counterRef);
    const next = (counter.exists() ? counter.data().nextNumber || 0 : 0) + 1;
    transaction.set(counterRef, { nextNumber: next, updated_at: new Date().toISOString() });
    return next;
  });
  return `QT-${sectorCode}-${year}-${String(nextNumber).padStart(3, "0")}`;
}

function mapQuotation(id: string, data: Record<string, unknown>): Quotation {
  const quotationStatus = QUOTATION_STATUSES.includes(data.quotationStatus as QuotationStatus)
    ? data.quotationStatus as QuotationStatus
    : "Draft";
  return { id, ...data, quotationStatus } as Quotation;
}

export const quotationAPI = {
  subscribeAll(onData: (quotations: Quotation[]) => void, onError?: (error: Error) => void, maxItems = 50): Unsubscribe {
    const q = query(collection(db, QUOTATIONS_COLLECTION), orderBy("created_at", "desc"), limit(maxItems));
    return onSnapshot(q, (snapshot) => {
      onData(snapshot.docs.map((quotation) => mapQuotation(quotation.id, quotation.data())));
    }, onError);
  },

  async getById(id: string): Promise<Quotation | null> {
    const snapshot = await getDoc(doc(db, QUOTATIONS_COLLECTION, id));
    return snapshot.exists() ? mapQuotation(snapshot.id, snapshot.data()) : null;
  },

  async getLatest(): Promise<Quotation[]> {
    const snapshot = await getDocs(query(collection(db, QUOTATIONS_COLLECTION), orderBy("created_at", "desc"), limit(50)));
    return snapshot.docs.map((quotation) => mapQuotation(quotation.id, quotation.data()));
  },

  async getNextSequence(): Promise<number> {
    const snapshot = await getDoc(doc(db, "sequences", "quotationCounter"));
    return (snapshot.exists() ? snapshot.data().nextNumber || 0 : 0) + 1;
  },

  async setNextSequence(nextSequence: number): Promise<void> {
    if (!Number.isSafeInteger(nextSequence) || nextSequence < 1) {
      throw new Error("Quotation sequence must be a positive whole number");
    }
    await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, "sequences", "quotationCounter");
      await transaction.get(counterRef);
      transaction.set(counterRef, { nextNumber: nextSequence - 1, updated_at: new Date().toISOString() });
    });
  },

  async getAll(): Promise<Quotation[]> {
    const snapshot = await getDocs(query(collection(db, QUOTATIONS_COLLECTION), orderBy("created_at", "desc")));
    return snapshot.docs.map((quotation) => mapQuotation(quotation.id, quotation.data()));
  },

  async create(quotation: Quotation): Promise<Quotation> {
    const quotationNo = quotation.quotationNo || await generateQuotationNumber(quotation.sectorProjectName, quotation.issueDate);
    const now = new Date().toISOString();
    const data = removeUndefined({ ...quotation, quotationNo, status: "draft", quotationStatus: quotation.quotationStatus || "Draft", created_at: now, updated_at: now });
    const ref = await addDoc(collection(db, QUOTATIONS_COLLECTION), data);
    return { id: ref.id, ...data } as Quotation;
  },

  async update(id: string, quotation: Partial<Quotation>): Promise<void> {
    await updateDoc(doc(db, QUOTATIONS_COLLECTION, id), removeUndefined({ ...quotation, updated_at: new Date().toISOString() }));
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, QUOTATIONS_COLLECTION, id));
  },
};
