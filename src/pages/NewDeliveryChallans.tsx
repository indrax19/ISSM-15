import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { challanAPI, Challan, ChallanEquipment, ChallanType } from "@/integrations/firebase/challanAPI";
import { subCategoriesAPI, CompanyProfile, SubCategory, InventoryItem, inventoryItemsAPI, inventoryTransactionsAPI } from "@/integrations/firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { realtimeCategoriesAPI, realtimeSubCategoriesAPI, realtimeCompanyProfileAPI } from "@/integrations/firebase/realtimeAPI";
import { downloadChallanPDF } from "@/lib/pdfGenerator";
import { supabase } from "@/integrations/supabase/client";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ChallanBarcodeScanner } from "@/components/ChallanBarcodeScanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Download, Camera, X, Upload, FileIcon, ChevronsUpDown } from "lucide-react";

const AUTO_ISSUE_EQUIPMENT = new Set([
  "keyboard & mouse",
  "led monitor screen",
  "hdmi cables",
  "pdu",
  "power distribution unit",
  "power distribution units",
  "power distribution unit pdu",
  "power cables pc",
  "rack cabinet",
  "rack cabine",
]);

const normalizeEquipmentName = (value?: string) =>
  value?.toLowerCase().replace(/[\\()/\\-]+/g, " ").replace(/\\s+/g, " ").trim() || "";

