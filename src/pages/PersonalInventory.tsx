import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personsAPI, personItemsAPI } from "@/integrations/firebase/firestore";
import { usersAPI, type User } from "@/integrations/firebase/usersAPI";
import { realtimePersonsAPI, realtimePersonItemsAPI } from "@/integrations/firebase/realtimeAPI";
import { useFirestoreRealtimeQuery } from "@/hooks/useFirestoreRealtimeQuery";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, Trash2, Pencil, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

const personSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
});

export default function PersonalInventory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const usersUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to real-time updates
  useFirestoreRealtimeQuery(
    ["persons"],
    (callback) => realtimePersonsAPI.subscribeAll(callback)
  );

  useFirestoreRealtimeQuery(
    ["person_items"],
    (callback) => realtimePersonItemsAPI.subscribeAll(callback)
  );

  // Subscribe to users for assignment
  useEffect(() => {
    usersUnsubRef.current = usersAPI.subscribeAll((users) => {
      setAllUsers(users);
    });

    return () => {
      usersUnsubRef.current?.();
    };
  }, []);

  const { data: allPersonsData, isLoading } = useQuery({
    queryKey: ["persons"],
    queryFn: async () => {
      return await personsAPI.getAll();
    },
    staleTime: Infinity, // Data is kept fresh by real-time subscription
  });

  // Filter persons based on user role
  const persons = allPersonsData?.filter((person) => {
    const roleMatch = isAdmin || (person.assignedUsers || []).includes(appUser?.id || "");
    return roleMatch;
  });

  const { data: allPersonItems } = useQuery({
    queryKey: ["person_items"],
    queryFn: async () => {
      return await personItemsAPI.getAll();
    },
    staleTime: Infinity, // Data is kept fresh by real-time subscription
  });

  const getPersonItemCount = (personId: string) => {
    return allPersonItems?.filter((item: any) => item.person_id === personId).length || 0;
  };

  const getPersonTotalQuantity = (personId: string) => {
    const items = allPersonItems?.filter((item: any) => item.person_id === personId) || [];
    return items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = personSchema.parse({ name });
      if (editId) {
        await personsAPI.update(editId, {
          name: parsed.name,
          ...(isAdmin ? { assignedUsers } : {}),
        });
      } else {
        await personsAPI.create({
          name: parsed.name,
          assignedUsers: isAdmin ? assignedUsers : [],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      toast.success(editId ? "Person updated" : "Person created");
      closeDialog();
    },
    onError: (err: any) => {
      console.error("Person save error:", err);
      if (err.issues) {
        toast.error(err.issues[0].message);
      } else if (err.message) {
        toast.error(`Failed to save: ${err.message}`);
      } else {
        toast.error("Failed to save person. Please check your Firebase connection.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete all items for this person first
      const items = allPersonItems?.filter((item: any) => item.person_id === id) || [];
      for (const item of items) {
        await personItemsAPI.delete(item.id);
      }
      await personsAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      queryClient.invalidateQueries({ queryKey: ["person_items"] });
      toast.success("Person deleted");
    },
    onError: (err: any) => {
      console.error("Person delete error:", err);
      if (err.message) {
        toast.error(`Failed to delete: ${err.message}`);
      } else {
        toast.error("Failed to delete person. Please check your Firebase connection.");
      }
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setName("");
    setAssignedUsers([]);
  };

  const openEdit = (person: any) => {
    setEditId(person.id);
    setName(person.name);
    setAssignedUsers(person.assignedUsers || []);
    setDialogOpen(true);
  };

  const toggleUserAssignment = (userId: string) => {
    setAssignedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Calculate statistics for dashboard
  const totalPersons = persons?.length ?? 0;
  const totalItems = allPersonItems?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) ?? 0;

  const statsCards = [
    { label: "Total Persons", value: totalPersons, icon: Users, color: "text-primary" },
    { label: "Total Items", value: totalItems, icon: Package, color: "text-success" },
  ];

  const handleDeletePerson = (personId: string) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only administrators can delete persons");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this person?")) {
      return;
    }

    deleteMutation.mutate(personId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personal Inventory</h1>
          <p className="text-muted-foreground">Manage inventory for each person</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Person
          </Button>
        )}
      </div>

      {/* Dashboard Stats Cards - Admin Only */}
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {statsCards.map((s) => (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-28" />
            </Card>
          ))}
        </div>
      ) : persons && persons.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {persons.map((person: any) => (
            <Card
              key={person.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/personal-inventory/${person.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{person.name}</CardTitle>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => openEdit(person)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDeletePerson(person.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>{getPersonItemCount(person.id)} items</span>
                  </div>
                  <div className="text-sm font-medium">
                    <span className="text-muted-foreground">Total Quantity: </span>
                    <span className="text-foreground">{getPersonTotalQuantity(person.id)} units</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No persons yet. Create your first one!</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Person" : "New Person"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="person-name">Name</Label>
              <Input
                id="person-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Umar, Ali, Asim"
                maxLength={100}
              />
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Assign Users</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {allUsers && allUsers.length > 0 ? (
                    allUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`user-${user.id}`}
                          checked={assignedUsers.includes(user.id)}
                          onChange={() => toggleUserAssignment(user.id)}
                          className="rounded"
                        />
                        <label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer text-sm">
                          <div className="font-medium">{user.fullName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No users available</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {assignedUsers.length === 0
                    ? "No users assigned - person will only be visible to admins"
                    : `${assignedUsers.length} user(s) assigned`}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
