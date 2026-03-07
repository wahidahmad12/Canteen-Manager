import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Printer, Users, ArrowLeft, FileText, Building2, Briefcase, CreditCard } from 'lucide-react';
import { useClientNames } from '@/hooks/use-reports';
import { Link } from 'wouter';
import type { Employee } from '@shared/schema';

export default function FormXIII() {
  const { data: clientNames = [] } = useClientNames();
  const [selectedClient, setSelectedClient] = useState('');

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['/api/employees', selectedClient],
    queryFn: async () => {
      const url = selectedClient ? `/api/employees?clientName=${encodeURIComponent(selectedClient)}` : '/api/employees';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!selectedClient,
  });

  const activeEmployees = employees.filter(e => e.isActive);

  const handlePrint = () => {
    const style = document.createElement("style");
    style.id = "form-xiii-print";
    style.textContent = `
      @media print {
        @page { size: A3 landscape; margin: 10mm; }
        body * { visibility: hidden !important; }
        #form-xiii-print-area, #form-xiii-print-area * { visibility: visible !important; }
        #form-xiii-print-area { position: fixed; top: 0; left: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 500);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-title">
                <FileText className="w-5 h-5 text-indigo-600" />
                Register of Workmen (Form XIII)
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Under Rule 75 of Contract Labour (R&A) Rules, 1971</p>
            </div>
          </div>
          {selectedClient && activeEmployees.length > 0 && (
            <Button onClick={handlePrint} variant="outline" className="gap-2" data-testid="button-print">
              <Printer className="w-4 h-4" /> Print / PDF
            </Button>
          )}
        </div>

        <Card className="no-print border-indigo-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 max-w-xs space-y-2">
                <Label className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Company / Client Name
                </Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientNames.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClient && (
                <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                  <Users className="w-3 h-3 mr-1" /> {activeEmployees.length} Workers
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedClient && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : activeEmployees.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No employees found for this company</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="sm:hidden no-print space-y-3">
                  {activeEmployees.map((emp, idx) => (
                    <Card key={emp.id} className="border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow" data-testid={`card-employee-${emp.id}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm text-indigo-800 dark:text-indigo-300">{idx + 1}. {emp.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{emp.employeeCode}</p>
                          </div>
                          <Link href={`/form-xiv/${emp.id}`}>
                            <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-300" data-testid={`button-card-${emp.id}`}>
                              <CreditCard className="w-3 h-3 mr-1" /> Card
                            </Button>
                          </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                          <span className="text-muted-foreground">Father's Name:</span>
                          <span className="font-medium">{emp.fatherName || '-'}</span>
                          <span className="text-muted-foreground">Designation:</span>
                          <span className="font-medium">{emp.designation || '-'}</span>
                          <span className="text-muted-foreground">Gender/Age:</span>
                          <span>{emp.gender || '-'} / {emp.dob ? new Date().getFullYear() - new Date(emp.dob).getFullYear() : '-'}</span>
                          <span className="text-muted-foreground">PF No:</span>
                          <span className="font-mono text-[10px]">{emp.pfNo || '-'}</span>
                          <span className="text-muted-foreground">ESIC No:</span>
                          <span className="font-mono text-[10px]">{emp.esicNo || '-'}</span>
                          <span className="text-muted-foreground">UAN:</span>
                          <span className="font-mono text-[10px]">{emp.uanNo || '-'}</span>
                          <span className="text-muted-foreground">Joining:</span>
                          <span>{emp.joiningDate || '-'}</span>
                          <span className="text-muted-foreground">Daily Rate:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">₹{Number(emp.dailyRate).toLocaleString('en-IN')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden sm:block no-print">
                  <div className="border-2 border-indigo-200 rounded-xl overflow-hidden shadow-lg">
                    <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white text-center py-2.5 font-bold text-sm tracking-wide">
                      FORM XIII &mdash; Register of Workmen &mdash; {selectedClient}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse" data-testid="table-form-xiii">
                        <thead>
                          <tr>
                            <th colSpan={3} className="px-2 py-1.5 text-center font-bold border border-indigo-200 bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 text-xs">Personal Details</th>
                            <th colSpan={3} className="px-2 py-1.5 text-center font-bold border border-sky-200 bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200 text-xs">Employment</th>
                            <th colSpan={4} className="px-2 py-1.5 text-center font-bold border border-violet-200 bg-violet-50 dark:bg-violet-950 text-violet-800 dark:text-violet-200 text-xs">Government IDs</th>
                            <th colSpan={2} className="px-2 py-1.5 text-center font-bold border border-emerald-200 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs">Wages & Date</th>
                            <th className="px-2 py-1.5 text-center font-bold border border-slate-200 bg-slate-50 dark:bg-slate-800 text-xs"></th>
                          </tr>
                          <tr className="border-b-2 border-indigo-300">
                            <th className="px-2 py-2 text-center font-bold border border-indigo-200 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 w-[40px]">S.No</th>
                            <th className="px-2 py-2 text-left font-bold border border-indigo-200 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 min-w-[160px]">Name</th>
                            <th className="px-2 py-2 text-left font-bold border border-indigo-200 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 min-w-[140px]">Father's Name</th>
                            <th className="px-2 py-2 text-left font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">Emp Code</th>
                            <th className="px-2 py-2 text-left font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">Designation</th>
                            <th className="px-2 py-2 text-center font-bold border border-sky-200 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">Gender/Age</th>
                            <th className="px-2 py-2 text-left font-bold border border-violet-200 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">Aadhaar</th>
                            <th className="px-2 py-2 text-left font-bold border border-violet-200 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">PF No</th>
                            <th className="px-2 py-2 text-left font-bold border border-violet-200 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">ESIC No</th>
                            <th className="px-2 py-2 text-left font-bold border border-violet-200 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">UAN No</th>
                            <th className="px-2 py-2 text-left font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Joining Date</th>
                            <th className="px-2 py-2 text-right font-bold border border-emerald-200 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Daily Rate</th>
                            <th className="px-2 py-2 text-center font-bold border border-slate-200 bg-slate-100 dark:bg-slate-800 w-[60px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeEmployees.map((emp, idx) => {
                            const bgClass = idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-blue-50/40 dark:bg-slate-800/40";
                            return (
                              <tr key={emp.id} className={`${bgClass} hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors`} data-testid={`row-employee-${emp.id}`}>
                                <td className="px-2 py-2 text-center border border-slate-200 font-semibold text-indigo-600 dark:text-indigo-400">{idx + 1}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-bold text-slate-800 dark:text-slate-200">{emp.name}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 text-slate-600 dark:text-slate-400">{emp.fatherName || '-'}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-mono text-[10px] text-sky-700 dark:text-sky-400">{emp.employeeCode}</td>
                                <td className="px-2 py-2 text-left border border-slate-200">{emp.designation || '-'}</td>
                                <td className="px-2 py-2 text-center border border-slate-200">{emp.gender || '-'} / {emp.dob ? new Date().getFullYear() - new Date(emp.dob).getFullYear() : '-'}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-mono text-[10px]">{emp.aadhaarNo || '-'}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-mono text-[10px] text-violet-600 dark:text-violet-400">{emp.pfNo || '-'}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-mono text-[10px]">{emp.esicNo || '-'}</td>
                                <td className="px-2 py-2 text-left border border-slate-200 font-mono text-[10px]">{emp.uanNo || '-'}</td>
                                <td className="px-2 py-2 text-left border border-slate-200">{emp.joiningDate || '-'}</td>
                                <td className="px-2 py-2 text-right border border-slate-200 font-bold text-emerald-700 dark:text-emerald-400">₹{Number(emp.dailyRate).toLocaleString('en-IN')}</td>
                                <td className="px-2 py-2 text-center border border-slate-200">
                                  <Link href={`/form-xiv/${emp.id}`}>
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-indigo-600 border-indigo-300 hover:bg-indigo-50" data-testid={`button-emp-card-${emp.id}`}>
                                      <Briefcase className="w-3 h-3 mr-1" /> Card
                                    </Button>
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 font-bold border-t-2 border-indigo-400">
                            <td colSpan={11} className="px-3 py-2 border border-slate-300 text-right text-indigo-700 dark:text-indigo-300">
                              Total Workers: {activeEmployees.length}
                            </td>
                            <td className="px-2 py-2 text-right border border-slate-300 text-emerald-700 dark:text-emerald-400">
                              ₹{activeEmployees.reduce((s, e) => s + Number(e.dailyRate), 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-2 py-2 border border-slate-300"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                <div id="form-xiii-print-area" className="hidden print:block">
                  <div style={{ textAlign: "center", marginBottom: "12px" }}>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "#283593" }}>FORM XIII</div>
                    <div style={{ fontSize: "11px" }}>Register of Workmen Employed by Contractor</div>
                    <div style={{ fontSize: "10px", color: "#666" }}>[See Rule 75]</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, marginTop: "8px" }}>Name of the Establishment: {selectedClient}</div>
                    <div style={{ fontSize: "11px" }}>Name of the Contractor: DJ Hospitality & Facility Management Pvt Ltd</div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", fontFamily: "Arial, sans-serif" }}>
                    <thead>
                      <tr>
                        <th colSpan={3} style={{ background: "#e8eaf6", color: "#283593", fontSize: "9px", fontWeight: 700, border: "1px solid #999", padding: "3px" }}>Personal Details</th>
                        <th colSpan={3} style={{ background: "#e1f5fe", color: "#0277bd", fontSize: "9px", fontWeight: 700, border: "1px solid #999", padding: "3px" }}>Employment</th>
                        <th colSpan={4} style={{ background: "#ede7f6", color: "#4527a0", fontSize: "9px", fontWeight: 700, border: "1px solid #999", padding: "3px" }}>Government IDs</th>
                        <th colSpan={2} style={{ background: "#e8f5e9", color: "#2e7d32", fontSize: "9px", fontWeight: 700, border: "1px solid #999", padding: "3px" }}>Wages & Date</th>
                      </tr>
                      <tr>
                        <th style={{ background: "#c5cae9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "center" }}>S.No</th>
                        <th style={{ background: "#c5cae9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>Name</th>
                        <th style={{ background: "#c5cae9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>Father's Name</th>
                        <th style={{ background: "#b3e5fc", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>Emp Code</th>
                        <th style={{ background: "#b3e5fc", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>Designation</th>
                        <th style={{ background: "#b3e5fc", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "center" }}>Gender/Age</th>
                        <th style={{ background: "#d1c4e9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>Aadhaar</th>
                        <th style={{ background: "#d1c4e9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>PF No</th>
                        <th style={{ background: "#d1c4e9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>ESIC No</th>
                        <th style={{ background: "#d1c4e9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>UAN No</th>
                        <th style={{ background: "#c8e6c9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "left" }}>Joining Date</th>
                        <th style={{ background: "#c8e6c9", border: "1px solid #999", padding: "3px 4px", fontWeight: 600, textAlign: "right" }}>Daily Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployees.map((emp, idx) => (
                        <tr key={emp.id} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f5f7ff" }}>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "center", fontWeight: 600, color: "#3949ab" }}>{idx + 1}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", fontWeight: 700 }}>{emp.name}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", color: "#555" }}>{emp.fatherName || '-'}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", fontFamily: "monospace", fontSize: "8px", color: "#0277bd" }}>{emp.employeeCode}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px" }}>{emp.designation || '-'}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "center" }}>{emp.gender || '-'} / {emp.dob ? new Date().getFullYear() - new Date(emp.dob).getFullYear() : '-'}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", fontFamily: "monospace", fontSize: "8px" }}>{emp.aadhaarNo || '-'}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", fontFamily: "monospace", fontSize: "8px", color: "#4527a0" }}>{emp.pfNo || '-'}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", fontFamily: "monospace", fontSize: "8px" }}>{emp.esicNo || '-'}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", fontFamily: "monospace", fontSize: "8px" }}>{emp.uanNo || '-'}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px" }}>{emp.joiningDate || '-'}</td>
                          <td style={{ border: "1px solid #bbb", padding: "3px 4px", textAlign: "right", fontWeight: 700, color: "#2e7d32" }}>₹{Number(emp.dailyRate).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#e0e0e0", fontWeight: "bold" }}>
                        <td colSpan={11} style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "right", color: "#283593" }}>Total Workers: {activeEmployees.length}</td>
                        <td style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "right", color: "#2e7d32" }}>₹{activeEmployees.reduce((s, e) => s + Number(e.dailyRate), 0).toLocaleString('en-IN')}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ borderTop: "1px solid #333", width: "160px", paddingTop: "4px" }}>Signature of Contractor</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ borderTop: "1px solid #333", width: "160px", paddingTop: "4px" }}>Principal Employer</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
