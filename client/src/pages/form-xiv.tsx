import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft, User, Building2, CreditCard, Landmark, Shield, Phone } from 'lucide-react';
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
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
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
        <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-title">
          <CreditCard className="w-5 h-5 text-indigo-600" />
          Employment Card (Form XIV)
        </h1>
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2" data-testid="button-print">
          <Printer className="w-4 h-4" /> Print
        </Button>
      </div>

      <div className="border-2 border-indigo-300 rounded-xl overflow-hidden shadow-xl print:border-2 print:border-black print:rounded-none print:shadow-none print:text-black">
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white text-center py-4 print:bg-white print:text-black print:py-3 print:border-b-2 print:border-black">
          <h2 className="text-lg font-bold uppercase tracking-wider print:text-base">FORM XIV</h2>
          <p className="text-sm opacity-90 print:opacity-100">Employment Card</p>
          <p className="text-xs opacity-70 print:opacity-100 print:text-gray-600">[See Rule 76]</p>
        </div>

        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 text-center py-3 border-b border-indigo-200 print:bg-white print:border-black">
          <p className="font-semibold text-sm text-indigo-800 dark:text-indigo-300 print:text-black">Name of Contractor: DJ Hospitality & Facility Management Pvt Ltd</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-black flex items-center justify-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> Name of Establishment: {employee.clientName}
          </p>
        </div>

        <div className="p-5 sm:p-7 space-y-5 print:p-6">
          <div>
            <SectionHeader icon={<User className="w-4 h-4" />} label="Personal Information" color="indigo" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <InfoRow label="Employee Code" value={employee.employeeCode} highlight />
              <InfoRow label="Name of Workman" value={employee.name} highlight />
              <InfoRow label="Father's/Husband's Name" value={employee.fatherName || '-'} />
              <InfoRow label="Gender" value={employee.gender || '-'} />
              <InfoRow label="Date of Birth" value={employee.dob || '-'} />
              <InfoRow label="Age" value={String(age)} />
              <InfoRow label="Mobile" value={employee.mobile || '-'} />
              <InfoRow label="Address" value={employee.address || '-'} />
            </div>
          </div>

          <div>
            <SectionHeader icon={<Building2 className="w-4 h-4" />} label="Employment Details" color="sky" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <InfoRow label="Designation" value={employee.designation || '-'} />
              <InfoRow label="Department" value={employee.department || '-'} />
              <InfoRow label="Daily Rate of Wages" value={`₹${Number(employee.dailyRate).toLocaleString('en-IN')}`} highlight money />
              <InfoRow label="Date of Commencement" value={employee.joiningDate || '-'} />
            </div>
          </div>

          <div>
            <SectionHeader icon={<Shield className="w-4 h-4" />} label="Government Identity Details" color="violet" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <InfoRow label="Aadhaar No" value={employee.aadhaarNo || '-'} mono />
              <InfoRow label="PAN No" value={employee.panNo || '-'} mono />
              <InfoRow label="PF Account No" value={employee.pfNo || '-'} mono />
              <InfoRow label="ESIC No" value={employee.esicNo || '-'} mono />
              <InfoRow label="UAN No" value={employee.uanNo || '-'} mono />
            </div>
          </div>

          <div>
            <SectionHeader icon={<Landmark className="w-4 h-4" />} label="Bank Details" color="emerald" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <InfoRow label="Bank Name" value={employee.bankName || '-'} />
              <InfoRow label="Account No" value={employee.accountNo || '-'} mono />
              <InfoRow label="IFSC Code" value={employee.ifscCode || '-'} mono />
            </div>
          </div>

          {employee.leavingDate && (
            <div>
              <SectionHeader icon={<User className="w-4 h-4" />} label="Termination / Leaving Details" color="rose" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <InfoRow label="Date of Leaving" value={employee.leavingDate} />
                <InfoRow label="Reason" value={employee.leavingReason || '-'} />
              </div>
            </div>
          )}

          <div className="mt-10 pt-8 flex justify-between text-sm print:mt-16">
            <div className="text-center">
              <div className="border-t-2 border-slate-400 print:border-black w-44 pt-2 text-xs text-muted-foreground print:text-black">
                Signature of Workman
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-slate-400 print:border-black w-44 pt-2 text-xs text-muted-foreground print:text-black">
                Signature of Contractor
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const colorMap: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-300",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300",
};

function SectionHeader({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-bold ${colorMap[color] || colorMap.indigo} print:bg-gray-100 print:text-black print:border-gray-400`}>
      {icon}
      {label}
    </div>
  );
}

function InfoRow({ label, value, highlight, money, mono }: { label: string; value: string; highlight?: boolean; money?: boolean; mono?: boolean }) {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-800 print:border-gray-200 print:bg-white print:rounded-none">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground print:text-gray-500 font-semibold">{label}</span>
      <span className={`text-sm ${highlight ? 'font-bold text-slate-800 dark:text-slate-200 print:text-black' : 'font-medium'} ${money ? 'text-emerald-700 dark:text-emerald-400 print:text-black' : ''} ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
