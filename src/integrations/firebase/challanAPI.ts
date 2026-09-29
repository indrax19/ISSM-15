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

export interface ChallanEquipment {
  id?: string;
  name: string;
  quantity: number;
  serialNumbers: string[];
  barcodes: string[];
  category_id?: string;
  subcategory_id?: string;
  manualEquipmentDetails?: string;
  itemIds?: string[];
}

export type ChallanType = "external" | "internal";

const DEFAULT_CHALLAN_TYPE: ChallanType = "external";

function normalizeChallanType(challanType?: string): ChallanType {
  return challanType === "internal" ? "internal" : DEFAULT_CHALLAN_TYPE;
}

function mapChallan(docId: string, data: Record<string, any>): Challan {
  return {
    id: docId,
    ...data,
    challanType: normalizeChallanType(data.challanType),
  } as Challan;
}

export interface Challan {
  id?: string;
  challanType?: ChallanType;
  challanNo: string;
  date: string;
  poNumber?: string;
  deliveryDate: string;
  customerName: string;
  siteLocation?: string;
  unitNo?: string;
  pocName?: string;
  pocNumber?: string;
  deliveredFrom?: string;
  companyProfileId?: string;
  companyProfileName?: string;
  equipment: ChallanEquipment[];
  status?: "draft" | "completed";
  pdfUrl?: string;
  documentUrl?: string;
  created_at?: string;
  updated_at?: string;
}

function getChallanSequenceId(challanType: ChallanType): string {
  return challanType === "internal" ? "internalChallanCounter" : "challanCounter";
}

function getChallanPrefix(challanType: ChallanType): string {
  return challanType === "internal" ? "IDC" : "DC";
}

function getCompanyChallanPrefix(companyName: string): string {
  const firstLetter = companyName.trim().charAt(0).toUpperCase();
  return `${firstLetter || "D"}DC`;
}

function getCompanyChallanSequenceId(companyProfileId: string): string {
  return `companyChallanCounter_${companyProfileId}`;
}

async function generateChallanNumber(challanType: ChallanType = DEFAULT_CHALLAN_TYPE): Promise<string> {
  try {
    const nextNumber = await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, "sequences", getChallanSequenceId(challanType));
      const counterDoc = await transaction.get(counterRef);

      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().nextNumber || 0;
      }

      const nextNumber = currentNumber + 1;

      transaction.set(counterRef, { nextNumber, updated_at: new Date().toISOString() });

      return nextNumber;
    });

    return `${getChallanPrefix(challanType)}-${String(nextNumber).padStart(5, "0")}`;
  } catch (error) {
    console.error("Error generating challan number:", error);
    const timestamp = Date.now().toString();
    const random = timestamp.slice(-5).padStart(5, "0");
    return `${getChallanPrefix(challanType)}-${random}`;
  }
}

async function generateCompanyChallanNumber(companyProfile: { id?: string; company_name: string }): Promise<string> {
  const companyProfileId = companyProfile.id?.trim();
  const companyName = companyProfile.company_name.trim();

  if (!companyProfileId || !companyName) {
    return generateChallanNumber();
  }

  try {
    const nextNumber = await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, "sequences", getCompanyChallanSequenceId(companyProfileId));
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

    return `${getCompanyChallanPrefix(companyName)}-${String(nextNumber).padStart(5, "0")}`;
  } catch (error) {
    console.error("Error generating company challan number:", error);
    const timestamp = Date.now().toString();
    const random = timestamp.slice(-5).padStart(5, "0");
    return `${getCompanyChallanPrefix(companyName)}-${random}`;
  }
}

export const challanAPI = {
  async getAll(): Promise<Challan[]> {
    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const q = query(
          collection(db, "challans"),
          orderBy("created_at", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => mapChallan(doc.id, doc.data()));
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error?.message);

        // If it's a network error and we have retries left, wait and retry
        if (attempt < maxRetries && error?.message?.includes("Failed to fetch")) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // For non-network errors or last attempt, throw
        break;
      }
    }

    // Throw the last error we encountered
    throw lastError || new Error("Failed to fetch delivery challans");
  },

  async getById(id: string): Promise<Challan | null> {
    const docRef = doc(db, "challans", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return mapChallan(docSnap.id, docSnap.data() as Record<string, any>);
    }
    return null;
  },

  async getByCustomer(customerName: string): Promise<Challan[]> {
    try {
      const q = query(
        collection(db, "challans"),
        where("customerName", "==", customerName),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => mapChallan(doc.id, doc.data()));
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async create(challan: Challan) {
    try {
      const challanType = normalizeChallanType(challan.challanType);
      const challanNo =
        challan.challanNo ||
        (challan.companyProfileId && challan.companyProfileName
          ? await generateCompanyChallanNumber({
              id: challan.companyProfileId,
              company_name: challan.companyProfileName,
            })
          : await generateChallanNumber(challanType));
      const data = removeUndefined({
        ...challan,
        challanType,
        challanNo,
        status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "challans"), data);
      return { id: docRef.id, ...data } as Challan;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create challan"
      );
    }
  },

  async generateCompanyChallanNumber(companyProfile: { id?: string; company_name: string }) {
    return generateCompanyChallanNumber(companyProfile);
  },

  async update(id: string, challan: Partial<Challan>) {
    try {
      const data = removeUndefined({
        ...challan,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "challans", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update challan"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "challans", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete challan"
      );
    }
  },

  /**
   * Subscribe to real-time updates of challans with pagination support
   * Loads initial batch and subscribes to updates for better performance with large datasets
   */
  subscribeAll(
    callback: (challans: Challan[]) => void,
    onError?: (error: Error) => void,
    pageLimit: number = 200
  ): Unsubscribe {
    // Query with limit for better performance
    const q = query(
      collection(db, "challans"),
      orderBy("created_at", "desc"),
      limit(pageLimit)
    );

    let retryCount = 0;
    const MAX_RETRIES = 3;
    let unsubscribe: Unsubscribe | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let cachedChallans: Challan[] = [];

    const setupSubscription = () => {
      try {
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            retryCount = 0;
            const challans = snapshot.docs.map((doc) => mapChallan(doc.id, doc.data()));
            cachedChallans = challans;
            callback(challans);
          },
          (error) => {
            if (handleFirestoreError(error)) return;

            console.error(`Error in challans subscription (attempt ${retryCount + 1}):`, error);

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
                  const challans = snapshot.docs.map((doc) => mapChallan(doc.id, doc.data()));
                  cachedChallans = challans;
                  callback(challans);
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

  /**
   * Subscribe to real-time updates of a single challan
   */
  subscribeById(
    id: string,
    callback: (challan: Challan | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = doc(db, "challans", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(mapChallan(snapshot.id, snapshot.data() as Record<string, any>));
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in challan subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};
