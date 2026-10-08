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
  limit,
  startAfter,
  getCountFromServer,
  runTransaction,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

// Types for Firestore collections
export interface Category {
  id?: string;
  name: string;
  description?: string;
  model_number?: string;
  supplier_name?: string;
  iconUrl?: string;
  created_at?: string;
}

export interface SubCategory {
  id?: string;
  name: string;
  description?: string;
  model_no?: string;
  supplier_name?: string;
  category_id: string;
  created_at?: string;
}

export interface InventoryItem {
  id?: string;
  name?: string;
  serial_number: string;
  category_id: string;
  subcategory_id?: string;
  barcode?: string;
  status: "in" | "out";
  active_challan_id?: string;
  active_challan_no?: string;
  owner?: string;
  store_name?: string;
  created_at?: string;
  recipient_name?: string;
  site_name?: string;
  location?: string;
}

export interface InventoryTransaction {
  id?: string;
  item_id: string;
  type: "addition" | "removal" | "revert";
  created_by: string;
  challan_id?: string;
  challan_no?: string;
  created_at?: string;
  recipient_name?: string;
  site_name?: string;
  location?: string;
  notes?: string;
}

export interface Person {
  id?: string;
  name: string;
  assignedUsers?: string[];
  created_at?: string;
}

export interface PersonItem {
  id?: string;
  person_id: string;
  item_name: string;
  quantity: number;
  notes?: string;
  created_at?: string;
}

