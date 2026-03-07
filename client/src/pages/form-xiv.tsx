import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'wouter';
import type { Employee } from '@shared/schema';

export default function FormXIV() {
  const params = useParams<{ id: string }>();
  const employeeId = Number(params.id);

  const { data: employee, isLoading } = useQuery<Employee>({
    queryKey: ['/api/employees', employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!employeeId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Employee not found</p>
      </div>
    );
  }

  const age = employee.dob ? new Date().getFullYear() - new Date(employee.dob).getFullYear() : '-';

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/form-xiii">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold" data-testid="text-title">Employment Card (Form XIV)</h1>
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2" data-testid="button-print">
          <Printer className="w-4 h-4" /> Print
        </Button>
      </div>

      <div className="border-2 border-gray-400 p-6 sm:p-8 print:border-black print:text-black">
        <div className="text-center mb-6 border-b-2 border-gray-400 pb-4 print:border-black">
          <h2 className="text-lg font-bold uppercase">FORM XIV</h2>
          <p className="text-sm">Employment Card</p>
          <p className="text-xs text-muted-foreground print:text-gray-600">[See Rule 76]</p>
        </div>

        <div className="text-center mb-6">
          <p className="font-semibold text-sm">Name of Contractor: DJ Hospitality & Facility Management Pvt Ltd</p>
          <p className="text-sm">Name of Establishment: {employee.clientName}</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Row label="Employee Code" value={employee.employeeCode} />
            <Row label="Name of Workman" value={employee.name} />
            <Row label="Father's/Husband's Name" value={employee.fatherName || '-'} />
            <Row label="Gender" value={employee.gender || '-'} />
            <Row label="Date of Birth" value={employee.dob || '-'} />
            <Row label="Age" value={String(age)} />
            <Row label="Identification Marks" value="-" />
            <Row label="Designation" value={employee.designation || '-'} />
            <Row label="Department" value={employee.department || '-'} />
            <Row label="Daily Rate of Wages" value={`₹${Number(employee.dailyRate).toLocaleString('en-IN')}`} />
            <Row label="Date of Commencement" value={employee.joiningDate || '-'} />
            <Row label="Address" value={employee.address || '-'} />
          </div>

          <div className="border-t-2 border-gray-300 pt-4 print:border-black">
            <h3 className="font-bold text-sm mb-3">Government Identity Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Row label="Aadhaar No" value={employee.aadhaarNo || '-'} />
              <Row label="PAN No" value={employee.panNo || '-'} />
              <Row label="PF Account No" value={employee.pfNo || '-'} />
              <Row label="ESIC No" value={employee.esicNo || '-'} />
              <Row label="UAN No" value={employee.uanNo || '-'} />
            </div>
          </div>

          <div className="border-t-2 border-gray-300 pt-4 print:border-black">
            <h3 className="font-bold text-sm mb-3">Bank Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Row label="Bank Name" value={employee.bankName || '-'} />
              <Row label="Account No" value={employee.accountNo || '-'} />
              <Row label="IFSC Code" value={employee.ifscCode || '-'} />
            </div>
          </div>

          {employee.leavingDate && (
            <div className="border-t-2 border-gray-300 pt-4 print:border-black">
              <h3 className="font-bold text-sm mb-3">Termination/Leaving Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Row label="Date of Leaving" value={employee.leavingDate} />
                <Row label="Reason" value={employee.leavingReason || '-'} />
              </div>
            </div>
          )}

          <div className="mt-12 pt-8 flex justify-between text-sm">
            <div className="text-center">
              <div className="border-t border-gray-400 print:border-black w-40 pt-1">
                Signature of Workman
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 print:border-black w-40 pt-1">
                Signature of Contractor
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground print:text-gray-600 text-xs">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
