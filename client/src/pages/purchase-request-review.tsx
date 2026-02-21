import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { usePurchaseRequest, useUpdatePurchaseRequest, useCurrentUser } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Check, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReviewItem {
  id?: number;
  itemName: string;
  uom: string;
  requestQty: number;
  approveQty: number;
  approved: boolean;
}

export default function PurchaseRequestReview() {
  const [, params] = useRoute("/purchase-request/:id/review");
  const id = params?.id ? Number(params.id) : null;
  const { data: pr, isLoading } = usePurchaseRequest(id);
  const { data: user } = useCurrentUser();
  const [, navigate] = useLocation();
  const updateMutation = useUpdatePurchaseRequest();
  const { toast } = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (pr?.items && !initialized) {
      setItems(
        pr.items.map((item: any) => ({
          id: item.id,
          itemName: item.itemName,
          uom: item.uom,
          requestQty: Number(item.requestQty) || 0,
          approveQty: item.approveQty != null ? Number(item.approveQty) : Number(item.requestQty) || 0,
          approved: item.approved || false,
        }))
      );
      setInitialized(true);
    }
  }, [pr, initialized]);

  const updateItem = (index: number, field: keyof ReviewItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const toggleAll = (approved: boolean) => {
    setItems(items.map(item => ({ ...item, approved })));
  };

  const handleApprove = () => {
    const hasApproved = items.some(item => item.approved);
    if (!hasApproved) {
      toast({ title: "Error", description: "Please approve at least one item", variant: "destructive" });
      return;
    }

    updateMutation.mutate(
      {
        id: id!,
        status: "approved",
        items: items.map(item => ({
          id: item.id,
          itemName: item.itemName,
          uom: item.uom,
          requestQty: item.requestQty,
          approveQty: item.approved ? item.approveQty : null,
          approved: item.approved,
        })),
      },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Purchase request approved" });
          navigate("/");
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to approve", variant: "destructive" });
        },
      }
    );
  };

  const handleReject = () => {
    updateMutation.mutate(
      {
        id: id!,
        status: "rejected",
        items: items.map(item => ({
          id: item.id,
          itemName: item.itemName,
          uom: item.uom,
          requestQty: item.requestQty,
          approveQty: null,
          approved: false,
        })),
      },
      {
        onSuccess: () => {
          toast({ title: "Rejected", description: "Purchase request has been rejected" });
          navigate("/");
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Failed to reject", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!pr) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase request not found</p>
          <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold" data-testid="text-review-title">Review Purchase Request</h2>
            <p className="text-sm text-muted-foreground">
              #{pr.serialNumber} — {pr.clientName} — {format(new Date(pr.date), "dd MMM yyyy")}
              {pr.createdBy && <span className="ml-2">by {pr.createdBy}</span>}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Items for Review</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleAll(true)} data-testid="button-approve-all">
                  <Check className="w-3 h-3 mr-1" /> Approve All
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleAll(false)} data-testid="button-clear-all">
                  Clear All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center py-2 px-2 font-medium text-muted-foreground w-16">Approve</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Item Name</th>
                      <th className="text-center py-2 px-2 font-medium text-muted-foreground w-20">UOM</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground w-28">Request Qty</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground w-28">Approve Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className={`border-b last:border-0 ${item.approved ? 'bg-green-50/50 dark:bg-green-950/20' : ''}`}>
                        <td className="py-2 px-2 text-center">
                          <Checkbox
                            checked={item.approved}
                            onCheckedChange={(checked) => updateItem(index, "approved", !!checked)}
                            data-testid={`checkbox-approve-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{index + 1}</td>
                        <td className="py-2 px-2 font-medium" data-testid={`text-item-name-${index}`}>{item.itemName}</td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{item.uom}</td>
                        <td className="py-2 px-2 text-right font-mono" data-testid={`text-request-qty-${index}`}>{item.requestQty}</td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.approveQty || ""}
                            onChange={(e) => updateItem(index, "approveQty", Number(e.target.value))}
                            className="h-9 text-right"
                            min={0}
                            disabled={!item.approved}
                            data-testid={`input-approve-qty-${index}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sm:hidden space-y-4">
              {items.map((item, index) => (
                <div key={index} className={`border rounded-xl p-4 space-y-3 ${item.approved ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={item.approved}
                        onCheckedChange={(checked) => updateItem(index, "approved", !!checked)}
                      />
                      <span className="text-sm font-medium">{item.itemName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.uom}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Request Qty</Label>
                      <div className="h-9 flex items-center font-mono text-sm px-3 bg-muted/50 rounded-md">{item.requestQty}</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Approve Qty</Label>
                      <Input
                        type="number"
                        value={item.approveQty || ""}
                        onChange={(e) => updateItem(index, "approveQty", Number(e.target.value))}
                        className="h-9 text-right"
                        min={0}
                        disabled={!item.approved}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => navigate("/")} data-testid="button-cancel-review">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={updateMutation.isPending}
                data-testid="button-reject-all"
              >
                Reject All
              </Button>
              <Button
                onClick={handleApprove}
                disabled={updateMutation.isPending}
                data-testid="button-submit-approval"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
