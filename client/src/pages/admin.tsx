import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  useVegetableItems, 
  useCreateVegetableItem, 
  useUpdateVegetableItem, 
  useDeleteVegetableItem 
} from "@/hooks/use-reports";
import { Loader2, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const { data: vegetables, isLoading } = useVegetableItems();
  const createMutation = useCreateVegetableItem();
  const updateMutation = useUpdateVegetableItem();
  const deleteMutation = useDeleteVegetableItem();
  const { toast } = useToast();

  const [newItemName, setNewItemName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

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

  return (
    <Layout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Admin Panel</h2>
        <p className="text-muted-foreground mt-2">Manage the list of vegetables available for selection.</p>
      </div>

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
            />
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
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
    </Layout>
  );
}