export interface PersonItemTransaction {
  id?: string;
  person_item_id: string;
  person_id: string;
  item_name: string;
  quantity_issued: number;
  recipient_name: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

export interface PersonSite {
  id?: string;
  person_id: string;
  site_name: string;
  status: "Travelling" | "Onsite – Work In Progress" | "Onsite – Completed" | "Returned to Base" | "Standby / Idle";
  poc_name?: string;
  poc_contact?: string;
  location?: string;
  created_at?: string;
}

export interface CompanyProfile {
  id?: string;
  company_name: string;
  phone: string;
  email: string;
  website?: string;
  logo_url?: string;
  signature_url?: string;
  show_in_reports?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeploymentCertificate {
  id?: string;
  site_id: string; // Reference to site_details
  company_name: string;
  site_address: string;
  mill_name?: string; // Name of the mill/site
  client_name: string;
  client_designation: string;
  client_signature?: string;
  client_date: string;
  deployment_date?: string;
  issm_name: string;
  issm_designation: string;
  issm_signature?: string;
  issm_date: string;
  company_stamp_url?: string;
  pdf_url?: string;
  companyProfileId?: string; // Reference to company_profile
  companyProfileName?: string;
  certificate_type?: "digital-eye" | "uqaab" | "issm"; // Type of certificate
  created_at?: string;
  updated_at?: string;
}

// Categories operations
export const categoriesAPI = {
  async getAll(): Promise<Category[]> {
    try {
      const q = query(collection(db, "categories"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<Category | null> {
    try {
      const docRef = doc(db, "categories", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Category;
      }
      return null;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      handleFirestoreError(error);
      return null;
    }
  },

  async create(category: Category) {
    try {
      const data = removeUndefined({
        ...category,
        ...(category.iconUrl ? { iconUrl: category.iconUrl } : {}),
        created_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "categories"), data);
      return docRef.id;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create category"
      );
    }
  },

  async update(id: string, category: Partial<Category>) {
    try {
      const data = removeUndefined({
        ...category,
        ...(category.iconUrl !== undefined ? { iconUrl: category.iconUrl } : {}),
      });
      const docRef = doc(db, "categories", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update category"
      );
    }
  },

  async delete(id: string) {
    try {
      // Get all items in this category
      const items = await inventoryItemsAPI.getByCategory(id);

      // Delete all items and their transactions
      for (const item of items) {
        // Get transactions for this item
        const transactions = await inventoryTransactionsAPI.getByItem(item.id!);
        // Delete all transactions
        for (const transaction of transactions) {
          await deleteDoc(doc(db, "inventory_transactions", transaction.id!));
        }
        // Delete the item
        await deleteDoc(doc(db, "inventory_items", item.id!));
      }

      // Get all subcategories in this category
      const subCategories = await subCategoriesAPI.getByCategory(id);

      // Delete all subcategories
      for (const subCat of subCategories) {
        await deleteDoc(doc(db, "sub_categories", subCat.id!));
      }

      // Finally delete the category itself
      await deleteDoc(doc(db, "categories", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete category"
      );
    }
  },

  async getAllWithCounts() {
    try {
      const categories = await this.getAll();
      const enriched = await Promise.all(
        categories.map(async (cat) => {
          const items = await inventoryItemsAPI.getByCategory(cat.id!);
          const subCategories = await subCategoriesAPI.getByCategory(cat.id!);
          return { ...cat, inventory_items: items, sub_categories: subCategories };
        })
      );
      return enriched;
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },
};

// SubCategories operations
export const subCategoriesAPI = {
  async getAll(): Promise<SubCategory[]> {
    try {
      const q = query(collection(db, "sub_categories"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SubCategory[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByCategory(categoryId: string): Promise<SubCategory[]> {
    try {
      const q = query(
        collection(db, "sub_categories"),
        where("category_id", "==", categoryId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SubCategory[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<SubCategory | null> {
    try {
      const docRef = doc(db, "sub_categories", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as SubCategory;
      }
      return null;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      handleFirestoreError(error);
      return null;
    }
  },

  async create(subCategory: SubCategory) {
    try {
      const data = removeUndefined({
        ...subCategory,
        created_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "sub_categories"), data);
      return docRef.id;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create sub category"
      );
    }
  },

  async update(id: string, subCategory: Partial<SubCategory>) {
    try {
      const data = removeUndefined(subCategory);
      const docRef = doc(db, "sub_categories", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update sub category"
      );
    }
  },

  async delete(id: string) {
    try {
      // Get all items in this subcategory
      const items = await inventoryItemsAPI.getBySubCategory(id);

      // Delete all items and their transactions
      for (const item of items) {
        // Get transactions for this item
        const transactions = await inventoryTransactionsAPI.getByItem(item.id!);
        // Delete all transactions
        for (const transaction of transactions) {
          await deleteDoc(doc(db, "inventory_transactions", transaction.id!));
        }
        // Delete the item
        await deleteDoc(doc(db, "inventory_items", item.id!));
      }

      // Finally delete the subcategory itself
      await deleteDoc(doc(db, "sub_categories", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete sub category"
      );
    }
  },

  async getWithItems(id: string) {
    try {
      const subCat = await this.getById(id);
      if (!subCat) return null;
      const items = await inventoryItemsAPI.getBySubCategory(id);
      return { ...subCat, inventory_items: items };
    } catch (error: any) {
      handleFirestoreError(error);
      return null;
    }
  },
};

// Inventory Items operations
export const inventoryItemsAPI = {
  async getAll(): Promise<InventoryItem[]> {
    try {
      const q = query(collection(db, "inventory_items"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByCategory(categoryId: string): Promise<InventoryItem[]> {
    try {
      const q = query(
        collection(db, "inventory_items"),
        where("category_id", "==", categoryId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getBySubCategory(subCategoryId: string): Promise<InventoryItem[]> {
    try {
      const q = query(
        collection(db, "inventory_items"),
        where("subcategory_id", "==", subCategoryId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByStatus(status: "in" | "out"): Promise<InventoryItem[]> {
    try {
      const q = query(
        collection(db, "inventory_items"),
        where("status", "==", status)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<InventoryItem | null> {
    try {
      const docRef = doc(db, "inventory_items", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as InventoryItem;
      }
      return null;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      handleFirestoreError(error);
      return null;
    }
  },

  async create(item: Partial<InventoryItem>) {
    try {
      // Check for duplicate serial number
      if (item.serial_number) {
        const existingItem = await this.getBySerialNumber(item.serial_number);
        if (existingItem) {
          throw new Error(`Serial number "${item.serial_number}" already exists in the database`);
        }
      }

      const data = removeUndefined({
        ...item,
        created_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "inventory_items"), data);
      return docRef.id;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create item"
      );
    }
  },

  async createBulk(items: Partial<InventoryItem>[]) {
    try {
      const createdIds: string[] = [];
      for (const item of items) {
        // Check for duplicate serial number
        if (item.serial_number) {
          const existingItem = await this.getBySerialNumber(item.serial_number);
          if (existingItem) {
            throw new Error(`Serial number "${item.serial_number}" already exists in the database`);
          }
        }

        const data = removeUndefined({
          ...item,
          created_at: new Date().toISOString(),
        });
        const docRef = await addDoc(collection(db, "inventory_items"), data);
        createdIds.push(docRef.id);
      }
      return createdIds;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create items"
      );
    }
  },

  async update(id: string, item: Partial<InventoryItem>) {
    try {
      const data = removeUndefined(item);
      const docRef = doc(db, "inventory_items", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update item"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "inventory_items", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete item"
      );
    }
  },

  async getAllWithCategories() {
    try {
      const items = await this.getAll();
      const enriched = await Promise.all(
        items.map(async (item) => {
          const category = item.category_id ? await categoriesAPI.getById(item.category_id) : null;
          const subCategory = item.subcategory_id ? await subCategoriesAPI.getById(item.subcategory_id) : null;

          // Get transaction data if item is issued
          let transaction = null;
          if (item.status === "out") {
            const transactions = await inventoryTransactionsAPI.getByItem(item.id!);
            transaction = transactions.find((t) => t.type === "removal") || null;
          }

          return { ...item, categories: category, sub_categories: subCategory, transaction };
        })
      );
      return enriched;
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getBySerialNumber(serialNumber: string) {
    try {
      const q = query(
        collection(db, "inventory_items"),
        where("serial_number", "==", serialNumber)
      );
      const snapshot = await getDocs(q);
      if (snapshot.docs.length > 0) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as InventoryItem;
      }
      return null;
    } catch (error: any) {
      handleFirestoreError(error);
      return null;
    }
  },

  async searchBySerialEnd(lastDigits: string): Promise<InventoryItem[]> {
    try {
      const allItems = await this.getAll();
      return allItems.filter((item) =>
        item.serial_number?.endsWith(lastDigits) && item.status === "in"
      );
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getUniqueStoreNames(): Promise<string[]> {
    try {
      const items = await this.getAll();
      const storeNames = items
        .map((item) => item.store_name)
        .filter((name): name is string => Boolean(name))
        .filter((name, index, self) => self.indexOf(name) === index);
      return storeNames.sort();
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },
};

// Inventory Transactions operations
export const inventoryTransactionsAPI = {
  async getAll(): Promise<InventoryTransaction[]> {
    try {
      const q = query(collection(db, "inventory_transactions"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryTransaction[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getRecent(limitCount: number = 30): Promise<InventoryTransaction[]> {
    try {
      const q = query(
        collection(db, "inventory_transactions"),
        orderBy("created_at", "desc"),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryTransaction[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByItem(itemId: string): Promise<InventoryTransaction[]> {
    try {
      const q = query(
        collection(db, "inventory_transactions"),
        where("item_id", "==", itemId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryTransaction[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByType(type: "addition" | "removal" | "revert"): Promise<InventoryTransaction[]> {
    try {
      const q = query(
        collection(db, "inventory_transactions"),
        where("type", "==", type)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryTransaction[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getPageWithRelated(page: number, pageSize: number | "all", recipient?: string, cursor?: string) {
    try {
      const recipientConstraint = recipient && recipient !== "all" ? [where("recipient_name", "==", recipient)] : [];
      const countQuery = query(collection(db, "inventory_transactions"), ...recipientConstraint);
      const total = pageSize === "all" ? undefined : (await getCountFromServer(countQuery)).data().count;
      const pageConstraints = [orderBy("created_at", "desc"), ...recipientConstraint];
      const pageQuery = pageSize === "all"
        ? query(collection(db, "inventory_transactions"), ...pageConstraints)
        : query(collection(db, "inventory_transactions"), ...pageConstraints, limit(pageSize), ...(cursor ? [startAfter(cursor)] : []));
      const snapshot = await getDocs(pageQuery);
      const transactions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const enriched = await Promise.all(
        transactions.map(async (t) => {
          const item = await inventoryItemsAPI.getById(t.item_id);
          const category = item?.category_id ? await categoriesAPI.getById(item.category_id) : null;
          return { ...t, inventory_items: item, categories: category };
        })
      );
      return { transactions: enriched, total: total ?? enriched.length };
    } catch (error: any) {
      handleFirestoreError(error);
      return { transactions: [], total: 0 };
    }
  },

  async getAllWithRelated() {
    try {
      const q = query(collection(db, "inventory_transactions"), orderBy("created_at", "desc"));
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      const enriched = await Promise.all(
        transactions.map(async (t) => {
          const item = await inventoryItemsAPI.getById(t.item_id);
          const category = item?.category_id ? await categoriesAPI.getById(item.category_id) : null;
          return { ...t, inventory_items: item, categories: category };
        })
      );

      return enriched;
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async create(transaction: Partial<InventoryTransaction>) {
    try {
      const data = removeUndefined({
        ...transaction,
        created_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "inventory_transactions"), data);
      return docRef.id;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create transaction"
      );
    }
  },

  async issueItemForChallan({
    itemId,
    challanId,
    challanNo,
    recipientName,
    siteName,
    createdBy,
    internal,
  }: {
    itemId: string;
    challanId: string;
    challanNo: string;
    recipientName: string;
    siteName: string;
    createdBy: string;
    internal: boolean;
  }) {
    const itemRef = doc(db, "inventory_items", itemId);
    const issueTransactionRef = doc(collection(db, "inventory_transactions"));

    await runTransaction(db, async (transaction) => {
      const itemSnapshot = await transaction.get(itemRef);
      if (!itemSnapshot.exists() || itemSnapshot.data().status !== "in") {
        throw new Error("This item is no longer available in inventory");
      }

      transaction.update(itemRef, {
        status: "out",
        ...(internal ? { active_challan_id: challanId, active_challan_no: challanNo } : {}),
        recipient_name: recipientName,
        site_name: siteName,
      });
      transaction.set(issueTransactionRef, {
        item_id: itemId,
        type: "removal",
        challan_id: challanId,
        challan_no: challanNo,
        recipient_name: recipientName,
        site_name: siteName,
        created_by: createdBy,
        notes: `Issued via delivery challan ${challanNo}`,
        created_at: new Date().toISOString(),
      });
    });
  },

  async returnItemFromChallan(itemId: string, challanId: string, challanNo: string, createdBy: string) {
    const itemRef = doc(db, "inventory_items", itemId);
    const returnTransactionRef = doc(collection(db, "inventory_transactions"));
    const itemTransactions = await inventoryTransactionsAPI.getByItem(itemId);
    const latestIssue = itemTransactions
      .filter((entry) => entry.type === "removal")
      .sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""))[0];

    await runTransaction(db, async (transaction) => {
      const itemSnapshot = await transaction.get(itemRef);
      if (!itemSnapshot.exists() || itemSnapshot.data().status !== "out") {
        throw new Error("This item is no longer available to return");
      }

      const item = itemSnapshot.data() as InventoryItem;
      const belongsToChallan = item.active_challan_id
        ? item.active_challan_id === challanId
        : latestIssue?.type === "removal" && (
            latestIssue.challan_id === challanId ||
            latestIssue.notes === `Issued via delivery challan ${challanNo}`
          );
      if (!belongsToChallan) {
        throw new Error("This item is not currently issued on this challan");
      }

      transaction.update(itemRef, {
        status: "in",
        active_challan_id: "",
        active_challan_no: "",
        recipient_name: "",
        site_name: "",
        location: "",
      });
      transaction.set(returnTransactionRef, {
        item_id: itemId,
        type: "revert",
        challan_id: challanId,
        challan_no: challanNo,
        created_by: createdBy,
        notes: `Returned via internal challan ${challanNo}`,
        created_at: new Date().toISOString(),
      });
    });
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "inventory_transactions", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete transaction"
      );
    }
  },
};

// Persons operations
export const personsAPI = {
  async getAll(): Promise<Person[]> {
    try {
      const q = query(collection(db, "persons"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Person[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<Person | null> {
    try {
      const docRef = doc(db, "persons", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Person;
      }
      return null;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      handleFirestoreError(error);
      return null;
    }
  },

  async create(person: Person) {
    try {
      const data = removeUndefined({
        ...person,
        created_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "persons"), data);
      return docRef.id;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create person"
      );
    }
  },

  async update(id: string, person: Partial<Person>) {
    try {
      const data = removeUndefined(person);
      const docRef = doc(db, "persons", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update person"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "persons", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete person"
      );
    }
  },
};

// Person Items operations
export const personItemsAPI = {
  async getAll(): Promise<PersonItem[]> {
    try {
      const q = query(collection(db, "person_items"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonItem[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByPerson(personId: string): Promise<PersonItem[]> {
    try {
      const q = query(
        collection(db, "person_items"),
        where("person_id", "==", personId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonItem[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<PersonItem | null> {
    try {
      const docRef = doc(db, "person_items", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as PersonItem;
      }
      return null;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      handleFirestoreError(error);
      return null;
    }
  },

  async create(item: PersonItem) {
    try {
      const data = removeUndefined({
        ...item,
        created_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "person_items"), data);
      return docRef.id;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create item"
      );
    }
  },

  async update(id: string, item: Partial<PersonItem>) {
    try {
      const data = removeUndefined(item);
      const docRef = doc(db, "person_items", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update item"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "person_items", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete item"
      );
    }
  },
};

// Person Item Transactions operations
export const personItemTransactionsAPI = {
  async getAll(): Promise<PersonItemTransaction[]> {
    try {
      const q = query(collection(db, "person_item_transactions"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonItemTransaction[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByPerson(personId: string): Promise<PersonItemTransaction[]> {
    try {
      const q = query(
        collection(db, "person_item_transactions"),
        where("person_id", "==", personId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonItemTransaction[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<PersonItemTransaction | null> {
    try {
      const docRef = doc(db, "person_item_transactions", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as PersonItemTransaction;
      }
      return null;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      handleFirestoreError(error);
      return null;
    }
  },

  async create(transaction: PersonItemTransaction) {
    try {
      const data = removeUndefined({
        ...transaction,
        created_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "person_item_transactions"), data);
      return docRef.id;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create transaction"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "person_item_transactions", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete transaction"
      );
    }
  },
};

// Person Sites operations
export const personSitesAPI = {
  async getAll(): Promise<PersonSite[]> {
    try {
      const q = query(collection(db, "person_sites"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonSite[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByPerson(personId: string): Promise<PersonSite[]> {
    try {
      const q = query(
        collection(db, "person_sites"),
        where("person_id", "==", personId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonSite[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<PersonSite | null> {
    try {
      const docRef = doc(db, "person_sites", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as PersonSite;
      }
      return null;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      handleFirestoreError(error);
      return null;
    }
  },

  async create(site: PersonSite) {
    try {
      const data = removeUndefined({
        ...site,
        created_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "person_sites"), data);
      return docRef.id;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create site"
      );
    }
  },

  async update(id: string, site: Partial<PersonSite>) {
    try {
      const data = removeUndefined(site);
      const docRef = doc(db, "person_sites", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update site"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "person_sites", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete site"
      );
    }
  },
};

// Company Profile operations
export const companyProfileAPI = {
  async get(): Promise<CompanyProfile | null> {
    try {
      const q = query(collection(db, "company_profile"));
      const snapshot = await getDocs(q);
      if (snapshot.docs.length > 0) {
        const d = snapshot.docs[0];
        return { id: d.id, ...d.data() } as CompanyProfile;
      }
      return null;
    } catch (error: any) {
      handleFirestoreError(error);
      return null;
    }
  },

  async getAll(): Promise<CompanyProfile[]> {
    try {
      const q = query(collection(db, "company_profile"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CompanyProfile[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<CompanyProfile | null> {
    try {
      const docRef = doc(db, "company_profile", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as CompanyProfile;
      }
      return null;
    } catch (error: any) {
      handleFirestoreError(error);
      return null;
    }
  },

  async createOrGet(profile: CompanyProfile): Promise<CompanyProfile | null> {
    try {
      const existing = await this.get();
      if (existing) return existing;

      const data = removeUndefined({
        ...profile,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      try {
        const docRef = await addDoc(collection(db, "company_profile"), data);
        return { id: docRef.id, ...data } as CompanyProfile;
      } catch (addErr: any) {
        if (addErr.code !== "permission-denied") {
          const retryExisting = await this.get();
          if (retryExisting) return retryExisting;
        }
        throw addErr;
      }
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create company profile"
      );
    }
  },

  async create(profile: CompanyProfile) {
    try {
      const data = removeUndefined({
        ...profile,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "company_profile"), data);
      return { id: docRef.id, ...data } as CompanyProfile;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create company profile"
      );
    }
  },

  async update(id: string, profile: Partial<CompanyProfile>) {
    try {
      const data = removeUndefined({
        ...profile,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "company_profile", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update company profile"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "company_profile", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete company profile"
      );
    }
  },
};

// Deployment Certificate operations
export const deploymentCertificateAPI = {
  async getAll(): Promise<DeploymentCertificate[]> {
    try {
      const q = query(collection(db, "deployment_certificates"), orderBy("created_at", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as DeploymentCertificate[];
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getBySiteId(siteId: string): Promise<DeploymentCertificate[]> {
    try {
      const q = query(
        collection(db, "deployment_certificates"),
        where("site_id", "==", siteId)
      );
      const snapshot = await getDocs(q);
      const certificates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as DeploymentCertificate[];
      // Sort by created_at descending in code to avoid composite index requirement
      return certificates.sort((a, b) => {
        const dateA = new Date(a.created_at || "").getTime();
        const dateB = new Date(b.created_at || "").getTime();
        return dateB - dateA;
      });
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<DeploymentCertificate | null> {
    try {
      const docRef = doc(db, "deployment_certificates", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as DeploymentCertificate;
      }
      return null;
    } catch (error: any) {
      handleFirestoreError(error);
      return null;
    }
  },

  async create(certificate: DeploymentCertificate) {
    try {
      const data = removeUndefined({
        ...certificate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "deployment_certificates"), data);
      return { id: docRef.id, ...data } as DeploymentCertificate;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create deployment certificate"
      );
    }
  },

  async update(id: string, certificate: Partial<DeploymentCertificate>) {
    try {
      const data = removeUndefined({
        ...certificate,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "deployment_certificates", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update deployment certificate"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "deployment_certificates", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete deployment certificate"
      );
    }
  },
};
