import { db } from "./config";
import {
  collection,
  query,
  where,
  doc,
  onSnapshot,
  Unsubscribe,
  Query,
  orderBy,
} from "firebase/firestore";
import { Category, SubCategory, InventoryItem, InventoryTransaction, Person, PersonItem, PersonItemTransaction, PersonSite, CompanyProfile } from "./firestore";
import { handleFirestoreError } from "./utils";
import { ParentProject } from "./parentProjectsAPI";
import { ProjectTracking } from "./projectTrackingAPI";

/**
 * Real-time subscription APIs for Firestore collections
 * These methods return unsubscribe functions that should be called on cleanup
 */

export const realtimeCategoriesAPI = {
  /**
   * Subscribe to all categories with real-time updates
   */
  subscribeAll(callback: (categories: Category[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "categories"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const categories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[];
        callback(categories);
      },
      (error) => {
        // Check for network errors first
        if (error?.message?.includes("Failed to fetch") || error?.name === "TypeError") {
          console.warn("Network connectivity issue - will retry automatically", error);
          return;
        }
        if (handleFirestoreError(error)) {
          // Error was handled/suppressed
          return;
        }
        console.error("Error in categories subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to a single category
   */
  subscribeById(id: string, callback: (category: Category | null) => void, onError?: (error: Error) => void): Unsubscribe {
    const docRef = doc(db, "categories", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as Category);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in category subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

export const realtimeSubCategoriesAPI = {
  /**
   * Subscribe to all subcategories
   */
  subscribeAll(callback: (subCategories: SubCategory[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "sub_categories"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const subCategories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SubCategory[];
        callback(subCategories);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in subcategories subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to subcategories in a specific category
   */
  subscribeByCategory(categoryId: string, callback: (subCategories: SubCategory[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "sub_categories"),
      where("category_id", "==", categoryId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const subCategories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SubCategory[];
        // Sort by created_at in memory to avoid composite index requirement
        subCategories.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(subCategories);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in subcategories subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to a single subcategory
   */
  subscribeById(id: string, callback: (subCategory: SubCategory | null) => void, onError?: (error: Error) => void): Unsubscribe {
    const docRef = doc(db, "sub_categories", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as SubCategory);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in subcategory subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

export const realtimeInventoryItemsAPI = {
  /**
   * Subscribe to all inventory items
   */
  subscribeAll(callback: (items: InventoryItem[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "inventory_items"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
        callback(items);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in inventory items subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to items in a category
   */
  subscribeByCategory(categoryId: string, callback: (items: InventoryItem[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "inventory_items"),
      where("category_id", "==", categoryId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
        // Sort by created_at in memory
        items.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(items);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in inventory items subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to items in a subcategory
   */
  subscribeBySubCategory(subCategoryId: string, callback: (items: InventoryItem[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "inventory_items"),
      where("subcategory_id", "==", subCategoryId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
        items.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(items);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in inventory items subcategory subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to items with a specific status
   */
  subscribeByStatus(status: "in" | "out", callback: (items: InventoryItem[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "inventory_items"),
      where("status", "==", status)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
        // Sort by created_at in memory
        items.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(items);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in inventory items subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to a single inventory item
   */
  subscribeById(id: string, callback: (item: InventoryItem | null) => void, onError?: (error: Error) => void): Unsubscribe {
    const docRef = doc(db, "inventory_items", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as InventoryItem);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in inventory item subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

export const realtimeInventoryTransactionsAPI = {
  /**
   * Subscribe to all inventory transactions
   */
  subscribeAll(callback: (transactions: InventoryTransaction[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "inventory_transactions"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryTransaction[];
        callback(transactions);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in transactions subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to transactions for a specific item
   */
  subscribeByItem(itemId: string, callback: (transactions: InventoryTransaction[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "inventory_transactions"),
      where("item_id", "==", itemId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryTransaction[];
        // Sort by created_at in memory
        transactions.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(transactions);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in transactions subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

export const realtimePersonsAPI = {
  /**
   * Subscribe to all persons
   */
  subscribeAll(callback: (persons: Person[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "persons"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const persons = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Person[];
        callback(persons);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in persons subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to a single person
   */
  subscribeById(id: string, callback: (person: Person | null) => void, onError?: (error: Error) => void): Unsubscribe {
    const docRef = doc(db, "persons", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as Person);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in person subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

export const realtimePersonItemsAPI = {
  /**
   * Subscribe to all person items
   */
  subscribeAll(callback: (items: PersonItem[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "person_items"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonItem[];
        callback(items);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in person items subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to items for a specific person
   * Note: Removed orderBy to avoid composite index requirement. Sorting done client-side.
   */
  subscribeByPerson(personId: string, callback: (items: PersonItem[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "person_items"),
      where("person_id", "==", personId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonItem[];
        // Sort by created_at in memory
        items.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(items);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in person items subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

export const realtimePersonSitesAPI = {
  /**
   * Subscribe to all person sites
   */
  subscribeAll(callback: (sites: PersonSite[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "person_sites"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const sites = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonSite[];
        callback(sites);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in person sites subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to sites for a specific person
   * Note: Removed orderBy to avoid composite index requirement. Sorting done client-side.
   */
  subscribeByPerson(personId: string, callback: (sites: PersonSite[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "person_sites"),
      where("person_id", "==", personId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const sites = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonSite[];
        // Sort by created_at in memory
        sites.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(sites);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in person sites subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

export const realtimePersonItemTransactionsAPI = {
  /**
   * Subscribe to all person item transactions
   */
  subscribeAll(callback: (transactions: PersonItemTransaction[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "person_item_transactions"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonItemTransaction[];
        callback(transactions);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in person item transactions subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to transactions for a specific person
   * Note: Removed orderBy to avoid composite index requirement. Sorting done client-side.
   */
  subscribeByPerson(personId: string, callback: (transactions: PersonItemTransaction[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "person_item_transactions"),
      where("person_id", "==", personId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PersonItemTransaction[];
        // Sort by created_at in memory
        transactions.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(transactions);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in person item transactions subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

export const realtimeCompanyProfileAPI = {
  /**
   * Subscribe to all company profiles
   */
  subscribeAll(callback: (profiles: CompanyProfile[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "company_profile"));
    return onSnapshot(
      q,
      (snapshot) => {
        const profiles = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CompanyProfile[];
        callback(profiles);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in company profiles subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to a single company profile
   */
  subscribeById(id: string, callback: (profile: CompanyProfile | null) => void, onError?: (error: Error) => void): Unsubscribe {
    const docRef = doc(db, "company_profile", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as CompanyProfile);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in company profile subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

/**
 * Real-time subscriptions for Parent Projects
 */
export const realtimeParentProjectsAPI = {
  /**
   * Subscribe to all parent projects with real-time updates
   */
  subscribeAll(callback: (projects: ParentProject[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "parent_projects"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const projects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ParentProject[];
        callback(projects);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in parent projects subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to a single parent project
   */
  subscribeById(id: string, callback: (project: ParentProject | null) => void, onError?: (error: Error) => void): Unsubscribe {
    const docRef = doc(db, "parent_projects", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as ParentProject);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in parent project subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};

/**
 * Real-time subscriptions for Project Tracking (Sites)
 */
export const realtimeProjectTrackingAPI = {
  /**
   * Subscribe to all project tracking records
   */
  subscribeAll(callback: (sites: ProjectTracking[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(collection(db, "project_tracking"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const sites = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ProjectTracking[];
        // Sort to put ISSM Labelling Solutions at the top
        const sortedSites = sites.sort((a, b) => {
          // If both are ISSM Labelling Solutions, maintain created_at order
          if (a.millName === "ISSM Labelling Solutions" && b.millName === "ISSM Labelling Solutions") {
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          }
          // ISSM Labelling Solutions comes first
          if (a.millName === "ISSM Labelling Solutions") return -1;
          if (b.millName === "ISSM Labelling Solutions") return 1;
          // For others, maintain created_at desc order
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
        callback(sortedSites);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in project tracking subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to project tracking records by project ID
   * Optimized query using where clause (more efficient than filtering client-side)
   * Sorted in memory to avoid composite index requirement
   */
  subscribeByProject(projectId: string, callback: (sites: ProjectTracking[]) => void, onError?: (error: Error) => void): Unsubscribe {
    const q = query(
      collection(db, "project_tracking"),
      where("project_id", "==", projectId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const sites = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ProjectTracking[];
        // Sort to put ISSM Labelling Solutions at the top, then by updated_at descending
        sites.sort((a, b) => {
          // If both are ISSM Labelling Solutions, maintain updated_at order
          if (a.millName === "ISSM Labelling Solutions" && b.millName === "ISSM Labelling Solutions") {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return dateB - dateA;
          }
          // ISSM Labelling Solutions comes first
          if (a.millName === "ISSM Labelling Solutions") return -1;
          if (b.millName === "ISSM Labelling Solutions") return 1;
          // For others, maintain updated_at desc order
          const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return dateB - dateA;
        });
        callback(sites);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in project tracking subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Subscribe to a single project tracking record
   */
  subscribeById(id: string, callback: (site: ProjectTracking | null) => void, onError?: (error: Error) => void): Unsubscribe {
    const docRef = doc(db, "project_tracking", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as ProjectTracking);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in project tracking subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};