export default function NewDeliveryChallans() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { appUser } = useAuth();
  const initialChallanType: ChallanType = searchParams.get("type") === "internal" ? "internal" : "external";

  // Track scanned items so we can issue them when challan is saved
  const [scannedItemIds, setScannedItemIds] = useState<string[]>();
  const scannedItemIdSetRef = useRef(new Set<string>());

  // Form states
  const [challanType, setChallanType] = useState<ChallanType>(initialChallanType);
  const [challanNo, setChallanNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [poNumber, setPoNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocNumber, setPocNumber] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [equipment, setEquipment] = useState<ChallanEquipment[]>([
    { id: "0", name: "", quantity: 1, serialNumbers: [""], barcodes: [], category_id: "", subcategory_id: "", manualEquipmentDetails: "", itemIds: [""] },
  ]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedChallanId, setSavedChallanId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTargetIndex, setScanTargetIndex] = useState<number | null>(null);
  const [scanTargetSerialIndex, setScanTargetSerialIndex] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [challanScannerOpen, setChallanScannerOpen] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentPreview, setDocumentPreview] = useState("");
  const [documentFileName, setDocumentFileName] = useState("");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedChallanProfileId, setSelectedChallanProfileId] = useState<string | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [subCategoriesMap, setSubCategoriesMap] = useState<{ [categoryId: string]: SubCategory[] }>({});
  const [equipmentCategoryOpen, setEquipmentCategoryOpen] = useState<{ [key: number]: boolean }>({});
  const [equipmentCategorySearch, setEquipmentCategorySearch] = useState<{ [key: number]: string }>({});
  const [equipmentSubCategoryOpen, setEquipmentSubCategoryOpen] = useState<{ [key: number]: boolean }>({});
  const [equipmentSubCategorySearch, setEquipmentSubCategorySearch] = useState<{ [key: number]: string }>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [challanInventoryItems, setChallanInventoryItems] = useState<Record<string, InventoryItem | null>>({});
  const challanItemIds = useMemo(
    () => [...new Set(equipment.flatMap((item) => item.itemIds || []).filter(Boolean))],
    [equipment]
  );
  const initialChallanItemIdsRef = useRef(new Set<string>());

  // Serial number validation - track which serials are valid/invalid
  // Format: "equipmentIndex:serialIndex" -> "valid" | "invalid" | "checking" | ""
  const [serialValidationStatus, setSerialValidationStatus] = useState<{ [key: string]: string }>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const validationTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const generatedChallanProfileRef = useRef<string | null>(null);

  // Serial number suggestions/autocomplete
  const [serialSuggestions, setSerialSuggestions] = useState<{ [key: string]: any[] }>({});
  const [openSerialDropdown, setOpenSerialDropdown] = useState<{ [key: string]: boolean }>({});

  const challanTypeLabel = challanType === "internal" ? "Internal" : "External";
  const challanListPath = challanType === "internal" ? "/delivery-challans?type=internal" : "/delivery-challans";
  const selectedChallanProfile = profiles.find((profile) => profile.id === selectedChallanProfileId);
  const challanNumberPlaceholder = selectedChallanProfile
    ? `${selectedChallanProfile.company_name.trim().charAt(0).toUpperCase() || "D"}DC-00001`
    : challanType === "internal"
      ? "Auto-generated as IDC-00001"
      : "Auto-generated as DC-00001";

  // Realtime subscription refs
  const profilesUnsubRef = useRef<(() => void) | null>(null);
  const categoriesUnsubRef = useRef<(() => void) | null>(null);
  const existingChallanUnsubRef = useRef<(() => void) | null>(null);
  const subCategoriesUnsubRefs = useRef<{ [key: string]: () => void }>({});

  // Subscribe to company profiles
  useEffect(() => {
    profilesUnsubRef.current = realtimeCompanyProfileAPI.subscribeAll((data) => {
      if (isMountedRef.current) {
        setProfiles(data || []);
      }
    });

    return () => {
      profilesUnsubRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (profiles.length === 0) {
      if (!id) {
        setChallanNo("");
      }
      return;
    }

    if (!selectedProfileId) {
      // Find ISSM Labelling Solutions first, otherwise fall back to first profile
      const issmProfile = profiles.find(p => p.company_name === "ISSM Labelling Solutions");
      setSelectedProfileId(issmProfile?.id || profiles[0]?.id || null);
    }

    if (!selectedChallanProfileId) {
      // Find ISSM Labelling Solutions first, otherwise fall back to first profile
      const issmProfile = profiles.find(p => p.company_name === "ISSM Labelling Solutions");
      setSelectedChallanProfileId(issmProfile?.id || profiles[0]?.id || null);
      return;
    }

    // Only set challan number to empty for new challans (don't auto-generate on company selection)
    if (!id) {
      setChallanNo("");
    }
  }, [id, profiles, selectedChallanProfileId, selectedProfileId]);

  // Reset scanning flag when scanner modal closes
  useEffect(() => {
    if (!scannerOpen) {
      setIsScanning(false);
    }
  }, [scannerOpen]);

  useEffect(() => {
    if (!id) {
      setChallanType(initialChallanType);
      generatedChallanProfileRef.current = null;
    }
  }, [id, initialChallanType]);

  // Track mounted state and cleanup
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Cleanup validation timeouts
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(validationTimeoutRef.current).forEach((timeout) => {
        clearTimeout(timeout);
      });
      // Cleanup all realtime subscriptions
      profilesUnsubRef.current?.();
      categoriesUnsubRef.current?.();
      existingChallanUnsubRef.current?.();
      Object.values(subCategoriesUnsubRefs.current).forEach((unsub) => unsub?.());
    };
  }, []);

  // Subscribe to categories and their subcategories
  useEffect(() => {
    categoriesUnsubRef.current = realtimeCategoriesAPI.subscribeAll((cats) => {
      if (isMountedRef.current) {
        setCategories(cats);

        // Get current category IDs
        const currentCategoryIds = new Set(cats.map((cat) => cat.id).filter(Boolean));

        // Clean up subscriptions for removed categories
        Object.keys(subCategoriesUnsubRefs.current).forEach((categoryId) => {
          if (!currentCategoryIds.has(categoryId)) {
            subCategoriesUnsubRefs.current[categoryId]?.();
            delete subCategoriesUnsubRefs.current[categoryId];
          }
        });

        // Subscribe to subcategories for each current category
        cats.forEach((cat) => {
          if (cat.id) {
            // Only unsubscribe and resubscribe if not already subscribed
            if (!subCategoriesUnsubRefs.current[cat.id]) {
              subCategoriesUnsubRefs.current[cat.id] = realtimeSubCategoriesAPI.subscribeByCategory(
                cat.id,
                (subCats) => {
                  if (isMountedRef.current) {
                    setSubCategoriesMap((prev) => ({
                      ...prev,
                      [cat.id!]: subCats || [],
                    }));
                  }
                }
              );
            }
          }
        });
      }
    });

    return () => {
      categoriesUnsubRef.current?.();
      Object.values(subCategoriesUnsubRefs.current).forEach((unsub) => unsub?.());
      subCategoriesUnsubRefs.current = {};
    };
  }, []);

  // Subscribe to existing challan if editing
  useEffect(() => {
    if (!id) return;

    existingChallanUnsubRef.current = challanAPI.subscribeById(id, (challan) => {
      if (challan && isMountedRef.current) {
        setChallanType(challan.challanType === "internal" ? "internal" : "external");
        setChallanNo(challan.challanNo);
        setDate(challan.date);
        setPoNumber(challan.poNumber || "");
        setDeliveryDate(challan.deliveryDate);
        setCustomerName(challan.customerName);
        setSiteLocation(challan.siteLocation || "");
        setPocName(challan.pocName || "");
        setPocNumber(challan.pocNumber || "");
        setUnitNo(challan.unitNo || "");
        // Ensure equipment has itemIds initialized
        const equipmentWithItemIds = challan.equipment.map(eq => ({
          ...eq,
          itemIds: eq.itemIds || Array(eq.serialNumbers.length).fill("")
        }));
        setEquipment(equipmentWithItemIds);
        initialChallanItemIdsRef.current = new Set(
          equipmentWithItemIds.flatMap((item) => item.itemIds || []).filter(Boolean)
        );
        setSelectedChallanProfileId(challan.companyProfileId || null);
        if (challan.documentUrl) {
          setDocumentUrl(challan.documentUrl);
          setDocumentPreview(challan.documentUrl);
        }
        setSavedChallanId(challan.id || null);
      }
    });

    return () => {
      existingChallanUnsubRef.current?.();
    };
  }, [id]);


  const clearFieldError = (field: string) => {
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const hasFieldError = (field: string) => fieldErrors[field] ? "border-red-500 focus-visible:ring-red-500" : "";

  useEffect(() => {
    if (!id || challanType !== "internal" || challanItemIds.length === 0) {
      setChallanInventoryItems({});
      return;
    }

    let isCurrent = true;
    Promise.all(challanItemIds.map(async (itemId) => {
      const item = await inventoryItemsAPI.getById(itemId);
      if (!item || item.status !== "out") return [itemId, item] as const;
      if (item.active_challan_id === id) return [itemId, item] as const;
      if (item.active_challan_id) return [itemId, null] as const;

      const transactions = await inventoryTransactionsAPI.getByItem(itemId);
      const latestRemoval = transactions
        .filter((entry) => entry.type === "removal")
        .sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""))[0];
      const issuedOnThisChallan = latestRemoval?.challan_id === id ||
        latestRemoval?.notes === `Issued via delivery challan ${challanNo}`;
      return [itemId, issuedOnThisChallan ? item : null] as const;
    })).then((items) => {
      if (isCurrent) setChallanInventoryItems(Object.fromEntries(items));
    });

    return () => {
      isCurrent = false;
    };
  }, [id, challanType, challanItemIds, challanNo]);

  const issueItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!id || challanType !== "internal" || !challanItemIds.includes(itemId)) {
        throw new Error("Select an item linked to this internal challan");
      }
      await inventoryTransactionsAPI.issueItemForChallan({
        itemId,
        challanId: id,
        challanNo,
        recipientName: customerName || "Internal Challan",
        siteName: siteLocation || "",
        createdBy: appUser?.fullName || appUser?.email || "Unknown User",
        internal: true,
      });
    },
    onSuccess: async (_, itemId) => {
      const issuedItem = await inventoryItemsAPI.getById(itemId);
      setChallanInventoryItems((previous) => ({ ...previous, [itemId]: issuedItem }));
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item issued from this internal challan");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to issue item"),
  });

  const returnItemMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!id) throw new Error("Save the internal challan before returning items");
      return inventoryTransactionsAPI.returnItemFromChallan(
        itemId,
        id,
        challanNo,
        appUser?.fullName || appUser?.email || "Unknown User"
      );
    },
    onSuccess: async (_, itemId) => {
      const returnedItem = await inventoryItemsAPI.getById(itemId);
      setChallanInventoryItems((previous) => ({ ...previous, [itemId]: returnedItem }));
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item returned to inventory");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to return item"),
  });

  const saveMutation = useMutation({
   mutationFn: async () => {
  const nextFieldErrors: Record<string, boolean> = {};
  const addFieldError = (field: string) => {
    nextFieldErrors[field] = true;
  };
  const namedEquipment = equipment.filter((item) => item.name.trim());

  if (!selectedChallanProfileId) addFieldError("companyProfile");
  if (!date.trim()) addFieldError("date");
  if (!deliveryDate.trim()) addFieldError("deliveryDate");
  if (!customerName.trim()) addFieldError("customerName");
  if (namedEquipment.length === 0) addFieldError("equipment-0-category");

  namedEquipment.forEach((item) => {
    const index = equipment.indexOf(item);
    if (!item.category_id) addFieldError(`equipment-${index}-category`);
    if (!item.quantity || item.quantity < 1) addFieldError(`equipment-${index}-quantity`);
  });

  if (Object.keys(nextFieldErrors).length > 0) {
    setFieldErrors(nextFieldErrors);
    toast.error("Please complete the fields highlighted in red");
    throw new Error("Validation failed");
  }

  let uploadedUrl = documentUrl;
  let finalChallanNo = challanNo;
  const selectedCompanyProfile = profiles.find((profile) => profile.id === selectedChallanProfileId);

  if (!id && selectedCompanyProfile && !finalChallanNo.trim()) {
    finalChallanNo = await challanAPI.generateCompanyChallanNumber(selectedCompanyProfile);
    if (isMountedRef.current) {
      setChallanNo(finalChallanNo);
    }
  }

  // ✅ Step 1: Upload file FIRST (if exists)
  if (selectedFile) {
    try {
      const filePath = `challans/${Date.now()}_${selectedFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      uploadedUrl = urlData.publicUrl;
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Document upload failed");
      throw new Error("Upload failed");
    }
  }

  // ✅ Step 2: Validate equipment
  const equipmentWithNames = equipment.filter((e) => e.name.trim());

  let validEquipment = equipmentWithNames.filter((e) => e.category_id);

  {
    const autoIssueEquipment = validEquipment.filter((item) =>
      AUTO_ISSUE_EQUIPMENT.has(normalizeEquipmentName(item.name)) ||
      AUTO_ISSUE_EQUIPMENT.has(normalizeEquipmentName(item.manualEquipmentDetails)) ||
      AUTO_ISSUE_EQUIPMENT.has(normalizeEquipmentName(categories.find((category) => category.id === item.category_id)?.name)) ||
      AUTO_ISSUE_EQUIPMENT.has(normalizeEquipmentName(subCategoriesMap[item.category_id]?.find((subCategory) => subCategory.id === item.subcategory_id)?.name))
    );

    if (autoIssueEquipment.length > 0) {
      const availableItems = (await inventoryItemsAPI.getAll()).filter((item) => item.status === "in");
      const assignedItemIds = new Set(
        validEquipment.flatMap((item) => (item.itemIds || []).filter(Boolean))
      );
      const missingStock: string[] = [];
      let newlyAssignedCount = 0;

      validEquipment = validEquipment.map((equipmentItem) => {
        if (!autoIssueEquipment.includes(equipmentItem)) return equipmentItem;

        const categoryName = normalizeEquipmentName(
          categories.find((category) => category.id === equipmentItem.category_id)?.name
        );
        const subCategoryName = normalizeEquipmentName(
          subCategoriesMap[equipmentItem.category_id]?.find((subCategory) => subCategory.id === equipmentItem.subcategory_id)?.name
        );
        const equipmentName = normalizeEquipmentName(equipmentItem.name || equipmentItem.manualEquipmentDetails);
        const matchingItems = availableItems.filter((item) =>
          !assignedItemIds.has(item.id || "") &&
          item.category_id === equipmentItem.category_id &&
          (!equipmentItem.subcategory_id || item.subcategory_id === equipmentItem.subcategory_id) &&
          (AUTO_ISSUE_EQUIPMENT.has(categoryName) || AUTO_ISSUE_EQUIPMENT.has(subCategoryName) || AUTO_ISSUE_EQUIPMENT.has(equipmentName))
        );
        const existingCount = Math.max(
          (equipmentItem.itemIds || []).filter(Boolean).length,
          equipmentItem.serialNumbers.filter((serial) => serial.trim()).length
        );
        const requiredCount = Math.max(0, equipmentItem.quantity - existingCount);

        if (matchingItems.length < requiredCount) {
          missingStock.push(`${equipmentItem.name || equipmentItem.manualEquipmentDetails} (available: ${matchingItems.length}, required: ${requiredCount})`);
        }

        const serialNumbers = [...equipmentItem.serialNumbers];
        const itemIds = [...(equipmentItem.itemIds || [])];
        let assigned = 0;
        for (let index = 0; index < equipmentItem.quantity; index += 1) {
          if (itemIds[index]) continue;
          const inventoryItem = matchingItems[assigned++];
          if (!inventoryItem?.id) continue;
          serialNumbers[index] = inventoryItem.serial_number;
          itemIds[index] = inventoryItem.id;
          assignedItemIds.add(inventoryItem.id);
          newlyAssignedCount += 1;
        }

        return { ...equipmentItem, serialNumbers, itemIds };
      });

      if (newlyAssignedCount > 0) {
        toast.success("Available inventory assigned automatically");
      }

      if (missingStock.length > 0) {
        toast.warning(`Some items were not available and were saved without inventory issue: ${missingStock.join(", ")}`);
      }
    }
  }

  // ✅ Step 3: Save challan WITH document URL
  const challanData: Challan = {
    challanType,
    challanNo: finalChallanNo || "",
    date,
    poNumber,
    deliveryDate,
    customerName,
    companyProfileId: selectedCompanyProfile?.id || undefined,
    companyProfileName: selectedCompanyProfile?.company_name || undefined,
    siteLocation,
    unitNo,
    pocName,
    pocNumber,
    documentUrl: uploadedUrl, // 🔥 IMPORTANT
    equipment: validEquipment.map((e) => ({
      ...e,
      serialNumbers: e.serialNumbers.filter((s) => s.trim()),
    })),
  };

  const challanResult = id
    ? await challanAPI.update(id, challanData).then(() => ({ id }))
    : await challanAPI.create(challanData);

  // ✅ Step 4: Issue all items (both from manual entry and quick scan)
  const itemIdsToIssue = new Set<string>();

  // Add items from scanned/quick scan
  scannedItemIdSetRef.current.forEach(id => itemIdsToIssue.add(id));

  // Add items from equipment with verified itemIds
  validEquipment.forEach((eq) => {
    if (eq.itemIds) {
      eq.itemIds.forEach((itemId) => {
        if (itemId && itemId.trim()) {
          itemIdsToIssue.add(itemId);
        }
      });
    }
  });

  if (itemIdsToIssue.size > 0) {
    await Promise.all(
      [...itemIdsToIssue].map(async (itemId) => {
        try {
          if (id && initialChallanItemIdsRef.current.has(itemId)) return;
          const inventoryItem = await inventoryItemsAPI.getById(itemId);
          if (!inventoryItem || inventoryItem.status !== "in") return;
          await inventoryTransactionsAPI.issueItemForChallan({
            itemId,
            challanId: challanResult.id,
            challanNo: challanData.challanNo,
            recipientName: customerName || "Delivery Challan",
            siteName: siteLocation || "",
            createdBy: appUser?.fullName || appUser?.email || "Unknown User",
            internal: challanType === "internal",
          });
        } catch (error) {
          console.error(`Failed to issue item ${itemId}:`, error);
        }
      })
    );
    scannedItemIdSetRef.current.clear();
  }

  if (challanResult.id) {
    setSavedChallanId(challanResult.id);
  }

  return challanResult;
},
    onSuccess: async (result) => {
      if (!isMountedRef.current) return;

      const challanId = id || result?.id;

      if (isMountedRef.current) {
        queryClient.invalidateQueries({ queryKey: ["challans"] });
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "auto" });
        toast.success(id ? "Challan updated successfully" : "Challan created successfully");
        setShowSuccess(true);
        // Redirect to delivery challans list after 1.5 seconds
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            navigate(challanListPath);
          }
        }, 1500);
      }
    },
    onError: (err: any) => {
      if (isMountedRef.current) {
        console.error("Challan save error:", err);
        toast.error(err.message || "Failed to save challan");
      }
    },
  });

  const addField = () => {
    setEquipment((prev) => [
      { id: Date.now().toString(), name: "", serialNumbers: [""], quantity: 1, barcodes: [], category_id: "", subcategory_id: "", manualEquipmentDetails: "", itemIds: [""] },
      ...prev.map((e) => e),
    ]);
  };

  const updateEquipment = (index: number, field: keyof ChallanEquipment, value: any) => {
    clearFieldError(`equipment-${index}-${field === "category_id" ? "category" : field === "manualEquipmentDetails" ? "details" : field}`);
    setEquipment((prev) =>
      prev.map((e, i) => {
        if (i === index) {
          const updated = { ...e, [field]: value };
          // When quantity changes, adjust serialNumbers and itemIds array size
          if (field === "quantity" && typeof value === "number") {
            const currentLength = e.serialNumbers.length;
            if (value > currentLength) {
              // Add empty serial number fields
              updated.serialNumbers = [
                ...e.serialNumbers,
                ...Array(value - currentLength).fill(""),
              ];
              // Add empty itemIds
              updated.itemIds = [
                ...(e.itemIds || []),
                ...Array(value - currentLength).fill(""),
              ];
            } else if (value < currentLength) {
              // Remove serial number fields
              updated.serialNumbers = e.serialNumbers.slice(0, value);
              // Remove itemIds
              updated.itemIds = (e.itemIds || []).slice(0, value);
            }
          }
          return updated;
        }
        return e;
      })
    );
  };

  const validateSerialInInventory = async (
    equipmentIndex: number,
    serialIndex: number,
    serial: string
  ) => {
    const validationKey = `${equipmentIndex}:${serialIndex}`;

    if (!serial.trim()) {
      setSerialValidationStatus((prev) => {
        const updated = { ...prev };
        delete updated[validationKey];
        return updated;
      });
      return;
    }

    // Set as checking
    setSerialValidationStatus((prev) => ({
      ...prev,
      [validationKey]: "checking",
    }));

    try {
      // Check if serial exists in inventory
      const item = await inventoryItemsAPI.getBySerialNumber(serial.trim());

      if (item && item.status === "in") {
        // Serial is valid and available
        setSerialValidationStatus((prev) => ({
          ...prev,
          [validationKey]: "valid",
        }));

        // Track itemId so we can issue it when challan is saved
        setEquipment((prev) =>
          prev.map((eq, i) => {
            if (i === equipmentIndex) {
              const updatedItemIds = [...(eq.itemIds || [])];
              updatedItemIds[serialIndex] = item.id || "";
              const updatedCategoryId = item.category_id || eq.category_id || "";
              const updatedSubcategoryId = item.subcategory_id || eq.subcategory_id || "";
              const categoryName = categories.find((c) => c.id === updatedCategoryId)?.name || "";

              return {
                ...eq,
                itemIds: updatedItemIds,
                category_id: updatedCategoryId,
                subcategory_id: updatedSubcategoryId,
                name: categoryName || eq.name || "",
              };
            }
            return eq;
          })
        );

        const categoryId = item.category_id ? categories.find((c) => c.id === item.category_id)?.name : null;
        if (categoryId) {
          toast.success(`Serial verified and details auto-filled: ${serial}`);
        } else {
          toast.success(`Serial verified: ${serial}`);
        }
      } else if (item && item.status !== "in") {
        // Serial exists but not in inventory (already issued/out)
        setSerialValidationStatus((prev) => ({
          ...prev,
          [validationKey]: "invalid",
        }));
        toast.error(`Serial not available in inventory: ${serial}`);
      } else {
        // Serial doesn't exist
        setSerialValidationStatus((prev) => ({
          ...prev,
          [validationKey]: "invalid",
        }));
        toast.error(`Serial not found in inventory: ${serial}`);
      }
    } catch (error) {
      console.error("Validation error:", error);
      setSerialValidationStatus((prev) => ({
        ...prev,
        [validationKey]: "invalid",
      }));
    }
  };

  const fetchSerialSuggestions = async (equipmentIndex: number, serialIndex: number, input: string) => {
    const key = `${equipmentIndex}:${serialIndex}`;

    if (!input.trim()) {
      setSerialSuggestions((prev) => ({
        ...prev,
        [key]: [],
      }));
      return;
    }

    // If input is 4 characters or less, search by last characters
    if (input.trim().length <= 4) {
      try {
        const suggestions = await inventoryItemsAPI.searchBySerialEnd(input.trim());
        setSerialSuggestions((prev) => ({
          ...prev,
          [key]: suggestions,
        }));
      } catch (error) {
        console.error("Error fetching serial suggestions:", error);
        setSerialSuggestions((prev) => ({
          ...prev,
          [key]: [],
        }));
      }
    }
  };

  const updateSerialNumber = (equipmentIndex: number, serialIndex: number, value: string) => {
    setEquipment((prev) =>
      prev.map((e, i) => {
        if (i === equipmentIndex) {
          const updated = [...e.serialNumbers];
          updated[serialIndex] = value;
          return { ...e, serialNumbers: updated };
        }
        return e;
      })
    );

    // Debounce validation
    const validationKey = `${equipmentIndex}:${serialIndex}`;
    if (validationTimeoutRef.current[validationKey]) {
      clearTimeout(validationTimeoutRef.current[validationKey]);
    }

    if (value.trim()) {
      // Fetch suggestions if it's a short input (4 chars or less)
      if (value.trim().length <= 4) {
        fetchSerialSuggestions(equipmentIndex, serialIndex, value);
      } else {
        setSerialSuggestions((prev) => ({
          ...prev,
          [`${equipmentIndex}:${serialIndex}`]: [],
        }));
      }

      validationTimeoutRef.current[validationKey] = setTimeout(() => {
        validateSerialInInventory(equipmentIndex, serialIndex, value);
      }, 500);
    } else {
      // Clear validation status if serial is empty
      setSerialValidationStatus((prev) => {
        const updated = { ...prev };
        delete updated[validationKey];
        return updated;
      });
    }
  };

  const removeEquipment = (index: number) => {
    setEquipment((prev) => prev.filter((_, i) => i !== index));
  };

  const openScanner = (equipmentIndex: number, serialIndex: number) => {
    setScanTargetIndex(equipmentIndex);
    setScanTargetSerialIndex(serialIndex);
    setScannerOpen(true);
  };

  const handleScanResult = (result: string) => {
    // Prevent multiple scans from being processed at once
    if (isScanning) return;

    setIsScanning(true);

    if (scanTargetIndex !== null && scanTargetSerialIndex !== null) {
      updateSerialNumber(scanTargetIndex, scanTargetSerialIndex, result);
      toast.success("Barcode scanned successfully!");
    }

    // Close scanner and stop camera
    setTimeout(() => {
      setScannerOpen(false);
      setScanTargetIndex(null);
      setScanTargetSerialIndex(null);
      setIsScanning(false);
    }, 500);
  };

  const handleChallanScanComplete = (result: {
    serialNumber: string;
    name: string;
    category_id: string;
    subcategory_id: string;
    categoryName: string;
    subcategoryName: string;
    itemId: string;
  }) => {
    // Track this item so we can issue it when the challan is saved
    scannedItemIdSetRef.current.add(result.itemId);

    // Find if we have an existing equipment entry for this category/subcategory
    const targetIndex = equipment.findIndex(
      (eq) => eq.category_id === result.category_id && eq.subcategory_id === result.subcategory_id
    );

    if (targetIndex === -1) {
      // Create a new equipment entry
      const newEquipment: ChallanEquipment = {
        id: Date.now().toString(),
        name: result.categoryName || result.name || "",
        quantity: 1,
        serialNumbers: [result.serialNumber],
        barcodes: [result.serialNumber],
        category_id: result.category_id,
        subcategory_id: result.subcategory_id,
        itemIds: [result.itemId],
      };
      setEquipment((prev) => [newEquipment, ...prev]);
      toast.success("New equipment added with serial number");
    } else {
      // Add to existing equipment entry
      setEquipment((prev) =>
        prev.map((eq, i) => {
          if (i === targetIndex) {
            const updatedSerialNumbers = [...eq.serialNumbers];
            const updatedBarcodes = [...eq.barcodes];
            const updatedItemIds = [...(eq.itemIds || [])];

            // Try to fill empty slot first
            const emptyIndex = updatedSerialNumbers.findIndex((s) => !s.trim());
            if (emptyIndex !== -1) {
              updatedSerialNumbers[emptyIndex] = result.serialNumber;
              updatedItemIds[emptyIndex] = result.itemId;
              updatedBarcodes.push(result.serialNumber);
            } else {
              // No empty slots, add to end and increase quantity
              updatedSerialNumbers.push(result.serialNumber);
              updatedItemIds.push(result.itemId);
              updatedBarcodes.push(result.serialNumber);
            }

            // Update quantity if we have more serials than quantity
            const newQuantity = Math.max(eq.quantity, updatedSerialNumbers.filter(s => s.trim()).length);

            return {
              ...eq,
              quantity: newQuantity,
              serialNumbers: updatedSerialNumbers,
              barcodes: updatedBarcodes,
              itemIds: updatedItemIds,
            };
          }
          return eq;
        })
      );
      toast.success("Serial number added to existing equipment");
    }

    setChallanScannerOpen(false);
  };

  const handleGeneratePDF = async () => {
    if (!savedChallanId) {
      toast.error("Please save the challan first");
      return;
    }

    if (profiles.length === 0) {
      toast.error("Please create a company profile first in Settings");
      return;
    }

    setShowProfileDialog(true);
  };

  const handleConfirmDownload = async () => {
    if (!savedChallanId) {
      toast.error("Please save the challan first");
      return;
    }

    if (!isMountedRef.current) return;

    setDownloadingPDF(true);
    try {
      const challan = await challanAPI.getById(savedChallanId);
      if (isMountedRef.current && challan) {
        await downloadChallanPDF(challan, selectedProfileId || undefined);
        if (isMountedRef.current) {
          toast.success("PDF downloaded successfully");
          setShowProfileDialog(false);
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        toast.error("Failed to generate PDF");
      }
    } finally {
      if (isMountedRef.current) {
        setDownloadingPDF(false);
      }
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Store the file for upload later
    setSelectedFile(file);
    setDocumentFileName(file.name);

    // Create preview
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (isPdf) {
      // For PDF, we'll show the filename with a PDF icon
      setDocumentPreview(`pdf:${file.name}`);
    } else {
      setDocumentPreview(`file:${file.name}`);
    }

    toast.success("Document selected. It will be uploaded when you save the challan.");
  };

  const handleRemoveDocument = () => {
    setSelectedFile(null);
    setDocumentPreview("");
    setDocumentUrl("");
    setDocumentFileName("");
    toast.success("Document removed");
  };

  const handleDownloadDocument = () => {
    try {
      const urlToDownload = documentUrl || documentPreview;
      if (!urlToDownload) {
        toast.error("No document to download");
        return;
      }

      window.open(urlToDownload, "_blank");
      toast.success("Document opened in new tab");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to open document");
    }
  };

  return (
    <>
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Company Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Choose which company profile to use for this delivery challan PDF:
            </p>
            <div className="space-y-2">
              {profiles.map((profile) => (
                <Button
                  key={profile.id}
                  variant={selectedProfileId === profile.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedProfileId(profile.id || null)}
                >
                  <div className="flex items-center gap-3 w-full">
                    {profile.logo_url && (
                      <img
                        src={profile.logo_url}
                        alt={profile.company_name}
                        className="h-8 w-8 rounded object-contain bg-muted p-1"
                      />
                    )}
                    <div className="text-left">
                      <p className="font-medium text-sm">{profile.company_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setShowProfileDialog(false)}
                disabled={downloadingPDF}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDownload}
                disabled={downloadingPDF}
              >
                {downloadingPDF ? "Downloading..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" className="w-10 h-10" onClick={() => navigate(challanListPath)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">
              {id ? `Edit ${challanTypeLabel} Challan` : `New ${challanTypeLabel} Challan`}
            </h1>
            <Badge variant="outline" className="text-xs sm:text-sm">{challanTypeLabel}</Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Create and manage {challanTypeLabel.toLowerCase()} delivery challans
          </p>
        </div>
      </div>

      {showSuccess && savedChallanId && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <p className="text-green-700 font-medium mb-3">
              {challanTypeLabel} challan saved successfully!
            </p>
            <Button onClick={handleGeneratePDF} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{challanTypeLabel} Challan Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="space-y-3 sm:space-y-4">
            <Label className="text-sm sm:text-base">Company Profile *</Label>
            {profiles.length > 0 ? (
              <RadioGroup
                value={selectedChallanProfileId || ""}
                onValueChange={(value) => {
                  clearFieldError("companyProfile");
                  setSelectedChallanProfileId(value);
                }}
                className={cn("flex w-full flex-nowrap gap-3 overflow-x-auto", fieldErrors.companyProfile && "rounded-lg border border-red-500 p-2")}
              >
                {profiles.map((profile) => (
                  <Label
                    key={profile.id}
                    htmlFor={`challan-company-${profile.id}`}
                    className={cn(
                      "flex min-w-[220px] flex-1 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      selectedChallanProfileId === profile.id
                        ? "border-primary bg-primary/5"
                        : fieldErrors.companyProfile
                        ? "border-red-500 bg-red-50"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem id={`challan-company-${profile.id}`} value={profile.id || ""} className="mt-1" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{profile.company_name}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            ) : (
              <p className="text-sm text-muted-foreground">
                No company profiles found. Please create one in Settings first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
            <div className="space-y-2">
              <Label>Challan No</Label>
              <Input value={challanNo} readOnly placeholder={challanNumberPlaceholder} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => {
                  clearFieldError("date");
                  setDate(e.target.value);
                }}
                className={hasFieldError("date")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-date">Delivery Date *</Label>
              <Input
                id="delivery-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => {
                  clearFieldError("deliveryDate");
                  setDeliveryDate(e.target.value);
                }}
                className={hasFieldError("deliveryDate")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po">PO Number</Label>
              <Input
                id="po"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Enter PO number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 min-w-0 sm:grid-cols-3 sm:gap-4">
            <div className="space-y-1 sm:space-y-2 min-w-0">
              <Label htmlFor="customer" className="text-sm sm:text-base">Customer / Site Name *</Label>
              <Input
                id="customer"
                value={customerName}
                onChange={(e) => {
                  clearFieldError("customerName");
                  setCustomerName(e.target.value);
                }}
                placeholder="Enter customer or site name"
                className={hasFieldError("customerName")}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="location">Site Location</Label>
              <Input
                id="location"
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                placeholder="Enter site location"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="unit-no">Unit No</Label>
              <Input
                id="unit-no"
                value={unitNo}
                onChange={(e) => setUnitNo(e.target.value)}
                placeholder="Enter unit number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 min-w-0 sm:grid-cols-3 sm:gap-4">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="poc-name">POC Name</Label>
              <Input
                id="poc-name"
                value={pocName}
                onChange={(e) => setPocName(e.target.value)}
                placeholder="Point of contact name"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="poc-number">POC Number</Label>
              <Input
                id="poc-number"
                value={pocNumber}
                onChange={(e) => setPocNumber(e.target.value)}
                placeholder="Contact number"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="document-upload">Upload Document/Photo</Label>
              <div className="flex h-10 min-w-0 items-center gap-2">
                {documentPreview ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownloadDocument}
                      className="h-10 min-w-0 flex-1 justify-start gap-2 px-2"
                      title="Open current document"
                    >
                      {documentPreview.startsWith("pdf:") || documentPreview.startsWith("file:") ? (
                        <FileIcon className="h-4 w-4 shrink-0" />
                      ) : (
                        <img src={documentPreview} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                      )}
                      <span className="truncate text-xs">
                        {documentPreview.startsWith("pdf:")
                          ? documentPreview.replace("pdf:", "")
                          : documentPreview.startsWith("file:")
                          ? documentPreview.replace("file:", "")
                          : documentFileName || "Current document"}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => (document.getElementById("document-upload") as HTMLInputElement)?.click()}
                      aria-label="Change document"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleRemoveDocument}
                      aria-label="Remove document"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => (document.getElementById("document-upload") as HTMLInputElement)?.click()}
                    className="h-10 w-full justify-center gap-2 border-dashed"
                  >
                    <Upload className="h-4 w-4" />
                    Upload file
                  </Button>
                )}
                <input
                  id="document-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleDocumentUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground">Image or PDF, up to 10MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipment List */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg sm:text-xl">Equipment List ({equipment.length})</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
            <Button onClick={() => setChallanScannerOpen(true)} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto">
              <Camera className="h-4 w-4" />
              Quick Scan
            </Button>
            <Button onClick={addField} size="sm" className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Equipment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Professional Slider Container */}
          <div className="relative">
            {/* Slider Controls */}
            {equipment.length > 3 && (
              <div className="absolute top-0 right-0 z-10 flex flex-col gap-1 p-2 bg-white/95 backdrop-blur-sm rounded-bl-lg border-l border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const slider = document.getElementById('equipment-slider');
                    if (slider) {
                      slider.scrollTop -= slider.clientHeight;
                    }
                  }}
                  className="h-8 w-8 p-0 rounded-full bg-white shadow-md border hover:bg-gray-50"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const slider = document.getElementById('equipment-slider');
                    if (slider) {
                      slider.scrollTop += slider.clientHeight;
                    }
                  }}
                  className="h-8 w-8 p-0 rounded-full bg-white shadow-md border hover:bg-gray-50"
                >
                  ↓
                </Button>
              </div>
            )}
            
            {/* Scrollable Equipment List - Limited to 3 visible rows */}
            <div 
              id="equipment-slider"
              className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
            >
              <div className="space-y-4 sm:space-y-6 p-4">
                {equipment.map((eq, index) => (
                  <div key={eq.id} className="p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-4 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex justify-between items-center gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-700 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                          {index + 1}
                        </span>
                        Equipment
                      </h3>
                      {equipment.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEquipment(index)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.45fr)_5.5rem_minmax(0,1.65fr)]">
                      <div className="space-y-1 sm:space-y-2">
                        <Label htmlFor={`eq-category-${index}`} className="text-sm sm:text-base font-medium">Equipment Name *</Label>
                        <Popover
                          open={equipmentCategoryOpen[index] || false}
                          onOpenChange={(open) =>
                            setEquipmentCategoryOpen({ ...equipmentCategoryOpen, [index]: open })
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              id={`eq-category-${index}`}
                              variant="outline"
                              role="combobox"
                              aria-expanded={equipmentCategoryOpen[index] || false}
                              className={cn("w-full justify-between h-10", hasFieldError(`equipment-${index}-category`))}
                            >
                              {eq.category_id
                                ? categories.find((c) => c.id === eq.category_id)?.name
                                : "Select equipment category"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[280px] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search equipment..."
                                value={equipmentCategorySearch[index] || ""}
                                onValueChange={(value) =>
                                  setEquipmentCategorySearch({ ...equipmentCategorySearch, [index]: value })
                                }
                              />
                              <CommandEmpty>No equipment found.</CommandEmpty>
                              <CommandList className="max-h-[200px] sm:max-h-[250px] md:max-h-[300px] lg:max-h-[350px]">
                                <CommandGroup>
                                  {categories
                                    .filter((cat) =>
                                      cat.name
                                        ?.toLowerCase()
                                        .includes(
                                          (equipmentCategorySearch[index] || "").toLowerCase()
                                        )
                                    )
                                    .map((category) => (
                                      <CommandItem
                                        key={category.id}
                                        value={category.id || ""}
                                        onSelect={(currentValue) => {
                                          updateEquipment(index, "category_id", currentValue);
                                          updateEquipment(index, "subcategory_id", "");
                                          updateEquipment(
                                            index,
                                            "name",
                                            categories.find((c) => c.id === currentValue)?.name || ""
                                          );
                                          setEquipmentCategoryOpen({ ...equipmentCategoryOpen, [index]: false });
                                          setEquipmentCategorySearch({ ...equipmentCategorySearch, [index]: "" });
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            eq.category_id === category.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {category.name}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label htmlFor={`eq-subcategory-${index}`} className="text-sm sm:text-base font-medium">Equipment Details</Label>
                        <Popover
                          open={equipmentSubCategoryOpen[index] || false}
                          onOpenChange={(open) =>
                            setEquipmentSubCategoryOpen({ ...equipmentSubCategoryOpen, [index]: open })
                          }
                          disabled={!eq.category_id}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              id={`eq-subcategory-${index}`}
                              variant="outline"
                              role="combobox"
                              aria-expanded={equipmentSubCategoryOpen[index] || false}
                              className={cn("w-full justify-between h-10", hasFieldError(`equipment-${index}-details`))}
                              disabled={!eq.category_id}
                            >
                              {eq.subcategory_id
                                ? subCategoriesMap[eq.category_id]?.find((s) => s.id === eq.subcategory_id)?.name
                                : eq.manualEquipmentDetails
                                ? eq.manualEquipmentDetails
                                : eq.category_id
                                ? "Select equipment details"
                                : "Select category first"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[280px] p-0" align="start">
                            <div className="flex flex-col">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Search or type details..."
                                  value={equipmentSubCategorySearch[index] || ""}
                                  onValueChange={(value) =>
                                    setEquipmentSubCategorySearch({ ...equipmentSubCategorySearch, [index]: value })
                                  }
                                />
                                <CommandList className="max-h-[200px] sm:max-h-[250px] md:max-h-[300px] lg:max-h-[350px]">
                                  <CommandGroup>
                                    {eq.category_id &&
                                      subCategoriesMap[eq.category_id]
                                        ?.filter((subCat) =>
                                          subCat.name
                                            ?.toLowerCase()
                                            .includes(
                                              (equipmentSubCategorySearch[index] || "").toLowerCase()
                                            )
                                        )
                                        .map((subCat) => (
                                          <CommandItem
                                            key={subCat.id}
                                            value={subCat.id || ""}
                                            onSelect={(currentValue) => {
                                              clearFieldError(`equipment-${index}-details`);
                                              updateEquipment(index, "subcategory_id", currentValue);
                                              updateEquipment(index, "manualEquipmentDetails", "");
                                              setEquipmentSubCategoryOpen({
                                                ...equipmentSubCategoryOpen,
                                                [index]: false,
                                              });
                                              setEquipmentSubCategorySearch({
                                                ...equipmentSubCategorySearch,
                                                [index]: "",
                                              });
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                eq.subcategory_id === subCat.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {subCat.name}
                                          </CommandItem>
                                        ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                              {equipmentSubCategorySearch[index]?.trim() && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="m-2 justify-start text-left"
                                  onClick={() => {
                                    updateEquipment(index, "manualEquipmentDetails", equipmentSubCategorySearch[index].trim());
                                    updateEquipment(index, "subcategory_id", "");
                                    setEquipmentSubCategoryOpen({
                                      ...equipmentSubCategoryOpen,
                                      [index]: false,
                                    });
                                    setEquipmentSubCategorySearch({
                                      ...equipmentSubCategorySearch,
                                      [index]: "",
                                    });
                                  }}
                                >
                                  Use "{equipmentSubCategorySearch[index].trim()}" as manual entry
                                </Button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label htmlFor={`eq-qty-${index}`} className="text-sm sm:text-base font-medium">Quantity *</Label>
                        <Select
                          value={eq.quantity.toString()}
                          onValueChange={(value) => {
                            clearFieldError(`equipment-${index}-quantity`);
                            updateEquipment(index, "quantity", parseInt(value));
                          }}
                        >
                          <SelectTrigger id={`eq-qty-${index}`} className={cn("h-10", hasFieldError(`equipment-${index}-quantity`))}>
                            <SelectValue placeholder="Select quantity" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                    {/* Serial Numbers - Dynamic based on Quantity */}
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="space-y-1">
                          <Label className="text-sm sm:text-base font-medium">Serial Numbers ({eq.serialNumbers.filter(s => s.trim()).length}/{eq.quantity})</Label>
                        </div>
                        <Badge
                          variant={eq.serialNumbers.filter(s => s.trim()).length === eq.quantity ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {eq.serialNumbers.filter(s => s.trim()).length === eq.quantity ? "Complete" : "Pending"}
                        </Badge>
                      </div>
                      <div className="space-y-2 sm:space-y-2.5">
                        {Array.from({ length: eq.quantity }).map((_, serialIndex) => {
                          const isFilled = eq.serialNumbers[serialIndex]?.trim() !== "";
                          const validationKey = `${index}:${serialIndex}`;
                          const validationStatus = serialValidationStatus[validationKey];

                          return (
                            <div key={serialIndex} className="flex gap-2 items-end flex-col sm:flex-row">
                              <div className="flex-1 relative w-full">
                                <Input
                                  value={eq.serialNumbers[serialIndex] || ""}
                                  onChange={(e) => {
                                    updateSerialNumber(index, serialIndex, e.target.value);
                                    if (e.target.value.trim().length > 0) {
                                      setOpenSerialDropdown((prev) => ({
                                        ...prev,
                                        [`${index}:${serialIndex}`]: true,
                                      }));
                                    }
                                  }}
                                  onFocus={() => {
                                    if (eq.serialNumbers[serialIndex]?.trim().length > 0) {
                                      setOpenSerialDropdown((prev) => ({
                                        ...prev,
                                        [`${index}:${serialIndex}`]: true,
                                      }));
                                    }
                                  }}
                                  placeholder={`Serial #${serialIndex + 1} (or last 4 digits)`}
                                  className={
                                    validationStatus === "valid"
                                      ? "border-green-300 bg-green-50"
                                      : validationStatus === "invalid"
                                      ? "border-red-300 bg-red-50"
                                      : validationStatus === "checking"
                                      ? "border-amber-300 bg-amber-50"
                                      : isFilled
                                      ? "border-green-300 bg-green-50"
                                      : ""
                                  }
                                />
                                {validationStatus === "valid" && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                                    ✓
                                  </div>
                                )}
                                {validationStatus === "checking" && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="h-4 w-4 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                                  </div>
                                )}
                                {validationStatus === "invalid" && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600">
                                    ✕
                                  </div>
                                )}
                                {isFilled && !validationStatus && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                                    ✓
                                  </div>
                                )}
                                {/* Serial Suggestions Dropdown */}
                                {openSerialDropdown[`${index}:${serialIndex}`] &&
                                 serialSuggestions[`${index}:${serialIndex}`]?.length > 0 && (
                                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                    {serialSuggestions[`${index}:${serialIndex}`].map((item) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                          updateSerialNumber(index, serialIndex, item.serial_number || "");
                                          setOpenSerialDropdown((prev) => ({
                                            ...prev,
                                            [`${index}:${serialIndex}`]: false,
                                          }));
                                          // Trigger validation
                                          setTimeout(() => {
                                            validateSerialInInventory(index, serialIndex, item.serial_number || "");
                                          }, 100);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 transition-colors text-sm"
                                      >
                                        <div className="font-mono font-medium text-gray-900">{item.serial_number}</div>
                                        <div className="text-xs text-gray-600">
                                          {item.equipment_name || "Equipment"} • {item.store_name || "N/A"}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={isFilled ? "secondary" : "outline"}
                                onClick={() => openScanner(index, serialIndex)}
                                className="gap-2 w-full sm:w-auto"
                              >
                                <Camera className="h-4 w-4" />
                                <span className="sm:hidden">Scan Serial</span>
                                <span className="hidden sm:inline">Scan</span>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {id && challanType === "internal" && (
        <Card>
          <CardHeader>
            <CardTitle>Outward / Inward Item Tracking</CardTitle>
            <p className="text-sm text-muted-foreground">
              Record outward issue to temporarily remove available items from stock, then record their inward return here.
            </p>
          </CardHeader>
          <CardContent>
            {challanItemIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inventory-linked items on this challan.</p>
            ) : (
              <div className="space-y-3">
                {equipment.flatMap((equipmentItem) => (equipmentItem.itemIds || [])
                  .filter((itemId, itemIndex, itemIds) => itemId && itemIds.indexOf(itemId) === itemIndex)
                  .map((itemId) => {
                    const inventoryItem = challanInventoryItems[itemId];
                    const isIssuedOnThisChallan = Boolean(inventoryItem && inventoryItem.status === "out");
                    const isIssuing = issueItemMutation.isPending && issueItemMutation.variables === itemId;
                    const isReturning = returnItemMutation.isPending && returnItemMutation.variables === itemId;
                    return (
                      <div key={itemId} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">{equipmentItem.name || equipmentItem.manualEquipmentDetails || "Equipment"}</p>
                          <p className="text-sm text-muted-foreground">
                            Serial: {inventoryItem?.serial_number || equipmentItem.serialNumbers[(equipmentItem.itemIds || []).indexOf(itemId)] || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={isIssuedOnThisChallan ? "destructive" : inventoryItem ? "secondary" : "outline"}>
                            {!inventoryItem ? "Not issued on this challan" : inventoryItem.status === "out" ? "Outward · Awaiting return" : "In inventory"}
                          </Badge>
                          {isIssuedOnThisChallan ? (
                            <Button
                              size="sm"
                              onClick={() => returnItemMutation.mutate(itemId)}
                              disabled={returnItemMutation.isPending || issueItemMutation.isPending}
                            >
                              {isReturning ? "Recording..." : "Record inward return"}
                            </Button>
                          ) : inventoryItem?.status === "in" ? (
                            <Button
                              size="sm"
                              onClick={() => issueItemMutation.mutate(itemId)}
                              disabled={issueItemMutation.isPending || returnItemMutation.isPending}
                            >
                              {isIssuing ? "Issuing..." : "Record outward issue"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  }))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Barcode Scanner Modal - Serial Number */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between pb-3 sticky top-0 bg-background border-b">
              <CardTitle>Scan Barcode for Serial Number</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setScannerOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 py-6">
              <BarcodeScanner
                onScan={handleScanResult}
                active={scannerOpen}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setScannerOpen(false)}
                >
                  Close Scanner
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Scan for Challan - Auto fill */}
      {challanScannerOpen && (
        <ChallanBarcodeScanner
          onScanComplete={handleChallanScanComplete}
          onClose={() => setChallanScannerOpen(false)}
          siteLocation={customerName}
        />
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 sm:gap-3 flex-col-reverse sm:flex-row">
        <Button
          variant="outline"
          onClick={() => navigate(challanListPath)}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto"
        >
          {saveMutation.isPending ? "Saving..." : id ? `Update ${challanTypeLabel} Challan` : `Save ${challanTypeLabel} Challan`}
        </Button>
      </div>
      </div>
    </>
  );
}
