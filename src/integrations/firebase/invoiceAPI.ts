import { db } from "./config";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  onSnapshot,
  Unsubscribe,
  runTransaction,
  limit,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export interface InvoiceEquipment {
  id?: string;
  name: string;
  details?: string;
  quantity: number;
  unitPrice: number;
  barcodes?: string[];
  category_id?: string;
  subcategory_id?: string;
  itemIds?: string[];
}

export type InvoiceType = "sales" | "purchase";

const DEFAULT_INVOICE_TYPE: InvoiceType = "sales";

function normalizeInvoiceType(invoiceType?: string): InvoiceType {
  return invoiceType === "purchase" ? "purchase" : DEFAULT_INVOICE_TYPE;
}

function mapInvoice(docId: string, data: Record<string, any>): Invoice {
  return {
    id: docId,
    ...data,
    invoiceType: normalizeInvoiceType(data.invoiceType),
  } as Invoice;
}

export interface Invoice {
  id?: string;
  invoiceType?: InvoiceType;
  invoiceNo: string;
  date: string;
  poNumber?: string;
  millName: string;
  location: string;
  unit?: string;
  equipment: InvoiceEquipment[];
  invoiceAmount: number;
  balancePaid: number;
  invoiceStatus?: "draft" | "completed" | "paid";
  poStatus?: "pending" | "completed" | "cancelled";
  invoiceCategory?: "Hardware" | "Software" | "Deployment";
  invoiceTo?: string;
  companyProfileId?: string;
  companyProfileName?: string;
  status?: "draft" | "completed";
  pdfUrl?: string;
  documentUrl?: string;
  receiptUrl?: string;
  created_at?: string;
  updated_at?: string;
}

function getInvoiceSequenceId(invoiceType: InvoiceType): string {
  return invoiceType === "purchase" ? "purchaseInvoiceCounter" : "salesInvoiceCounter";
}

function getInvoicePrefix(invoiceType: InvoiceType): string {
  return invoiceType === "purchase" ? "PI" : "SI";
}

function getCompanyInvoicePrefix(companyName: string): string {
  const firstLetter = companyName.trim().charAt(0).toUpperCase();
  return `${firstLetter || "I"}INV`;
}

function getCompanyInvoiceSequenceId(companyProfileId: string): string {
  return `companyInvoiceCounter_${companyProfileId}`;
}

async function generateInvoiceNumber(invoiceType: InvoiceType = DEFAULT_INVOICE_TYPE): Promise<string> {
  try {
    const nextNumber = await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, "sequences", getInvoiceSequenceId(invoiceType));
      const counterDoc = await transaction.get(counterRef);

      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().nextNumber || 0;
      }

      const nextNumber = currentNumber + 1;

      transaction.set(counterRef, { nextNumber, updated_at: new Date().toISOString() });

      return nextNumber;
    });

    return `${getInvoicePrefix(invoiceType)}-${String(nextNumber).padStart(5, "0")}`;
  } catch (error) {
    console.error("Error generating invoice number:", error);
    const timestamp = Date.now().toString();
    const random = timestamp.slice(-5).padStart(5, "0");
    return `${getInvoicePrefix(invoiceType)}-${random}`;
  }
}

async function generateCompanyInvoiceNumber(companyProfile: { id?: string; company_name: string }): Promise<string> {
  const companyProfileId = companyProfile.id?.trim();
  const companyName = companyProfile.company_name.trim();

  if (!companyProfileId || !companyName) {
    return generateInvoiceNumber();
  }

  try {
    const nextNumber = await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, "sequences", getCompanyInvoiceSequenceId(companyProfileId));
      const counterDoc = await transaction.get(counterRef);

      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().nextNumber || 0;
      }

      const nextNumber = currentNumber + 1;
      transaction.set(counterRef, {
        nextNumber,
        updated_at: new Date().toISOString(),
        companyProfileId,
        companyName,
      });

      return nextNumber;
    });

    return `${getCompanyInvoicePrefix(companyName)}-${String(nextNumber).padStart(5, "0")}`;
  } catch (error) {
    console.error("Error generating company invoice number:", error);
    const timestamp = Date.now().toString();
    const random = timestamp.slice(-5).padStart(5, "0");
    return `${getCompanyInvoicePrefix(companyName)}-${random}`;
  }
}

