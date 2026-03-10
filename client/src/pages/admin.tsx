import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  useItemMaster,
  useCreateItemMasterItem,
  useUpdateItemMasterItem,
  useDeleteItemMasterItem,
  useVerifyAdminPin,
  useChangeAdminPin,
  useClientNames,
  useCreateClientName,
  useUpdateClientName,
  useDeleteClientName,
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useCurrentUser,
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
} from "@/hooks/use-reports";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, Save, X, Lock, KeyRound, Building2, Users, UserPlus, Store, Package, Search, Shield, ShieldCheck, ArrowLeft, Settings, Phone, MapPin, Crown, User, ShoppingCart, Coins, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const verifyPinMutation = useVerifyAdminPin();
  const [, navigate] = useLocation();

  const handlePinSubmit = async () => {
    const valid = await verifyPinMutation.mutateAsync(pinInput);
    if (valid) {
      setIsAuthenticated(true);
    } else {
      toast({ title: "Access Denied", description: "Incorrect PIN. Please try again.", variant: "destructive" });
      setPinInput("");
    }
  };

  const { data: itemMasterList, isLoading } = useItemMaster();
  const createMutation = useCreateItemMasterItem();
  const updateMutation = useUpdateItemMasterItem();
  const deleteMutation = useDeleteItemMasterItem();
  const changePinMutation = useChangeAdminPin();
  const { toast } = useToast();

  const UOM_OPTIONS = ["Kg", "Gm", "Ltr", "Ml", "Pcs", "Pkt", "Box", "Dz", "Nos", "Bag", "Tin", "Cyl", "Plats", "Cup", "Set"];
  const GST_RATES = ["0", "5", "12", "18", "28"];
  const ITEM_CATEGORIES = ["General", "Vegetable", "Fruit", "Grocery", "Spice & Masala", "Dry Fruit", "Sauce & Condiment", "Snack & Ready Food", "Non-Veg"];

  const [newItemName, setNewItemName] = useState("");
  const [newItemUom, setNewItemUom] = useState("Kg");
  const [newItemRate, setNewItemRate] = useState("0");
  const [newItemHsn, setNewItemHsn] = useState("");
  const [newItemGst, setNewItemGst] = useState("0");
  const [newItemType, setNewItemType] = useState("purchase");
  const [newItemCategory, setNewItemCategory] = useState("General");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingUom, setEditingUom] = useState("Kg");
  const [editingRate, setEditingRate] = useState("0");
  const [editingHsn, setEditingHsn] = useState("");
  const [editingGst, setEditingGst] = useState("0");
  const [editingType, setEditingType] = useState("purchase");
  const [editingCategory, setEditingCategory] = useState("General");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState("all");
  const [itemCategoryFilter, setItemCategoryFilter] = useState("all");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const { data: clients, isLoading: clientsLoading } = useClientNames();
  const createClientMutation = useCreateClientName();
  const updateClientMutation = useUpdateClientName();
  const deleteClientMutation = useDeleteClientName();
  const [newClientName, setNewClientName] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientGst, setNewClientGst] = useState("");
  const [newClientAgreement, setNewClientAgreement] = useState("");
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [editingClientName, setEditingClientName] = useState("");
  const [editingClientAddress, setEditingClientAddress] = useState("");
  const [editingClientGst, setEditingClientGst] = useState("");
  const [editingClientAgreement, setEditingClientAgreement] = useState("");

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
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const [userCreateType, setUserCreateType] = useState<'work' | 'employee'>('work');
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [newUserClient, setNewUserClient] = useState("");
  const [newUserPerms, setNewUserPerms] = useState<string[]>(['expense', 'cashseal', 'inventory', 'menu', 'purchase']);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [empUserPerms, setEmpUserPerms] = useState<string[]>([]);
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [empListLoading, setEmpListLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserDisplayName, setEditUserDisplayName] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserRole, setEditUserRole] = useState("user");
  const [editUserClient, setEditUserClient] = useState("");
  const [editUserPerms, setEditUserPerms] = useState<string[]>([]);

  const permissionLabels: Record<string, string> = {
    expense: 'Daily Cash Expance',
    cashseal: 'Daily Cash Seal',
    inventory: 'Daily Inventory',
    menu: 'Menu Manager',
    purchase: 'Purchase Request',
    labour: 'Labour Works',
  };

  const togglePerm = (perm: string) => {
    setNewUserPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const handleCreate = async () => {
    if (!newItemName.trim()) return;
    try {
      await createMutation.mutateAsync({ 
        itemName: newItemName.trim(), 
        uom: newItemUom, 
        rate: newItemRate, 
        hsnCode: newItemHsn, 
        gstPercent: newItemGst, 
        itemType: newItemType,
        itemCategory: newItemCategory 
      });
      setNewItemName("");
      setNewItemUom("Kg");
      setNewItemRate("0");
      setNewItemHsn("");
      setNewItemGst("0");
      setNewItemType("purchase");
      setNewItemCategory("General");
      toast({ title: "Success", description: "Item added to Item Master" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to add item", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editingName.trim()) return;
    try {
      await updateMutation.mutateAsync({ 
        id, 
        itemName: editingName.trim(), 
        uom: editingUom, 
        rate: editingRate, 
        hsnCode: editingHsn, 
        gstPercent: editingGst, 
        itemType: editingType,
        itemCategory: editingCategory 
      });
      setEditingId(null);
      toast({ title: "Success", description: "Item updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update item", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Success", description: "Item deleted" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const filteredItems = (itemMasterList || []).filter((item: any) => {
    const matchesSearch = !itemSearchQuery || item.itemName.toLowerCase().includes(itemSearchQuery.toLowerCase());
    const matchesType = itemTypeFilter === "all" || item.itemType === itemTypeFilter;
    const matchesCategory = itemCategoryFilter === "all" || item.itemCategory === itemCategoryFilter;
    return matchesSearch && matchesType && matchesCategory;
  });

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      await createClientMutation.mutateAsync({
        name: newClientName,
        address: newClientAddress,
        gstNo: newClientGst,
        agreementValidTill: newClientAgreement || null,
      });
      setNewClientName("");
      setNewClientAddress("");
      setNewClientGst("");
      setNewClientAgreement("");
      toast({ title: "Success", description: "Client added" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to add client", variant: "destructive" });
    }
  };

  const handleUpdateClient = async (id: number) => {
    if (!editingClientName.trim()) return;
    try {
      await updateClientMutation.mutateAsync({
        id,
        name: editingClientName,
        address: editingClientAddress,
        gstNo: editingClientGst,
        agreementValidTill: editingClientAgreement || null,
      });
      setEditingClientId(null);
      toast({ title: "Success", description: "Client updated" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to update client", variant: "destructive" });
    }
  };

  const startEditingClient = (client: any) => {
    setEditingClientId(client.id);
    setEditingClientName(client.name);
    setEditingClientAddress(client.address || "");
    setEditingClientGst(client.gstNo || "");
    setEditingClientAgreement(client.agreementValidTill || "");
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

  const loadEmployees = async () => {
    setEmpListLoading(true);
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      const data = await res.json();
      const existingEmpIds = (userList || []).map((u: any) => u.employeeId).filter(Boolean);
      setEmployeeList((data || []).filter((e: any) => e.isActive && !existingEmpIds.includes(e.id)));
    } catch { setEmployeeList([]); }
    setEmpListLoading(false);
  };

  const handleCreateEmployeeUser = async () => {
    if (!selectedEmployeeId) return;
    const emp = employeeList.find((e: any) => e.id === selectedEmployeeId);
    if (!emp) return;
    const mobile = emp.mobile || emp.phone || '';
    if (!mobile || mobile.length < 4) {
      toast({ title: "Error", description: "Employee has no valid mobile number", variant: "destructive" });
      return;
    }
    const namePart = (emp.name || '').slice(0, 3).toLowerCase();
    const mobilePart = mobile.slice(-4);
    const username = mobile;
    const password = `${namePart}@${mobilePart}`;
    try {
      await createUserMutation.mutateAsync({
        username,
        password,
        displayName: emp.name,
        role: 'employee',
        clientName: emp.clientName || null,
        permissions: empUserPerms,
        employeeId: emp.id,
      });
      setSelectedEmployeeId(null);
      setEmpUserPerms([]);
      toast({ title: "Success", description: `Employee user created. Username: ${username}, Password: ${password}` });
      loadEmployees();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create employee user", variant: "destructive" });
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

  const startEditUser = (u: any) => {
    setEditingUserId(u.id);
    setEditUserDisplayName(u.displayName || "");
    setEditUserPassword("");
    setEditUserRole(u.role || "user");
    setEditUserClient(u.clientName || "");
    setEditUserPerms(u.role === 'admin' ? Object.keys(permissionLabels) : (u.permissions || []));
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setEditUserDisplayName("");
    setEditUserPassword("");
    setEditUserRole("user");
    setEditUserClient("");
    setEditUserPerms([]);
  };

  const handleUpdateUser = async () => {
    if (!editingUserId || !editUserDisplayName.trim()) return;
    try {
      const data: any = {
        displayName: editUserDisplayName.trim(),
        role: editUserRole,
        clientName: editUserClient || null,
        permissions: editUserPerms,
      };
      if (editUserPassword.trim()) data.password = editUserPassword.trim();
      await updateUserMutation.mutateAsync({ id: editingUserId, data });
      cancelEditUser();
      toast({ title: "Success", description: "User updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update user", variant: "destructive" });
    }
  };

  const toggleEditPerm = (key: string) => {
    setEditUserPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
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

  const purchaseCount = (itemMasterList || []).filter((i: any) => i.itemType === 'purchase').length;
  const salesCount = (itemMasterList || []).filter((i: any) => i.itemType === 'sales').length;
  const bothCount = (itemMasterList || []).filter((i: any) => i.itemType === 'both').length;

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-sm border-0 shadow-2xl overflow-hidden">
            <CardHeader className="text-center bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white pb-6 pt-8">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 ring-2 ring-white/20">
                <Shield className="w-10 h-10 text-amber-400" />
              </div>
              <CardTitle className="text-xl font-bold">Admin Access</CardTitle>
              <p className="text-sm text-white/60 mt-2">Enter your PIN to access admin settings</p>
            </CardHeader>
            <CardContent className="space-y-4 p-6 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/20">
              <Input
                type="password"
                placeholder="Enter PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className="text-center text-2xl tracking-[0.5em] h-14 border-slate-300 dark:border-slate-700"
                maxLength={8}
                data-testid="input-admin-pin"
              />
              <Button 
                onClick={handlePinSubmit} 
                className="w-full h-12 text-base bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 border-0 shadow-lg" 
                disabled={verifyPinMutation.isPending || !pinInput}
                data-testid="button-verify-pin"
              >
                {verifyPinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Lock className="w-5 h-5 mr-2" />}
                Unlock Admin Panel
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
      <div className="space-y-6 pb-32 sm:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")} type="button" className="shrink-0 rounded-xl border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/30" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent" data-testid="text-admin-title">
                Admin Panel
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Manage items, clients, vendors & users</p>
            </div>
          </div>
          <div className="ml-12 sm:ml-0">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-semibold">Authenticated</span>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-change-pin">
          <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="w-5 h-5 text-amber-300" />
              Change Admin PIN
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/20">
            <div className="grid gap-4 max-w-sm">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wide">Current PIN</label>
                <Input
                  type="password"
                  placeholder="Current PIN"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  className="border-slate-300 dark:border-slate-700"
                  data-testid="input-current-pin"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wide">New PIN</label>
                <Input
                  type="password"
                  placeholder="New PIN (min 4 chars)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="border-slate-300 dark:border-slate-700"
                  data-testid="input-new-pin"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wide">Confirm New PIN</label>
                <Input
                  type="password"
                  placeholder="Confirm New PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="border-slate-300 dark:border-slate-700"
                  data-testid="input-confirm-pin"
                />
              </div>
              <Button onClick={handleChangePin} disabled={changePinMutation.isPending} className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 border-0 shadow-md" data-testid="button-change-pin">
                {changePinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Change PIN
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-manage-clients">
          <CardHeader className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Building2 className="w-5 h-5" />
              Manage Clients
              {clients && <span className="ml-auto text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{clients.length}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="space-y-3 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
              <div className="text-xs font-semibold text-teal-600 dark:text-teal-400">Add New Client</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Client Name *" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="border-teal-200 dark:border-teal-800" data-testid="input-new-client" />
                <Input placeholder="GST No" value={newClientGst} onChange={(e) => setNewClientGst(e.target.value)} className="border-teal-200 dark:border-teal-800" data-testid="input-new-client-gst" />
              </div>
              <Input placeholder="Address" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} className="border-teal-200 dark:border-teal-800" data-testid="input-new-client-address" />
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Agreement Valid Till</Label>
                  <Input type="date" value={newClientAgreement} onChange={(e) => setNewClientAgreement(e.target.value)} className="border-teal-200 dark:border-teal-800" data-testid="input-new-client-agreement" />
                </div>
                <Button onClick={handleCreateClient} disabled={createClientMutation.isPending} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 border-0 shadow-md shrink-0" data-testid="button-add-client">
                  {createClientMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  Add
                </Button>
              </div>
            </div>

            {clientsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {clients?.map((client: any, idx: number) => (
                  <div key={client.id} className="border border-teal-200 dark:border-teal-800/50 rounded-lg p-3 hover:bg-teal-50/50 dark:hover:bg-teal-950/10 transition-colors">
                    {editingClientId === client.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input value={editingClientName} onChange={(e) => setEditingClientName(e.target.value)} placeholder="Client Name *" className="border-teal-300" autoFocus data-testid={`input-edit-client-name-${client.id}`} />
                          <Input value={editingClientGst} onChange={(e) => setEditingClientGst(e.target.value)} placeholder="GST No" className="border-teal-300" data-testid={`input-edit-client-gst-${client.id}`} />
                        </div>
                        <Input value={editingClientAddress} onChange={(e) => setEditingClientAddress(e.target.value)} placeholder="Address" className="border-teal-300" data-testid={`input-edit-client-address-${client.id}`} />
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Agreement Valid Till</Label>
                            <Input type="date" value={editingClientAgreement} onChange={(e) => setEditingClientAgreement(e.target.value)} className="border-teal-300" data-testid={`input-edit-client-agreement-${client.id}`} />
                          </div>
                          <Button size="sm" variant="ghost" className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => handleUpdateClient(client.id)} data-testid={`button-save-client-${client.id}`}>
                            <Save className="w-4 h-4 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setEditingClientId(null)}>
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 text-white text-[10px] inline-flex items-center justify-center font-bold shrink-0 mt-0.5">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold">{client.name}</div>
                          {client.address && <div className="text-xs text-muted-foreground mt-0.5">{client.address}</div>}
                          <div className="flex flex-wrap gap-3 mt-1">
                            {client.gstNo && <span className="text-xs text-muted-foreground">GST: <span className="font-mono">{client.gstNo}</span></span>}
                            {client.agreementValidTill && (
                              <span className={`text-xs ${new Date(client.agreementValidTill) < new Date() ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                Agreement: {(() => { const dt = new Date(client.agreementValidTill); const dd = String(dt.getDate()).padStart(2, "0"); const mm = String(dt.getMonth() + 1).padStart(2, "0"); return `${dd}-${mm}-${dt.getFullYear()}`; })()}
                                {new Date(client.agreementValidTill) < new Date() && ' (Expired)'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20" onClick={() => startEditingClient(client)} data-testid={`button-edit-client-${client.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClient(client.id)} data-testid={`button-delete-client-${client.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-manage-vendors">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Store className="w-5 h-5" />
              Manage Vendors
              {vendorsList && <span className="ml-auto text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{vendorsList.length}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Vendor name *"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  className="border-orange-200 dark:border-orange-800 focus-visible:ring-orange-400"
                  data-testid="input-new-vendor"
                />
                <Input
                  placeholder="Phone number"
                  value={newVendorPhone}
                  onChange={(e) => setNewVendorPhone(e.target.value)}
                  className="border-orange-200 dark:border-orange-800 focus-visible:ring-orange-400"
                  data-testid="input-new-vendor-phone"
                />
                <Input
                  placeholder="Address"
                  value={newVendorAddress}
                  onChange={(e) => setNewVendorAddress(e.target.value)}
                  className="border-orange-200 dark:border-orange-800 focus-visible:ring-orange-400"
                  data-testid="input-new-vendor-address"
                />
                <Input
                  placeholder="GST number"
                  value={newVendorGstNo}
                  onChange={(e) => setNewVendorGstNo(e.target.value)}
                  className="border-orange-200 dark:border-orange-800 focus-visible:ring-orange-400"
                  data-testid="input-new-vendor-gstno"
                />
              </div>
              <Button onClick={handleCreateVendor} disabled={createVendorMutation.isPending} className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border-0 shadow-md" data-testid="button-add-vendor">
                {createVendorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Vendor
              </Button>
            </div>

            {vendorsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {vendorsList?.map((vendor, idx) => (
                  <div key={vendor.id} className="border border-orange-200 dark:border-orange-800/50 rounded-xl p-4 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors" data-testid={`vendor-card-${vendor.id}`}>
                    {editingVendorId === vendor.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            value={editingVendorName}
                            onChange={(e) => setEditingVendorName(e.target.value)}
                            placeholder="Vendor name *"
                            className="h-9 border-orange-300"
                            autoFocus
                            data-testid={`input-edit-vendor-name-${vendor.id}`}
                          />
                          <Input
                            value={editingVendorPhone}
                            onChange={(e) => setEditingVendorPhone(e.target.value)}
                            placeholder="Phone number"
                            className="h-9 border-orange-300"
                            data-testid={`input-edit-vendor-phone-${vendor.id}`}
                          />
                          <Input
                            value={editingVendorAddress}
                            onChange={(e) => setEditingVendorAddress(e.target.value)}
                            placeholder="Address"
                            className="h-9 border-orange-300"
                            data-testid={`input-edit-vendor-address-${vendor.id}`}
                          />
                          <Input
                            value={editingVendorGstNo}
                            onChange={(e) => setEditingVendorGstNo(e.target.value)}
                            placeholder="GST number"
                            className="h-9 border-orange-300"
                            data-testid={`input-edit-vendor-gstno-${vendor.id}`}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 border-0 text-white"
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
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-[11px] flex items-center justify-center font-bold shrink-0 mt-0.5">{idx + 1}</span>
                          <div className="min-w-0">
                            <div className="font-semibold text-base" data-testid={`text-vendor-name-${vendor.id}`}>{vendor.name}</div>
                            <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                              {vendor.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-orange-400" /> {vendor.phone}</div>}
                              {vendor.address && <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-orange-400" /> {vendor.address}</div>}
                              {vendor.gstNo && <div className="flex items-center gap-1"><span className="text-xs font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">GST: {vendor.gstNo}</span></div>}
                              {!vendor.phone && !vendor.address && !vendor.gstNo && <div className="italic text-xs">No details added</div>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
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
                  <div className="py-8 text-center text-muted-foreground italic border border-dashed border-orange-300 dark:border-orange-800 rounded-xl">
                    No vendors added yet
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {currentUser?.role === 'admin' && (
          <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-user-management">
            <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-500 text-white pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="w-5 h-5" />
                User Management
                {userList && <span className="ml-auto text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{userList.length}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200 dark:border-violet-800/50 space-y-3">
                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Create New User</p>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setUserCreateType('work')}
                    data-testid="button-work-user-tab"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      userCreateType === 'work'
                        ? 'bg-violet-500 text-white shadow-md'
                        : 'bg-white dark:bg-gray-800 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30'
                    }`}
                  >
                    <User className="w-4 h-4 inline mr-1.5" />
                    Work User
                  </button>
                  <button
                    onClick={() => { setUserCreateType('employee'); loadEmployees(); }}
                    data-testid="button-employee-user-tab"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      userCreateType === 'employee'
                        ? 'bg-violet-500 text-white shadow-md'
                        : 'bg-white dark:bg-gray-800 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30'
                    }`}
                  >
                    <Users className="w-4 h-4 inline mr-1.5" />
                    Employee User
                  </button>
                </div>

                {userCreateType === 'work' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                      <Input
                        placeholder="Username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="border-violet-200 dark:border-violet-800 focus-visible:ring-violet-400"
                        data-testid="input-new-username"
                      />
                      <Input
                        placeholder="Display Name"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="border-violet-200 dark:border-violet-800 focus-visible:ring-violet-400"
                        data-testid="input-new-displayname"
                      />
                      <Input
                        type="password"
                        placeholder="Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="border-violet-200 dark:border-violet-800 focus-visible:ring-violet-400"
                        data-testid="input-new-password"
                      />
                      <select
                        className="flex h-10 w-full rounded-md border border-violet-200 dark:border-violet-800 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        data-testid="select-new-role"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <select
                        className="flex h-10 w-full rounded-md border border-violet-200 dark:border-violet-800 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
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
                      <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">Permissions</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(permissionLabels).map(([key, label]) => (
                          <label key={key} className={`flex items-center gap-2 text-xs cursor-pointer px-3 py-1.5 rounded-full border transition-colors ${
                            newUserPerms.includes(key) 
                              ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 dark:border-violet-600 text-violet-700 dark:text-violet-300 font-semibold' 
                              : 'bg-background border-border text-muted-foreground hover:bg-violet-50 dark:hover:bg-violet-950/20'
                          }`}>
                            <input
                              type="checkbox"
                              checked={newUserPerms.includes(key)}
                              onChange={() => togglePerm(key)}
                              className="rounded border-input sr-only"
                              data-testid={`checkbox-perm-${key}`}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleCreateUser} disabled={createUserMutation.isPending} className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 border-0 shadow-md" data-testid="button-create-user">
                      {createUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                      Create Work User
                    </Button>
                  </>
                )}

                {userCreateType === 'employee' && (
                  <>
                    <p className="text-xs text-muted-foreground">Select an employee from Employee Master. Login will be auto-generated: Username = Mobile Number, Password = first 3 letters of name + @ + last 4 digits of mobile.</p>
                    {empListLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
                    ) : employeeList.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No employees available (all already have user accounts or none found).</p>
                    ) : (
                      <>
                        <select
                          className="flex h-10 w-full rounded-md border border-violet-200 dark:border-violet-800 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                          value={selectedEmployeeId || ''}
                          onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
                          data-testid="select-employee-user"
                        >
                          <option value="">Select Employee...</option>
                          {employeeList.map((emp: any) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} — {emp.clientName || 'No Client'} — {emp.mobile || 'No Mobile'}
                            </option>
                          ))}
                        </select>
                        {selectedEmployeeId && (() => {
                          const emp = employeeList.find((e: any) => e.id === selectedEmployeeId);
                          if (!emp) return null;
                          const mobile = emp.mobile || '';
                          const namePart = (emp.name || '').slice(0, 3).toLowerCase();
                          const mobilePart = mobile.slice(-4);
                          return (
                            <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-violet-200 dark:border-violet-700 text-sm space-y-1">
                              <p><span className="font-semibold text-violet-600 dark:text-violet-400">Name:</span> {emp.name}</p>
                              <p><span className="font-semibold text-violet-600 dark:text-violet-400">Client:</span> {emp.clientName || '—'}</p>
                              <p><span className="font-semibold text-violet-600 dark:text-violet-400">Username:</span> {mobile || 'No mobile!'}</p>
                              <p><span className="font-semibold text-violet-600 dark:text-violet-400">Password:</span> {mobile ? `${namePart}@${mobilePart}` : 'N/A'}</p>
                            </div>
                          );
                        })()}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">Permissions</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(permissionLabels).map(([key, label]) => (
                              <label key={key} className={`flex items-center gap-2 text-xs cursor-pointer px-3 py-1.5 rounded-full border transition-colors ${
                                empUserPerms.includes(key) 
                                  ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 dark:border-violet-600 text-violet-700 dark:text-violet-300 font-semibold' 
                                  : 'bg-background border-border text-muted-foreground hover:bg-violet-50 dark:hover:bg-violet-950/20'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={empUserPerms.includes(key)}
                                  onChange={() => setEmpUserPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])}
                                  className="rounded border-input sr-only"
                                  data-testid={`checkbox-emp-perm-${key}`}
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <Button onClick={handleCreateEmployeeUser} disabled={createUserMutation.isPending || !selectedEmployeeId} className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 border-0 shadow-md" data-testid="button-create-employee-user">
                          {createUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                          Create Employee User
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>

              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                </div>
              ) : (
                <>
                  <div className="hidden md:block border border-violet-200 dark:border-violet-800/50 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-violet-50 dark:bg-violet-950/20 border-b border-violet-200 dark:border-violet-800/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">#</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">Username</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">Display Name</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">Role</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">Client</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-violet-700 dark:text-violet-400">Permissions</th>
                          <th className="px-3 py-2.5 text-right w-20 text-xs font-semibold text-violet-700 dark:text-violet-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userList?.map((u, idx) => (
                          editingUserId === u.id ? (
                            <tr key={u.id} className="bg-violet-50 dark:bg-violet-950/20">
                              <td className="px-3 py-2">
                                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{idx + 1}</span>
                              </td>
                              <td className="px-3 py-2 font-semibold font-mono text-sm">{u.username}</td>
                              <td className="px-3 py-2">
                                <Input value={editUserDisplayName} onChange={(e) => setEditUserDisplayName(e.target.value)} className="h-8 text-sm" data-testid="input-edit-displayname" />
                              </td>
                              <td className="px-3 py-2">
                                <select className="flex h-8 w-full rounded-md border bg-background px-2 py-1 text-xs" value={editUserRole} onChange={(e) => setEditUserRole(e.target.value)} data-testid="select-edit-role">
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
                                  <option value="employee">Employee</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <select className="flex h-8 w-full rounded-md border bg-background px-2 py-1 text-xs" value={editUserClient} onChange={(e) => setEditUserClient(e.target.value)} data-testid="select-edit-client">
                                  <option value="">No Client</option>
                                  {clients?.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
                                </select>
                              </td>
                              <td className="px-3 py-2" colSpan={2}>
                                <div className="space-y-2">
                                  <Input placeholder="New password (leave blank to keep)" value={editUserPassword} onChange={(e) => setEditUserPassword(e.target.value)} type="password" className="h-8 text-sm" data-testid="input-edit-password" />
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(permissionLabels).map(([key, label]) => (
                                      <label key={key} className={`flex items-center gap-1 text-[10px] cursor-pointer px-2 py-1 rounded-full border transition-colors ${
                                        editUserPerms.includes(key)
                                          ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 text-violet-700 font-semibold'
                                          : 'bg-background border-border text-muted-foreground'
                                      }`}>
                                        <input type="checkbox" checked={editUserPerms.includes(key)} onChange={() => toggleEditPerm(key)} className="sr-only" />
                                        {label}
                                      </label>
                                    ))}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={handleUpdateUser} disabled={updateUserMutation.isPending} data-testid="button-save-user">
                                      {updateUserMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />} Save
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={cancelEditUser} data-testid="button-cancel-edit-user">
                                      <X className="w-3 h-3 mr-1" /> Cancel
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                          <tr key={u.id} className="border-b last:border-0 hover:bg-violet-50/50 dark:hover:bg-violet-950/10 transition-colors">
                            <td className="px-3 py-2.5">
                              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{idx + 1}</span>
                            </td>
                            <td className="px-3 py-2.5 font-semibold font-mono text-sm">{u.username}</td>
                            <td className="px-3 py-2.5">{u.displayName}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                u.role === 'admin' 
                                  ? 'bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 text-amber-700 dark:text-amber-400' 
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              }`}>
                                {u.role === 'admin' ? <><Crown className="w-3 h-3 inline mr-0.5" /> Admin</> : u.role === 'employee' ? <><Users className="w-3 h-3 inline mr-0.5" /> Employee</> : <><User className="w-3 h-3 inline mr-0.5" /> User</>}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground text-xs">{u.clientName || '—'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {(u.role === 'admin' ? Object.keys(permissionLabels) : (u.permissions || [])).map((p: string) => (
                                  <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-medium">
                                    {permissionLabels[p] || p}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {u.username !== 'admin' && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => startEditUser(u)}
                                    data-testid={`button-edit-user-${u.id}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
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
                                </div>
                              )}
                            </td>
                          </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {userList?.map((u, idx) => (
                      <div key={u.id} className="border border-violet-200 dark:border-violet-800/50 rounded-xl p-3 space-y-2 hover:bg-violet-50/50 dark:hover:bg-violet-950/10" data-testid={`mobile-user-card-${u.id}`}>
                        {editingUserId === u.id ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white text-[11px] flex items-center justify-center font-bold">{idx + 1}</span>
                              <div className="text-xs text-muted-foreground font-mono">@{u.username}</div>
                            </div>
                            <Input placeholder="Display Name" value={editUserDisplayName} onChange={(e) => setEditUserDisplayName(e.target.value)} className="h-9 text-sm" data-testid="input-edit-displayname-mobile" />
                            <Input placeholder="New password (leave blank to keep)" value={editUserPassword} onChange={(e) => setEditUserPassword(e.target.value)} type="password" className="h-9 text-sm" data-testid="input-edit-password-mobile" />
                            <div className="grid grid-cols-2 gap-2">
                              <select className="flex h-9 w-full rounded-md border bg-background px-2 py-1 text-sm" value={editUserRole} onChange={(e) => setEditUserRole(e.target.value)}>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                              <select className="flex h-9 w-full rounded-md border bg-background px-2 py-1 text-sm" value={editUserClient} onChange={(e) => setEditUserClient(e.target.value)}>
                                <option value="">No Client</option>
                                {clients?.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
                              </select>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(permissionLabels).map(([key, label]) => (
                                <label key={key} className={`flex items-center gap-1 text-[10px] cursor-pointer px-2 py-1 rounded-full border transition-colors ${
                                  editUserPerms.includes(key)
                                    ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 text-violet-700 font-semibold'
                                    : 'bg-background border-border text-muted-foreground'
                                }`}>
                                  <input type="checkbox" checked={editUserPerms.includes(key)} onChange={() => toggleEditPerm(key)} className="sr-only" />
                                  {label}
                                </label>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 flex-1" onClick={handleUpdateUser} disabled={updateUserMutation.isPending} data-testid="button-save-user-mobile">
                                {updateUserMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />} Save
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={cancelEditUser} data-testid="button-cancel-edit-user-mobile">
                                <X className="w-3 h-3 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                        <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white text-[11px] flex items-center justify-center font-bold">{idx + 1}</span>
                            <div>
                              <div className="font-semibold">{u.displayName}</div>
                              <div className="text-xs text-muted-foreground font-mono">@{u.username}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              u.role === 'admin' 
                                ? 'bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 text-amber-700 dark:text-amber-400' 
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            }`}>
                              {u.role === 'admin' ? <Crown className="w-3 h-3 inline mr-0.5" /> : u.role === 'employee' ? <Users className="w-3 h-3 inline mr-0.5" /> : <User className="w-3 h-3 inline mr-0.5" />} {u.role}
                            </span>
                            {u.username !== 'admin' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => startEditUser(u)}
                                  data-testid={`button-edit-user-mobile-${u.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
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
                              </>
                            )}
                          </div>
                        </div>
                        {u.clientName && (
                          <div className="text-xs text-muted-foreground">
                            Client: <span className="font-semibold text-foreground">{u.clientName}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {(u.role === 'admin' ? Object.keys(permissionLabels) : (u.permissions || [])).map((p: string) => (
                            <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-medium">
                              {permissionLabels[p] || p}
                            </span>
                          ))}
                        </div>
                        </>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-lg overflow-hidden" data-testid="card-item-master">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Package className="w-5 h-5" />
              Item Master
              {itemMasterList && <span className="ml-auto text-sm font-normal bg-white/20 px-2.5 py-0.5 rounded-full">{itemMasterList.length}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/50 space-y-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Add New Item</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                <Input 
                  placeholder="Item Name" 
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="col-span-2 sm:col-span-1 border-blue-200 dark:border-blue-800 focus-visible:ring-blue-400"
                  data-testid="input-new-item-name"
                />
                <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                  <SelectTrigger className="border-blue-200 dark:border-blue-800" data-testid="select-new-item-category"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {ITEM_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newItemUom} onValueChange={setNewItemUom}>
                  <SelectTrigger className="border-blue-200 dark:border-blue-800" data-testid="select-new-item-uom"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="Rate" 
                  value={newItemRate}
                  onChange={(e) => setNewItemRate(e.target.value)}
                  inputMode="decimal"
                  className="border-blue-200 dark:border-blue-800 focus-visible:ring-blue-400"
                  data-testid="input-new-item-rate"
                />
                <Input 
                  placeholder="HSN Code" 
                  value={newItemHsn}
                  onChange={(e) => setNewItemHsn(e.target.value)}
                  className="border-blue-200 dark:border-blue-800 focus-visible:ring-blue-400"
                  data-testid="input-new-item-hsn"
                />
                <Select value={newItemGst} onValueChange={setNewItemGst}>
                  <SelectTrigger className="border-blue-200 dark:border-blue-800" data-testid="select-new-item-gst"><SelectValue placeholder="GST %" /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map(g => <SelectItem key={g} value={g}>{g}%</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newItemType} onValueChange={setNewItemType}>
                  <SelectTrigger className="border-blue-200 dark:border-blue-800" data-testid="select-new-item-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 border-0 shadow-md" data-testid="button-add-item">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  Add
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <Input 
                  placeholder="Search items..." 
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="pl-9 border-blue-200 dark:border-blue-800 focus-visible:ring-blue-400"
                  data-testid="input-search-items"
                />
              </div>
              <Select value={itemCategoryFilter} onValueChange={setItemCategoryFilter}>
                <SelectTrigger className="w-full sm:w-44 border-blue-200 dark:border-blue-800" data-testid="select-filter-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {ITEM_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                <SelectTrigger className="w-full sm:w-40 border-blue-200 dark:border-blue-800" data-testid="select-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="border border-blue-200 dark:border-blue-800/50 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800/50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-700 dark:text-blue-400">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-700 dark:text-blue-400">Item Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-700 dark:text-blue-400">Category</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-700 dark:text-blue-400">UOM</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-blue-700 dark:text-blue-400">Rate</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-700 dark:text-blue-400">HSN</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-blue-700 dark:text-blue-400">GST%</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-700 dark:text-blue-400">Type</th>
                      <th className="px-3 py-2.5 text-right w-24 text-xs font-semibold text-blue-700 dark:text-blue-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item: any, idx: number) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/10 transition-colors">
                        <td className="px-3 py-2">
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-[10px] inline-flex items-center justify-center font-bold">{idx + 1}</span>
                        </td>
                        <td className="px-3 py-2">
                          {editingId === item.id ? (
                            <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-7 text-sm border-blue-300" autoFocus />
                          ) : (
                            <span className="font-semibold">{item.itemName}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingId === item.id ? (
                            <Select value={editingCategory} onValueChange={setEditingCategory}>
                              <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>{ITEM_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              item.itemCategory === 'Vegetable' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              item.itemCategory === 'Fruit' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              item.itemCategory === 'Grocery' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              item.itemCategory === 'Spice & Masala' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              item.itemCategory === 'Dry Fruit' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              item.itemCategory === 'Non-Veg' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                              'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
                            }`}>{item.itemCategory}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingId === item.id ? (
                            <Select value={editingUom} onValueChange={setEditingUom}>
                              <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold">{item.uom}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editingId === item.id ? (
                            <Input value={editingRate} onChange={(e) => setEditingRate(e.target.value)} className="h-7 text-sm text-right w-20 border-blue-300" inputMode="decimal" />
                          ) : (
                            <span className="font-mono text-sm">{Number(item.rate).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingId === item.id ? (
                            <Input value={editingHsn} onChange={(e) => setEditingHsn(e.target.value)} className="h-7 text-sm w-24 border-blue-300" />
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">{item.hsnCode || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editingId === item.id ? (
                            <Select value={editingGst} onValueChange={setEditingGst}>
                              <SelectTrigger className="h-7 text-sm w-16"><SelectValue /></SelectTrigger>
                              <SelectContent>{GST_RATES.map(g => <SelectItem key={g} value={g}>{g}%</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <span className="font-mono text-sm">{Number(item.gstPercent)}%</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {editingId === item.id ? (
                            <Select value={editingType} onValueChange={setEditingType}>
                              <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="purchase">Purchase</SelectItem>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              item.itemType === 'purchase' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              item.itemType === 'sales' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            }`}>
                              {item.itemType === 'purchase' ? <><ShoppingCart className="w-3 h-3 inline mr-0.5" /> Purchase</> : item.itemType === 'sales' ? <><Coins className="w-3 h-3 inline mr-0.5" /> Sales</> : <><RefreshCw className="w-3 h-3 inline mr-0.5" /> Both</>}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {editingId === item.id ? (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => handleUpdate(item.id)}>
                                  <Save className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)}>
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => {
                                  setEditingId(item.id);
                                  setEditingName(item.itemName);
                                  setEditingUom(item.uom);
                                  setEditingRate(String(item.rate));
                                  setEditingHsn(item.hsnCode || "");
                                  setEditingGst(String(Number(item.gstPercent)));
                                  setEditingType(item.itemType);
                                  setEditingCategory(item.itemCategory || "General");
                                }}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(item.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 border-t border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/10 font-semibold">
                  {filteredItems.length} items {itemSearchQuery || itemTypeFilter !== 'all' ? '(filtered)' : 'total'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 sm:static bg-background/80 backdrop-blur-md sm:bg-transparent border-t sm:border-0 p-3 sm:p-0 z-10">
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-2 sm:grid-cols-4">
                <div className="p-3 sm:p-5 bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Clients
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-clients">{clients?.length || 0}</p>
                </div>
                <div className="p-3 sm:p-5 bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <Store className="w-3 h-3" /> Vendors
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-vendors">{vendorsList?.length || 0}</p>
                </div>
                <div className="p-3 sm:p-5 bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Users
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-users">{userList?.length || 0}</p>
                </div>
                <div className="p-3 sm:p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-white/80 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Items
                  </p>
                  <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-summary-items">{itemMasterList?.length || 0}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">P:{purchaseCount} S:{salesCount} B:{bothCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
