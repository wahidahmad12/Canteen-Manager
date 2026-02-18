import { Link } from "wouter";
import { Plus, Loader2, AlertCircle, FileText, ArrowRight } from "lucide-react";
import { useReports, useDeleteReport } from "@/hooks/use-reports";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { data: reports, isLoading, error } = useReports();
  const deleteMutation = useDeleteReport();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-8 border border-destructive/20 rounded-2xl bg-destructive/5 text-destructive flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 mb-4" />
          <h2 className="text-lg font-bold mb-2">Failed to load reports</h2>
          <p>{error.message}</p>
        </div>
      </Layout>
    );
  }

  // Calculate some aggregate stats
  const totalReports = reports?.length || 0;
  
  // Robust parsing and sorting
  const sortedReports = reports ? [...reports].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : [];

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">DJ KPF</h2>
          <p className="text-muted-foreground mt-2">Delay Cash Expanse Manager</p>
        </div>
        <Link href="/new">
          <Button className="h-11 px-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
            <Plus className="w-4 h-4 mr-2" />
            New Daily Report
          </Button>
        </Link>
      </div>

      {reports?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">No reports yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-8">
            Create your first daily expense report to start tracking opening balances and item costs.
          </p>
          <Link href="/new">
            <Button>Create Report</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Date</th>
                  <th className="text-right">Opening Bal.</th>
                  <th className="text-right">Received</th>
                  <th className="text-right">Total Cash</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.map((report) => {
                  const opening = Number(report.openingBalance) || 0;
                  const received = Number(report.receivedAmount) || 0;
                  const totalCash = opening + received;
                  
                  return (
                    <tr key={report.id} className="group">
                      <td className="font-mono text-muted-foreground text-center">#{report.reportNumber}</td>
                      <td className="font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {format(new Date(report.date), "dd")}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{format(new Date(report.date), "MMMM yyyy")}</span>
                            <span className="text-xs text-muted-foreground truncate">{format(new Date(report.date), "EEEE")}</span>
                          </div>
                        </div>
                      </td>
                      <td className="text-right font-mono text-muted-foreground">₹{opening.toFixed(2)}</td>
                      <td className="text-right font-mono text-muted-foreground">₹{received.toFixed(2)}</td>
                      <td className="text-right font-mono font-bold text-primary">₹{totalCash.toFixed(2)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/report/${report.id}`}>
                            <Button size="sm" variant="ghost" className="h-8 hover-elevate">
                              View <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 hover-elevate">
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the report for {format(new Date(report.date), "PPP")}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteMutation.mutate(report.id)}
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