export const invoiceAPI = {
  async getAll(): Promise<Invoice[]> {
    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const q = query(
          collection(db, "invoices"),
          orderBy("created_at", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => mapInvoice(doc.id, doc.data()));
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error?.message);

        if (attempt < maxRetries && error?.message?.includes("Failed to fetch")) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        break;
      }
    }

    throw lastError || new Error("Failed to fetch invoices");
  },

  async getById(id: string): Promise<Invoice | null> {
    const docRef = doc(db, "invoices", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return mapInvoice(docSnap.id, docSnap.data() as Record<string, any>);
    }
    return null;
  },

  async getByMillName(millName: string): Promise<Invoice[]> {
    try {
      const q = query(
        collection(db, "invoices"),
        where("millName", "==", millName),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => mapInvoice(doc.id, doc.data()));
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async create(invoice: Invoice) {
    try {
      const invoiceType = normalizeInvoiceType(invoice.invoiceType);
      const invoiceNo =
        invoice.invoiceNo ||
        (invoice.companyProfileId && invoice.companyProfileName
          ? await generateCompanyInvoiceNumber({
              id: invoice.companyProfileId,
              company_name: invoice.companyProfileName,
            })
          : await generateInvoiceNumber(invoiceType));
      const data = removeUndefined({
        ...invoice,
        invoiceType,
        invoiceNo,
        status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "invoices"), data);
      return { id: docRef.id, ...data } as Invoice;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create invoice"
      );
    }
  },

  async generateCompanyInvoiceNumber(companyProfile: { id?: string; company_name: string }) {
    return generateCompanyInvoiceNumber(companyProfile);
  },

  async update(id: string, invoice: Partial<Invoice>) {
    try {
      const data = removeUndefined({
        ...invoice,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "invoices", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update invoice"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "invoices", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete invoice"
      );
    }
  },

  subscribeAll(
    callback: (invoices: Invoice[]) => void,
    onError?: (error: Error) => void,
    pageLimit: number = 200
  ): Unsubscribe {
    const q = query(
      collection(db, "invoices"),
      orderBy("created_at", "desc"),
      limit(pageLimit)
    );

    let retryCount = 0;
    const MAX_RETRIES = 3;
    let unsubscribe: Unsubscribe | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let cachedInvoices: Invoice[] = [];

    const setupSubscription = () => {
      try {
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            retryCount = 0;
            const invoices = snapshot.docs.map((doc) => mapInvoice(doc.id, doc.data()));
            cachedInvoices = invoices;
            callback(invoices);
          },
          (error) => {
            if (handleFirestoreError(error)) return;

            console.error(`Error in invoices subscription (attempt ${retryCount + 1}):`, error);

            if (retryCount < MAX_RETRIES && error?.message?.includes("Failed to fetch")) {
              retryCount++;
              const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
              console.log(`Retrying subscription in ${waitTime}ms...`);

              unsubscribe?.();
              retryTimeout = setTimeout(setupSubscription, waitTime);
            } else {
              // Fallback to one-time fetch if subscription fails
              getDocs(q)
                .then(snapshot => {
                  const invoices = snapshot.docs.map((doc) => mapInvoice(doc.id, doc.data()));
                  cachedInvoices = invoices;
                  callback(invoices);
                })
                .catch(fallbackError => {
                  console.error("Fallback fetch also failed:", fallbackError);
                  onError?.(fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
                });
            }
          }
        );
      } catch (error) {
        console.error("Error setting up subscription:", error);
        onError?.(error as Error);
      }
    };

    setupSubscription();

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  },

  subscribeById(
    id: string,
    callback: (invoice: Invoice | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = doc(db, "invoices", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(mapInvoice(snapshot.id, snapshot.data() as Record<string, any>));
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in invoice subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};
