import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { personsAPI, personItemsAPI, personItemTransactionsAPI, personSitesAPI } from "@/integrations/firebase/firestore";
import { realtimePersonsAPI, realtimePersonItemsAPI, realtimePersonItemTransactionsAPI, realtimePersonSitesAPI } from "@/integrations/firebase/realtimeAPI";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Package, Pencil, Trash2, Send } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

const addItemSchema = z.object({
  item_name: z.string().trim().min(1, "Item name required").max(100),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  notes: z.string().trim().max(500).optional(),
});

const issueItemSchema = z.object({
  quantity_issued: z.number().min(1, "Quantity must be at least 1"),
  recipient_name: z.string().trim().min(1, "Recipient name required").max(100),
  notes: z.string().trim().max(500).optional(),
});

const addSiteSchema = z.object({
  site_name: z.string().trim().min(1, "Site name required").max(100),
  status: z.enum(["Completed", "Travelling", "Onsite – Work In Progress", "Onsite – Completed", "Returned to Base", "Standby / Idle"], {
    errorMap: () => ({ message: "Status required" }),
  }),
  poc_name: z.string().trim().max(100).optional(),
  poc_contact: z.string().trim().max(20).optional(),
  location: z.string().trim().max(100).optional(),
});

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Completed":
      return "default";
    case "Onsite – Completed":
      return "default";
    case "Travelling":
      return "secondary";
    case "Onsite – Work In Progress":
      return "secondary";
    case "Returned to Base":
      return "outline";
    case "Standby / Idle":
      return "destructive";
    default:
      return "outline";
  }
};

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();

  // Realtime subscription refs
  const personUnsubRef = useRef<(() => void) | null>(null);
  const itemsUnsubRef = useRef<(() => void) | null>(null);
  const issuedItemsUnsubRef = useRef<(() => void) | null>(null);
  const sitesUnsubRef = useRef<(() => void) | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [issueItemId, setIssueItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState<number | string>("");
  const [notes, setNotes] = useState("");
  const [issueQuantity, setIssueQuantity] = useState<number | string>("");
  const [recipientName, setRecipientName] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [filter, setFilter] = useState("");
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const [editSiteOpen, setEditSiteOpen] = useState(false);
  const [editSiteId, setEditSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [siteStatus, setSiteStatus] = useState<"Completed", "Travelling" | "Onsite – Work In Progress" | "Onsite – Completed" | "Returned to Base" | "Standby / Idle" | "">("");
  const [pocName, setPocName] = useState("");
  const [pocContact, setPocContact] = useState("");
  const [location, setLocation] = useState("");
  const [person, setPerson] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [issuedItems, setIssuedItems] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;

    setIsLoading(true);

    // Subscribe to person
    personUnsubRef.current = realtimePersonsAPI.subscribeById(id, (data) => {
      setPerson(data);
    });

    // Subscribe to person items
    itemsUnsubRef.current = realtimePersonItemsAPI.subscribeByPerson(id, (data) => {
      setItems(data);
      setIsLoading(false);
    });

    // Subscribe to issued items (transactions)
    issuedItemsUnsubRef.current = realtimePersonItemTransactionsAPI.subscribeByPerson(id, (data) => {
      setIssuedItems(data);
    });

    // Subscribe to person sites
    sitesUnsubRef.current = realtimePersonSitesAPI.subscribeByPerson(id, (data) => {
      setSites(data);
    });

    // Cleanup subscriptions on unmount or id change
    return () => {
      personUnsubRef.current?.();
      itemsUnsubRef.current?.();
      issuedItemsUnsubRef.current?.();
      sitesUnsubRef.current?.();
    };
  }, [id]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const parsed = addItemSchema.parse({
        item_name: itemName,
        quantity: parseInt(quantity as string),
        notes: notes || undefined,
      });
      await personItemsAPI.create({
        person_id: id!,
        item_name: parsed.item_name,
        quantity: parsed.quantity,
        ...(parsed.notes ? { notes: parsed.notes } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["person-items", id] });
      toast.success("Item added");
      setAddOpen(false);
      setItemName("");
      setQuantity("");
      setNotes("");
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error("Failed to add item");
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const parsed = addItemSchema.parse({
        item_name: itemName,
        quantity: parseInt(quantity as string),
        notes: notes || undefined,
      });
      await personItemsAPI.update(editItemId!, {
        item_name: parsed.item_name,
        quantity: parsed.quantity,
        ...(parsed.notes ? { notes: parsed.notes } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["person-items", id] });
      toast.success("Item updated");
      setEditOpen(false);
      setEditItemId(null);
      setItemName("");
      setQuantity("");
      setNotes("");
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error("Failed to update item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await personItemsAPI.delete(itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["person-items", id] });
      toast.success("Item deleted");
    },
    onError: () => toast.error("Failed to delete item"),
  });

  const addSiteMutation = useMutation({
    mutationFn: async () => {
      const parsed = addSiteSchema.parse({
        site_name: siteName,
        status: siteStatus,
        poc_name: pocName || undefined,
        poc_contact: pocContact || undefined,
        location: location || undefined,
      });
      await personSitesAPI.create({
        person_id: id!,
        site_name: parsed.site_name,
        status: parsed.status,
        ...(parsed.poc_name ? { poc_name: parsed.poc_name } : {}),
        ...(parsed.poc_contact ? { poc_contact: parsed.poc_contact } : {}),
        ...(parsed.location ? { location: parsed.location } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["person-sites", id] });
      toast.success("Site added");
      setAddSiteOpen(false);
      setSiteName("");
      setSiteStatus("");
      setPocName("");
      setPocContact("");
      setLocation("");
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error("Failed to add site");
    },
  });

  const editSiteMutation = useMutation({
    mutationFn: async () => {
      const parsed = addSiteSchema.parse({
        site_name: siteName,
        status: siteStatus,
        poc_name: pocName || undefined,
        poc_contact: pocContact || undefined,
        location: location || undefined,
      });
      await personSitesAPI.update(editSiteId!, {
        site_name: parsed.site_name,
        status: parsed.status,
        ...(parsed.poc_name ? { poc_name: parsed.poc_name } : {}),
        ...(parsed.poc_contact ? { poc_contact: parsed.poc_contact } : {}),
        ...(parsed.location ? { location: parsed.location } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["person-sites", id] });
      toast.success("Site updated");
      setEditSiteOpen(false);
      setEditSiteId(null);
      setSiteName("");
      setSiteStatus("");
      setPocName("");
      setPocContact("");
      setLocation("");
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error("Failed to update site");
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      await personSitesAPI.delete(siteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["person-sites", id] });
      toast.success("Site deleted");
    },
    onError: () => toast.error("Failed to delete site"),
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const parsed = issueItemSchema.parse({
        quantity_issued: parseInt(issueQuantity as string),
        recipient_name: recipientName,
        notes: issueNotes || undefined,
      });

      const item = items?.find((i) => i.id === issueItemId);
      if (!item) throw new Error("Item not found");

      // Validate that issued quantity does not exceed available quantity
      if (parsed.quantity_issued > item.quantity) {
        throw new Error(`Cannot issue more than available quantity (${item.quantity})`);
      }

      // Update item quantity by deducting the issued amount
      const newQuantity = item.quantity - parsed.quantity_issued;
      await personItemsAPI.update(issueItemId!, {
        quantity: newQuantity,
      });

      // Create transaction log
      await personItemTransactionsAPI.create({
        person_item_id: issueItemId!,
        person_id: id!,
        item_name: item.item_name,
        quantity_issued: parsed.quantity_issued,
        recipient_name: parsed.recipient_name,
        created_by: appUser?.fullName || appUser?.email || "Unknown User",
        ...(parsed.notes ? { notes: parsed.notes } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["person-items", id] });
      queryClient.invalidateQueries({ queryKey: ["person-issued-items", id] });
      toast.success("Item issued successfully");
      setIssueOpen(false);
      setIssueItemId(null);
      setIssueQuantity("");
      setRecipientName("");
      setIssueNotes("");
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error(err.message || "Failed to issue item");
    },
  });

  const filtered = items?.filter(
    (i) =>
      i.item_name.toLowerCase().includes(filter.toLowerCase()) ||
      (i.notes && i.notes.toLowerCase().includes(filter.toLowerCase()))
  );

  const openEdit = (item: any) => {
    setEditItemId(item.id);
    setItemName(item.item_name);
    setQuantity(item.quantity);
    setNotes(item.notes || "");
    setEditOpen(true);
  };

  const openIssue = (item: any) => {
    setIssueItemId(item.id);
    setIssueQuantity("");
    setRecipientName("");
    setIssueNotes("");
    setIssueOpen(true);
  };

  const openEditSite = (site: any) => {
    setEditSiteId(site.id);
    setSiteName(site.site_name);
    setSiteStatus(site.status);
    setPocName(site.poc_name || "");
    setPocContact(site.poc_contact || "");
    setLocation(site.location || "");
    setEditSiteOpen(true);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only administrators can delete items");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this item?")) {
      return;
    }

    deleteMutation.mutate(itemId);
  };

  const handleDeleteSite = (siteId: string) => {
    if (!window.confirm("Are you sure you want to delete this assigned site?")) {
      return;
    }

    deleteSiteMutation.mutate(siteId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/personal-inventory")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{person?.name ?? "Person"}</h1>
          <p className="text-muted-foreground text-sm">Manage inventory items</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory Items</TabsTrigger>
          <TabsTrigger value="issued">Issued Items</TabsTrigger>
          <TabsTrigger value="sites">Assign Sites</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Filter by name or notes..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : filtered && filtered.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.notes || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(item.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-blue-600 hover:text-blue-700"
                            onClick={() => openIssue(item)}
                          >
                            <Send className="h-3.5 w-3.5" /> Issue
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center py-12">
                  <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">No items for this person</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issued" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {issuedItems && issuedItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Quantity Issued</TableHead>
                      <TableHead>Recipient Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Issued On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issuedItems.map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">{transaction.item_name}</TableCell>
                        <TableCell>{transaction.quantity_issued}</TableCell>
                        <TableCell>{transaction.recipient_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{transaction.notes || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(transaction.created_at), "MMM d, yyyy h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center py-12">
                  <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">No items issued yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddSiteOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Site
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {sites && sites.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>POC Name</TableHead>
                      <TableHead>POC Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">{site.site_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{site.location || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{site.poc_name || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{site.poc_contact || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(site.status)}>
                            {site.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(site.created_at || ""), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => openEditSite(site)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDeleteSite(site.id!)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center py-12">
                  <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">No sites assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to {person?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Camera, NVR, Monitor"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 4"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes (optional)"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Camera, NVR, Monitor"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 4"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes (optional)"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              {editMutation.isPending ? "Updating..." : "Update Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Item Dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity to Issue *</Label>
              <Input
                type="number"
                value={issueQuantity}
                onChange={(e) => setIssueQuantity(e.target.value)}
                placeholder="e.g. 2"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient Name *</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. John Smith, Ahmed Khan"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                placeholder="Additional notes (optional)"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending}>
              {issueMutation.isPending ? "Issuing..." : "Issue Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Site Dialog */}
      <Dialog open={addSiteOpen} onOpenChange={setAddSiteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Site to {person?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Site Name *</Label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. New York Office, London Branch"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. 123 Main St, New York, NY"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>POC Name</Label>
              <Input
                value={pocName}
                onChange={(e) => setPocName(e.target.value)}
                placeholder="e.g. John Smith"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>POC Contact Number</Label>
              <Input
                value={pocContact}
                onChange={(e) => setPocContact(e.target.value)}
                placeholder="e.g. +1-555-0123"
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <select
                value={siteStatus}
                onChange={(e) => setSiteStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              >
                <option value="">Select status...</option>
                <option value="Completed">Completed</option>
                <option value="Travelling">Travelling</option>
                <option value="Onsite – Work In Progress">Onsite – Work In Progress</option>
                <option value="Onsite – Completed">Onsite – Completed</option>
                <option value="Returned to Base">Returned to Base</option>
                <option value="Standby / Idle">Standby / Idle</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSiteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addSiteMutation.mutate()} disabled={addSiteMutation.isPending}>
              {addSiteMutation.isPending ? "Adding..." : "Add Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={editSiteOpen} onOpenChange={setEditSiteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Site Name *</Label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. New York Office, London Branch"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. 123 Main St, New York, NY"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>POC Name</Label>
              <Input
                value={pocName}
                onChange={(e) => setPocName(e.target.value)}
                placeholder="e.g. John Smith"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>POC Contact Number</Label>
              <Input
                value={pocContact}
                onChange={(e) => setPocContact(e.target.value)}
                placeholder="e.g. +1-555-0123"
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <select
                value={siteStatus}
                onChange={(e) => setSiteStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              >
                <option value="">Select status...</option>
                <option value="Completed">Completed</option>
                <option value="Travelling">Travelling</option>
                <option value="Onsite – Work In Progress">Onsite – Work In Progress</option>
                <option value="Onsite – Completed">Onsite – Completed</option>
                <option value="Returned to Base">Returned to Base</option>
                <option value="Standby / Idle">Standby / Idle</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSiteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => editSiteMutation.mutate()} disabled={editSiteMutation.isPending}>
              {editSiteMutation.isPending ? "Updating..." : "Update Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
