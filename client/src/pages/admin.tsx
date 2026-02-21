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
  useChangeAdminPin
} from "@/hooks/use-reports";
import { Loader2, Plus, Pencil, Trash2, Save, X, Lock, KeyRound } from "lucide-react";
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
