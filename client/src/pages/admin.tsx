import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  useVegetableItems, 
  useCreateVegetableItem, 
  useUpdateVegetableItem, 
  useDeleteVegetableItem,
  useVerifyAdminPin,
  useChangeAdminPin,
  useClientNames,
  useCreateClientName,
  useUpdateClientName,
  useDeleteClientName,
  useUsers,
  useCreateUser,
  useDeleteUser,
  useCurrentUser,
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
} from "@/hooks/use-reports";
import { Loader2, Plus, Pencil, Trash2, Save, X, Lock, KeyRound, Building2, Users, UserPlus, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const verifyPinMutation = useVerifyAdminPin();

  const handlePinSubmit = async () => {
    const valid = await verifyPinMutation.mutateAsync(pinInput);
    if (valid) {
      setIsAuthenticated(true);
    } else {
      toast({ title: "Access Denied", description: "Incorrect PIN. Please try again.", variant: "destructive" });
      setPinInput("");
    }
  };

  const { data: vegetables, isLoading } = useVegetableItems();
  const createMutation = useCreateVegetableItem();
  const updateMutation = useUpdateVegetableItem();
  const deleteMutation = useDeleteVegetableItem();
  const changePinMutation = useChangeAdminPin();
  const { toast } = useToast();

  const [newItemName, setNewItemName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const { data: clients, isLoading: clientsLoading } = useClientNames();
  const createClientMutation = useCreateClientName();
  const updateClientMutation = useUpdateClientName();
  const deleteClientMutation = useDeleteClientName();
  const [newClientName, setNewClientName] = useState("");
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [editingClientName, setEditingClientName] = useState("");

  const { data: vendorsList, isLoading: vendorsLoading } = useVendors();
  const createVendorMutation = useCreateVendor();
  const updateVendorMutation = useUpdateVendor();
  const deleteVendorMutation = useDeleteVendor();
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorAddress, setNewVendorAddress] = useState("");
  const [newVendorGstNo, setNewVendorGstNo] = useState("");
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);
  const [editingVendorName, setEditingVendorName] = useState("");
  const [editingVendorPhone, setEditingVendorPhone] = useState("");
  const [editingVendorAddress, setEditingVendorAddress] = useState("");
  const [editingVendorGstNo, setEditingVendorGstNo] = useState("");

  const { data: currentUser } = useCurrentUser();
  const { data: userList, isLoading: usersLoading } = useUsers();
  const createUserMutation = useCreateUser();
  const deleteUserMutation = useDeleteUser();
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [newUserClient, setNewUserClient] = useState("");
  const [newUserPerms, setNewUserPerms] = useState<string[]>(['expense', 'cashseal', 'inventory', 'menu', 'purchase']);

  const permissionLabels: Record<string, string> = {
    expense: 'Daily Cash Expance',
    cashseal: 'Daily Cash Seal',
    inventory: 'Daily Inventory',
    menu: 'Menu Manager',
    purchase: 'Purchase Request',
  };

  const togglePerm = (perm: string) => {
    setNewUserPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const handleCreate = async () => {
    if (!newItemName.trim()) return;
    try {
      await createMutation.mutateAsync({ name: newItemName });
      setNewItemName("");
      toast({ title: "Success", description: "Vegetable item added" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editingName.trim()) return;
    try {
      await updateMutation.mutateAsync({ id, name: editingName });
      setEditingId(null);
      toast({ title: "Success", description: "Vegetable item updated" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Success", description: "Vegetable item deleted" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      await createClientMutation.mutateAsync({ name: newClientName });
      setNewClientName("");
      toast({ title: "Success", description: "Client added" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to add client", variant: "destructive" });
    }
  };

  const handleUpdateClient = async (id: number) => {
    if (!editingClientName.trim()) return;
    try {
      await updateClientMutation.mutateAsync({ id, name: editingClientName });
      setEditingClientId(null);
      toast({ title: "Success", description: "Client updated" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to update client", variant: "destructive" });
    }
  };

  const handleDeleteClient = async (id: number) => {
    try {
      await deleteClientMutation.mutateAsync(id);
      toast({ title: "Success", description: "Client deleted" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete client", variant: "destructive" });
    }
  };

  const handleCreateVendor = async () => {
    if (!newVendorName.trim()) return;
    try {
      await createVendorMutation.mutateAsync({ name: newVendorName.trim(), phone: newVendorPhone.trim(), address: newVendorAddress.trim(), gstNo: newVendorGstNo.trim() });
      setNewVendorName("");
      setNewVendorPhone("");
      setNewVendorAddress("");
      setNewVendorGstNo("");
      toast({ title: "Success", description: "Vendor added" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to add vendor", variant: "destructive" });
    }
  };

  const handleUpdateVendor = async (id: number) => {
    if (!editingVendorName.trim()) return;
    try {
      await updateVendorMutation.mutateAsync({ id, name: editingVendorName.trim(), phone: editingVendorPhone.trim(), address: editingVendorAddress.trim(), gstNo: editingVendorGstNo.trim() });
      setEditingVendorId(null);
      toast({ title: "Success", description: "Vendor updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update vendor", variant: "destructive" });
    }
  };

  const handleDeleteVendor = async (id: number) => {
    try {
      await deleteVendorMutation.mutateAsync(id);
      toast({ title: "Success", description: "Vendor deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete vendor", variant: "destructive" });
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim() || !newDisplayName.trim()) return;
    try {
      await createUserMutation.mutateAsync({
        username: newUsername,
        password: newPassword,
        displayName: newDisplayName,
        role: newUserRole,
        clientName: newUserClient || null,
        permissions: newUserPerms,
      });
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setNewUserRole("user");
      setNewUserClient("");
      setNewUserPerms(['expense', 'cashseal', 'inventory', 'menu']);
      toast({ title: "Success", description: "User account created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create user", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await deleteUserMutation.mutateAsync(id);
      toast({ title: "Success", description: "User deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete user", variant: "destructive" });
    }
  };

  const handleChangePin = async () => {
    if (newPin !== confirmPin) {
      toast({ title: "Error", description: "New PIN and confirmation do not match", variant: "destructive" });
      return;
    }
    if (newPin.length < 4) {
      toast({ title: "Error", description: "PIN must be at least 4 characters", variant: "destructive" });
      return;
    }
    try {
      await changePinMutation.mutateAsync({ currentPin, newPin });
      toast({ title: "Success", description: "Admin PIN changed successfully" });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to change PIN", variant: "destructive" });
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Admin Access</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">Enter your PIN to access admin settings</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="Enter PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className="text-center text-2xl tracking-[0.5em] h-12"
                maxLength={8}
                data-testid="input-admin-pin"
              />
              <Button 
                onClick={handlePinSubmit} 
                className="w-full" 
                disabled={verifyPinMutation.isPending || !pinInput}
                data-testid="button-verify-pin"
              >
                {verifyPinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                Unlock
              </Button>
              <p className="text-xs text-center text-muted-foreground">Default PIN: 1234</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Admin Panel</h2>
        <p className="text-muted-foreground mt-2">Manage vegetables and settings.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Change Admin PIN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 max-w-sm">
              <div>
                <label className="text-sm font-medium mb-1 block">Current PIN</label>
                <Input
                  type="password"
                  placeholder="Current PIN"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  data-testid="input-current-pin"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">New PIN</label>
                <Input
                  type="password"
                  placeholder="New PIN (min 4 chars)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  data-testid="input-new-pin"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Confirm New PIN</label>
                <Input
                  type="password"
                  placeholder="Confirm New PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  data-testid="input-confirm-pin"
                />
              </div>
              <Button onClick={handleChangePin} disabled={changePinMutation.isPending} data-testid="button-change-pin">
                {changePinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Change PIN
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Manage Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Input
                placeholder="New client name..."
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()}
                data-testid="input-new-client"
              />
              <Button onClick={handleCreateClient} disabled={createClientMutation.isPending} data-testid="button-add-client">
                {createClientMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Client
              </Button>
            </div>

            {clientsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Client Name</th>
                      <th className="px-4 py-3 text-right w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clients?.map((client) => (
                      <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          {editingClientId === client.id ? (
                            <Input
                              value={editingClientName}
                              onChange={(e) => setEditingClientName(e.target.value)}
                              className="h-8"
                              autoFocus
                            />
                          ) : (
                            client.name
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {editingClientId === client.id ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => handleUpdateClient(client.id)}
                                  data-testid={`button-save-client-${client.id}`}
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground"
                                  onClick={() => setEditingClientId(null)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingClientId(client.id);
                                    setEditingClientName(client.name);
                                  }}
                                  data-testid={`button-edit-client-${client.id}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteClient(client.id)}
                                  data-testid={`button-delete-client-${client.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Manage Vendors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Vendor name *"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  data-testid="input-new-vendor"
                />
                <Input
                  placeholder="Phone number"
                  value={newVendorPhone}
                  onChange={(e) => setNewVendorPhone(e.target.value)}
                  data-testid="input-new-vendor-phone"
                />
                <Input
                  placeholder="Address"
                  value={newVendorAddress}
                  onChange={(e) => setNewVendorAddress(e.target.value)}
                  data-testid="input-new-vendor-address"
                />
                <Input
                  placeholder="GST number"
                  value={newVendorGstNo}
                  onChange={(e) => setNewVendorGstNo(e.target.value)}
                  data-testid="input-new-vendor-gstno"
                />
              </div>
              <Button onClick={handleCreateVendor} disabled={createVendorMutation.isPending} data-testid="button-add-vendor" className="w-full sm:w-auto">
                {createVendorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Vendor
              </Button>
            </div>

            {vendorsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {vendorsList?.map((vendor) => (
                  <div key={vendor.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors" data-testid={`vendor-card-${vendor.id}`}>
                    {editingVendorId === vendor.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            value={editingVendorName}
                            onChange={(e) => setEditingVendorName(e.target.value)}
                            placeholder="Vendor name *"
                            className="h-9"
                            autoFocus
                            data-testid={`input-edit-vendor-name-${vendor.id}`}
                          />
                          <Input
                            value={editingVendorPhone}
                            onChange={(e) => setEditingVendorPhone(e.target.value)}
                            placeholder="Phone number"
                            className="h-9"
                            data-testid={`input-edit-vendor-phone-${vendor.id}`}
                          />
                          <Input
                            value={editingVendorAddress}
                            onChange={(e) => setEditingVendorAddress(e.target.value)}
                            placeholder="Address"
                            className="h-9"
                            data-testid={`input-edit-vendor-address-${vendor.id}`}
                          />
                          <Input
                            value={editingVendorGstNo}
                            onChange={(e) => setEditingVendorGstNo(e.target.value)}
                            placeholder="GST number"
                            className="h-9"
                            data-testid={`input-edit-vendor-gstno-${vendor.id}`}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="text-white bg-green-600 hover:bg-green-700"
                            onClick={() => handleUpdateVendor(vendor.id)}
                            data-testid={`button-save-vendor-${vendor.id}`}
                          >
                            <Save className="w-4 h-4 mr-1" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingVendorId(null)}
                          >
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-base" data-testid={`text-vendor-name-${vendor.id}`}>{vendor.name}</div>
                          <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                            {vendor.phone && <div>Phone: {vendor.phone}</div>}
                            {vendor.address && <div>Address: {vendor.address}</div>}
                            {vendor.gstNo && <div>GST: {vendor.gstNo}</div>}
                            {!vendor.phone && !vendor.address && !vendor.gstNo && <div className="italic">No details added</div>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingVendorId(vendor.id);
                              setEditingVendorName(vendor.name);
                              setEditingVendorPhone(vendor.phone || "");
                              setEditingVendorAddress(vendor.address || "");
                              setEditingVendorGstNo(vendor.gstNo || "");
                            }}
                            data-testid={`button-edit-vendor-${vendor.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteVendor(vendor.id)}
                            data-testid={`button-delete-vendor-${vendor.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {(!vendorsList || vendorsList.length === 0) && (
                  <div className="py-8 text-center text-muted-foreground italic border rounded-lg">
                    No vendors added yet
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {currentUser?.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                <Input
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  data-testid="input-new-username"
                />
                <Input
                  placeholder="Display Name"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  data-testid="input-new-displayname"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  data-testid="select-new-role"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newUserClient}
                  onChange={(e) => setNewUserClient(e.target.value)}
                  data-testid="select-new-client"
                >
                  <option value="">No Client</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Permissions</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserPerms.includes(key)}
                        onChange={() => togglePerm(key)}
                        className="rounded border-input"
                        data-testid={`checkbox-perm-${key}`}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreateUser} disabled={createUserMutation.isPending} data-testid="button-create-user">
                {createUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Create User
              </Button>

              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="hidden md:block border rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left">Username</th>
                          <th className="px-4 py-3 text-left">Display Name</th>
                          <th className="px-4 py-3 text-left">Role</th>
                          <th className="px-4 py-3 text-left">Client</th>
                          <th className="px-4 py-3 text-left">Permissions</th>
                          <th className="px-4 py-3 text-right w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {userList?.map((u) => (
                          <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{u.username}</td>
                            <td className="px-4 py-3">{u.displayName}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{u.clientName || '-'}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {(u.role === 'admin' ? Object.keys(permissionLabels) : (u.permissions || [])).map((p: string) => (
                                  <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                                    {permissionLabels[p] || p}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {u.username !== 'admin' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteUser(u.id)}
                                  disabled={deleteUserMutation.isPending}
                                  data-testid={`button-delete-user-${u.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {userList?.map((u) => (
                      <div key={u.id} className="border rounded-lg p-3 space-y-2" data-testid={`mobile-user-card-${u.id}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{u.displayName}</div>
                            <div className="text-sm text-muted-foreground">@{u.username}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {u.role}
                            </span>
                            {u.username !== 'admin' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={deleteUserMutation.isPending}
                                data-testid={`button-delete-user-mobile-${u.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {u.clientName && (
                          <div className="text-xs text-muted-foreground">
                            Client: <span className="font-medium text-foreground">{u.clientName}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {(u.role === 'admin' ? Object.keys(permissionLabels) : (u.permissions || [])).map((p: string) => (
                            <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                              {permissionLabels[p] || p}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Manage Vegetables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Input 
                placeholder="New vegetable name..." 
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                data-testid="input-new-vegetable"
              />
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-add-vegetable">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Item
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Item Name</th>
                      <th className="px-4 py-3 text-right w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vegetables?.map((veg) => (
                      <tr key={veg.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          {editingId === veg.id ? (
                            <Input 
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8"
                              autoFocus
                            />
                          ) : (
                            veg.name
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {editingId === veg.id ? (
                              <>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => handleUpdate(veg.id)}
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8 text-muted-foreground"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingId(veg.id);
                                    setEditingName(veg.name);
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDelete(veg.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
