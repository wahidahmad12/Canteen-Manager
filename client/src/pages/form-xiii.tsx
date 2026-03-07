import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Printer, Users, ArrowLeft } from 'lucide-react';
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 print:hidden">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-title">Register of Workmen (Form XIII)</h1>
            <p className="text-sm text-muted-foreground">Under Rule 75 of Contract Labour (R&A) Rules, 1971</p>
          </div>
          <Button onClick={() => window.print()} variant="outline" className="gap-2" data-testid="button-print">
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>

        <div className="flex gap-4 items-end print:hidden">
          <div className="flex-1 max-w-xs">
            <Label>Company / Client Name</Label>
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
        </div>

        {selectedClient && (
          <div className="print:block">
            <div className="hidden print:block text-center mb-6">
              <h2 className="text-lg font-bold">FORM XIII</h2>
              <p className="text-sm">Register of Workmen Employed by Contractor</p>
              <p className="text-sm">[See Rule 75]</p>
              <p className="text-sm font-semibold mt-2">Name of the Establishment: {selectedClient}</p>
              <p className="text-sm">Name of the Contractor: DJ Hospitality & Facility Management Pvt Ltd</p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
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
                <div className="sm:hidden print:hidden space-y-3">
                  {activeEmployees.map((emp, idx) => (
                    <Card key={emp.id} data-testid={`card-employee-${emp.id}`}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{idx + 1}. {emp.name}</p>
                            <p className="text-sm text-muted-foreground">{emp.employeeCode}</p>
                          </div>
                          <Link href={`/form-xiv/${emp.id}`}>
                            <Button variant="outline" size="sm" data-testid={`button-card-${emp.id}`}>Card</Button>
                          </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-sm">
                          <span className="text-muted-foreground">Father's Name:</span>
                          <span>{emp.fatherName || '-'}</span>
                          <span className="text-muted-foreground">Designation:</span>
                          <span>{emp.designation || '-'}</span>
                          <span className="text-muted-foreground">Gender/Age:</span>
                          <span>{emp.gender || '-'} / {emp.dob ? new Date().getFullYear() - new Date(emp.dob).getFullYear() : '-'}</span>
                          <span className="text-muted-foreground">Aadhaar:</span>
                          <span>{emp.aadhaarNo || '-'}</span>
                          <span className="text-muted-foreground">PF No:</span>
                          <span>{emp.pfNo || '-'}</span>
                          <span className="text-muted-foreground">ESIC No:</span>
                          <span>{emp.esicNo || '-'}</span>
                          <span className="text-muted-foreground">Joining:</span>
                          <span>{emp.joiningDate || '-'}</span>
                          <span className="text-muted-foreground">Daily Rate:</span>
                          <span>₹{Number(emp.dailyRate).toLocaleString('en-IN')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden sm:block print:block overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300 print:text-black print:border-gray-400">
                    <thead>
                      <tr className="bg-muted print:bg-gray-100">
                        <th className="border border-gray-300 px-2 py-2 text-left">S.No</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">Name</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">Father's Name</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">Emp Code</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">Designation</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">Gender/Age</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">Aadhaar</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">PF No</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">ESIC No</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">UAN No</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">Joining Date</th>
                        <th className="border border-gray-300 px-2 py-2 text-right">Daily Rate</th>
                        <th className="border border-gray-300 px-2 py-2 text-left print:hidden">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployees.map((emp, idx) => (
                        <tr key={emp.id} className="hover:bg-muted/50" data-testid={`row-employee-${emp.id}`}>
                          <td className="border border-gray-300 px-2 py-1">{idx + 1}</td>
                          <td className="border border-gray-300 px-2 py-1 font-medium">{emp.name}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.fatherName || '-'}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.employeeCode}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.designation || '-'}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.gender || '-'} / {emp.dob ? new Date().getFullYear() - new Date(emp.dob).getFullYear() : '-'}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.aadhaarNo || '-'}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.pfNo || '-'}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.esicNo || '-'}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.uanNo || '-'}</td>
                          <td className="border border-gray-300 px-2 py-1">{emp.joiningDate || '-'}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right">₹{Number(emp.dailyRate).toLocaleString('en-IN')}</td>
                          <td className="border border-gray-300 px-2 py-1 print:hidden">
                            <Link href={`/form-xiv/${emp.id}`}>
                              <Button variant="outline" size="sm" data-testid={`button-emp-card-${emp.id}`}>Card</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
