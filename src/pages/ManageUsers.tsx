import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { usersAPI, User, AVAILABLE_PERMISSIONS, AVAILABLE_PERMISSION_GROUPS } from "@/integrations/firebase/usersAPI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, UserPlus, Edit2, AlertCircle, ChevronDown, ChevronUp, Mail, User as UserIcon, Shield, Lock, Eye, EyeOff, Search } from "lucide-react";

const PROTECTED_ADMIN_EMAIL = "umair@aviratechnologies.com";

// Memoized User Card Component
const UserCard = ({
  user,
  isEditing,
  isExpanded,
  editingUserData,
  loading,
  appUser,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleExpand,
  onTogglePermission,
  onSendPasswordReset,
  getPermissionLabel,
  setEditingUserData
}: any) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {isEditing ? (
        // Edit Mode
        <div className="p-6 bg-blue-50 border-t-4 border-blue-600">
          <div className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Full Name
              </label>
              <Input
                value={editingUserData?.fullName || ""}
                onChange={(e) =>
                  setEditingUserData(editingUserData ? { ...editingUserData, fullName: e.target.value } : null)
                }
                placeholder="Enter full name"
                disabled={loading}
                className="max-w-md"
              />
            </div>

            {/* User Role */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-4">
                <Shield className="w-4 h-4 inline mr-2" />
                User Role
              </label>
              <div className="space-y-3 bg-white p-4 rounded border border-blue-200 max-w-md">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name={`userRole-${user.id}`}
                    value="user"
                    checked={editingUserData?.role === "user"}
                    onChange={(e) =>
                      setEditingUserData(editingUserData ? { ...editingUserData, role: e.target.value as "user" | "admin" } : null)
                    }
                    disabled={loading}
                    className="w-4 h-4 text-blue-600 cursor-pointer"
                  />
                  <span className="ml-3">
                    <div className="text-sm font-medium text-gray-900">Regular User</div>
                    <div className="text-xs text-gray-600">Limited access - only selected pages</div>
                  </span>
                </label>

                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name={`userRole-${user.id}`}
                    value="admin"
                    checked={editingUserData?.role === "admin"}
                    onChange={(e) =>
                      setEditingUserData(editingUserData ? { ...editingUserData, role: e.target.value as "user" | "admin" } : null)
                    }
                    disabled={loading}
                    className="w-4 h-4 text-blue-600 cursor-pointer"
                  />
                  <span className="ml-3">
                    <div className="text-sm font-medium text-gray-900">Admin User</div>
                    <div className="text-xs text-gray-600">Full access - all pages and features</div>
                  </span>
                </label>
              </div>
            </div>

            {/* Permissions - Only show for regular users */}
            {editingUserData?.role === "user" && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-4">
                <Shield className="w-4 h-4 inline mr-2" />
                Page Permissions
              </label>
              <div className="space-y-5 rounded border border-blue-200 bg-white p-4">
                {AVAILABLE_PERMISSION_GROUPS.map((group) => (
                  <section key={group.title} className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.title}</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-start">
                          <input
                            type="checkbox"
                            id={`edit-perm-${permission.id}`}
                            checked={editingUserData?.permissions?.includes(permission.id) || false}
                            onChange={() => onTogglePermission(permission.id)}
                            disabled={loading}
                            className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded text-blue-600"
                          />
                          <label htmlFor={`edit-perm-${permission.id}`} className="ml-3 flex-1 cursor-pointer">
                            <div className="text-sm font-medium text-gray-900">{permission.label}</div>
                            <div className="text-xs text-gray-600">{permission.description}</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            )}
            {editingUserData?.role === "admin" && (
            <div className="bg-blue-100 border border-blue-300 p-4 rounded">
              <p className="text-sm font-medium text-blue-900">
                <Shield className="w-4 h-4 inline mr-2" />
                Admin users have access to all features and pages.
              </p>
            </div>
            )}

            {/* Account Status */}
            <div className="flex items-center gap-3 bg-white p-4 rounded border border-gray-200">
              <input
                type="checkbox"
                id={`disable-${user.id}`}
                checked={editingUserData?.isDisabled || false}
                onChange={(e) =>
                  setEditingUserData(editingUserData ? { ...editingUserData, isDisabled: e.target.checked } : null)
                }
                disabled={loading}
                className="w-4 h-4 text-red-600 rounded cursor-pointer"
              />
              <label htmlFor={`disable-${user.id}`} className="flex-1 cursor-pointer">
                <div className="text-sm font-medium text-gray-900">Disable Account</div>
                <div className="text-xs text-gray-600">User will not be able to log in</div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                size="sm"
                onClick={() => onSaveEdit(user.id, editingUserData)}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Save Changes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEdit}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // View Mode
        <div>
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
            onClick={() => onToggleExpand(user.id)}
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <UserIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{user.fullName}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                  <Mail className="w-3 h-3" />
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                {user.isDisabled && (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                    Disabled
                  </span>
                )}
                {!user.isDisabled && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                    Active
                  </span>
                )}
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                  {user.permissions?.length || 0} permissions
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
              {/* Permissions List */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  <Shield className="w-4 h-4 inline mr-2" />
                  Assigned Permissions
                </h4>
                {user.permissions && user.permissions.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {user.permissions.map((permId: string) => (
                      <span
                        key={permId}
                        className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 font-medium"
                      >
                        {getPermissionLabel(permId)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No permissions assigned</p>
                )}
              </div>

              {/* User Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Created</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Last Updated</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(user.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 flex-wrap">
                {user.email === PROTECTED_ADMIN_EMAIL && (
                  <span className="text-xs px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-medium">
                    🔒 Admin (Protected)
                  </span>
                )}
                {user.id !== appUser?.id && user.email !== PROTECTED_ADMIN_EMAIL && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStartEdit(user)}
                      disabled={loading}
                      className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSendPasswordReset(user.email, user.fullName)}
                      disabled={loading}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Reset Password
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(user.id)}
                      disabled={loading}
                      className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
                {user.id === appUser?.id && (
                  <span className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                    Your Account (Admin)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ManageUsers() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "add">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Add new user form
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [confirmNewUserPassword, setConfirmNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>([]);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showConfirmUserPassword, setShowConfirmUserPassword] = useState(false);

  // Edit user form
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserData, setEditingUserData] = useState<Partial<User> | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await usersAPI.getAll();
      setUsers(allUsers);
    } catch (error) {
      toast.error("Failed to load users");
    }
  }, []);

  const handleAddUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserEmail || !newUserName || !newUserPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newUserPassword !== confirmNewUserPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      await usersAPI.createWithPassword(
        newUserEmail,
        newUserPassword,
        newUserName,
        newUserRole,
        newUserRole === "admin" ? [] : newUserPermissions
      );
      toast.success("User added successfully!");
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setConfirmNewUserPassword("");
      setNewUserRole("user");
      setNewUserPermissions([]);
      setActiveTab("list");
      await loadUsers();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Failed to add user. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [newUserEmail, newUserName, newUserPassword, confirmNewUserPassword, newUserRole, newUserPermissions, loadUsers]);

  const handleStartEditUser = useCallback((user: User) => {
    setEditingUserId(user.id);
    setEditingUserData({ ...user });
    setExpandedUserId(null);
  }, []);

  const handleCancelEditUser = useCallback(() => {
    setEditingUserId(null);
    setEditingUserData(null);
  }, []);

  const handleSaveEditUser = useCallback(async (userId: string, userData: Partial<User>) => {
    if (!userId || !userData) return;

    setLoading(true);
    try {
      await usersAPI.update(userId, {
        fullName: userData.fullName,
        role: userData.role,
        permissions: userData.permissions,
        isDisabled: userData.isDisabled,
      });
      
      // Optimistic update
      setUsers(prevUsers => 
        prevUsers.map(u => u.id === userId ? { ...u, ...userData } : u)
      );
      
      toast.success("User updated successfully!");
      setEditingUserId(null);
      setEditingUserData(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
      loadUsers(); // Reload if optimistic update fails
    } finally {
      setLoading(false);
    }
  }, [loadUsers]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (userId === appUser?.id) {
      toast.error("Cannot delete your own admin account");
      return;
    }

    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      // Optimistic update
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      
      await usersAPI.delete(userId);
      toast.success("User deleted successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
      loadUsers(); // Reload if optimistic update fails
    }
  }, [appUser?.id, loadUsers]);

  const handlePermissionToggle = useCallback((permissionId: string) => {
    setNewUserPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId]
    );
  }, []);

  const handleEditingPermissionToggle = useCallback((permissionId: string) => {
    if (editingUserData) {
      const currentPermissions = editingUserData.permissions || [];
      setEditingUserData({
        ...editingUserData,
        permissions: currentPermissions.includes(permissionId)
          ? currentPermissions.filter((p) => p !== permissionId)
          : [...currentPermissions, permissionId],
      });
    }
  }, [editingUserData]);

  const handleSendPasswordReset = useCallback(async (email: string, userName: string) => {
    if (!confirm(`Send password reset email to ${userName} (${email})?`)) {
      return;
    }

    setLoading(true);
    try {
      await usersAPI.sendPasswordResetEmail(email);
      toast.success(`Password reset email sent to ${email}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to send password reset email");
    } finally {
      setLoading(false);
    }
  }, []);

  const getPermissionLabel = useCallback((permissionId: string) => {
    const permission = AVAILABLE_PERMISSIONS.find((p) => p.id === permissionId);
    return permission?.label || permissionId;
  }, []);

  // Memoized filtered users
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(u => 
      u.fullName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage user accounts, permissions, and access controls</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === "list"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Users List
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === "add"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            Add New User
          </button>
        </div>

        {/* Users List Tab */}
        {activeTab === "list" && (
          <div className="space-y-4">
            {users.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
            
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  {users.length === 0 ? "No users found" : "No matching users"}
                </p>
                {users.length === 0 && (
                  <Button onClick={() => setActiveTab("add")} className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add First User
                  </Button>
                )}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  isEditing={editingUserId === user.id}
                  isExpanded={expandedUserId === user.id}
                  editingUserData={editingUserData}
                  setEditingUserData={setEditingUserData}
                  loading={loading}
                  appUser={appUser}
                  onStartEdit={handleStartEditUser}
                  onCancelEdit={handleCancelEditUser}
                  onSaveEdit={handleSaveEditUser}
                  onDelete={handleDeleteUser}
                  onToggleExpand={(id: string) => setExpandedUserId(expandedUserId === id ? null : id)}
                  onTogglePermission={handleEditingPermissionToggle}
                  onSendPasswordReset={handleSendPasswordReset}
                  getPermissionLabel={getPermissionLabel}
                />
              ))
            )}
          </div>
        )}

        {/* Add New User Tab */}
        {activeTab === "add" && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Create New User Account
              </h2>

              <form onSubmit={handleAddUser} className="space-y-6">
                {/* User Details Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-gray-900">Account Details</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      disabled={loading}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <Input
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Umair"
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showNewUserPassword ? "text" : "password"}
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          disabled={loading}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                          disabled={loading}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                          {showNewUserPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showConfirmUserPassword ? "text" : "password"}
                          value={confirmNewUserPassword}
                          onChange={(e) => setConfirmNewUserPassword(e.target.value)}
                          placeholder="Confirm password"
                          disabled={loading}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmUserPassword(!showConfirmUserPassword)}
                          disabled={loading}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                          {showConfirmUserPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Role Section */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    User Role
                  </h3>
                  <p className="text-sm text-gray-600">
                    Choose the role for this user. Admin users have access to all features.
                  </p>

                  <div className="space-y-3 bg-white p-4 rounded border border-gray-200">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="userRole"
                        value="user"
                        checked={newUserRole === "user"}
                        onChange={(e) => setNewUserRole(e.target.value as "user" | "admin")}
                        disabled={loading}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                      <span className="ml-3">
                        <div className="text-sm font-medium text-gray-900">Regular User</div>
                        <div className="text-xs text-gray-600">Limited access - only selected pages</div>
                      </span>
                    </label>

                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="userRole"
                        value="admin"
                        checked={newUserRole === "admin"}
                        onChange={(e) => setNewUserRole(e.target.value as "user" | "admin")}
                        disabled={loading}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                      <span className="ml-3">
                        <div className="text-sm font-medium text-gray-900">Admin User</div>
                        <div className="text-xs text-gray-600">Full access - all pages and features</div>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Permissions Section - Only show for regular users */}
                {newUserRole === "user" && (
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    Page Permissions
                  </h3>
                  <p className="text-sm text-gray-600">
                    Select which pages this user can access
                  </p>

                  <div className="space-y-5 rounded border border-gray-200 bg-white p-4">
                    {AVAILABLE_PERMISSION_GROUPS.map((group) => (
                      <section key={group.title} className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.title}</h4>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {group.permissions.map((permission) => (
                            <div key={permission.id} className="flex items-start">
                              <input
                                type="checkbox"
                                id={`perm-${permission.id}`}
                                checked={newUserPermissions.includes(permission.id)}
                                onChange={() => handlePermissionToggle(permission.id)}
                                disabled={loading}
                                className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded text-blue-600"
                              />
                              <label htmlFor={`perm-${permission.id}`} className="ml-3 flex-1 cursor-pointer">
                                <div className="text-sm font-medium text-gray-900">{permission.label}</div>
                                <div className="text-xs text-gray-600">{permission.description}</div>
                              </label>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Important Information</p>
                    <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                      <li>User will be able to log in immediately with the provided password</li>
                      <li>Your admin session will remain active during user creation</li>
                      <li>To reset an existing user's password, use the "Reset Password" button in the user's details panel</li>
                      <li>Password reset emails allow users to securely set their own new password</li>
                    </ul>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create User Account
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNewUserEmail("");
                      setNewUserName("");
                      setNewUserPassword("");
                      setConfirmNewUserPassword("");
                      setNewUserRole("user");
                      setNewUserPermissions([]);
                      setActiveTab("list");
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
