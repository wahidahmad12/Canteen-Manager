import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmt = (n: number) => "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface SalaryRecord {
  id: number;
  employeeId: number;
  clientName: string;
  month: number;
  year: number;
  daysWorked: string;
  basicWage: string;
  da: string;
  hra: string;
  otherAllowance: string;
  grossWage: string;
  pfDeduction: string;
  esicDeduction: string;
  professionalTax: string;
  advanceDeduction: string;
  fineDeduction: string;
  otherDeduction: string;
  totalDeduction: string;
  netPay: string;
  overtimeHours: string;
  overtimeRate: string;
  overtimeAmount: string;
  paymentMode: string;
  paidOn: string | null;
}

interface Employee {
  id: number;
  name: string;
  employeeCode?: string;
  designation?: string;
  department?: string;
  pfNo?: string;
  esicNo?: string;
  uanNo?: string;
  accountNo?: string;
  bankName?: string;
}

export default function WageSlip() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: salary, isLoading: salaryLoading } = useQuery<SalaryRecord>({
    queryKey: ["/api/salary", id],
    queryFn: async () => {
      const res = await fetch(`/api/salary/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary record");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees", salary?.clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(salary!.clientName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
    enabled: !!salary?.clientName,
  });

  const employee = employees?.find((e) => e.id === salary?.employeeId);

  if (salaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!salary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-muted-foreground">Salary record not found</p>
        <Link href="/salary">
          <Button variant="outline" data-testid="button-back-not-found">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Salary Register
          </Button>
        </Link>
      </div>
    );
  }

  const n = (v: string) => Number(v) || 0;

  const earnings = [
    { label: "Basic Wage", value: n(salary.basicWage) },
    { label: "Dearness Allowance (DA)", value: n(salary.da) },
    { label: "House Rent Allowance (HRA)", value: n(salary.hra) },
    { label: "Other Allowance", value: n(salary.otherAllowance) },
    { label: "Overtime", value: n(salary.overtimeAmount) },
  ];

  const deductions = [
    { label: "Provident Fund (PF)", value: n(salary.pfDeduction) },
    { label: "ESIC", value: n(salary.esicDeduction) },
    { label: "Professional Tax", value: n(salary.professionalTax) },
    { label: "Advance Deduction", value: n(salary.advanceDeduction) },
    { label: "Fine", value: n(salary.fineDeduction) },
    { label: "Other Deduction", value: n(salary.otherDeduction) },
  ];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; }
          .wage-slip-container { box-shadow: none !important; border: 2px solid #000 !important; max-width: 100% !important; margin: 0 !important; padding: 24px !important; }
          .wage-slip-container * { color: black !important; border-color: #333 !important; }
          .wage-slip-header { background: #f5f5f5 !important; }
        }
      `}</style>

      <div className="min-h-screen bg-muted/20 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6 no-print">
            <Link href="/salary">
              <Button variant="outline" data-testid="button-back-salary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Salary Register
              </Button>
            </Link>
            <Button onClick={() => window.print()} data-testid="button-print-slip">
              <Printer className="w-4 h-4 mr-2" />
              Print Wage Slip
            </Button>
          </div>

          <div className="wage-slip-container bg-card border rounded-md shadow-lg p-6 sm:p-8 space-y-6">
            <div className="wage-slip-header text-center border-b pb-4">
              <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider" data-testid="text-company-name">{salary.clientName}</h2>
              <h1 className="text-base sm:text-lg font-bold mt-1 tracking-wide" data-testid="text-wage-slip-title">WAGE SLIP (Form XIX)</h1>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-slip-period">
                For the month of {MONTHS[salary.month - 1]} {salary.year}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-b pb-4">
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[110px]">Employee Name:</span>
                  <span className="font-medium" data-testid="text-employee-name">{employee?.name || `Employee #${salary.employeeId}`}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[110px]">Employee Code:</span>
                  <span className="font-medium" data-testid="text-employee-code">{employee?.employeeCode || "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[110px]">Designation:</span>
                  <span className="font-medium" data-testid="text-designation">{employee?.designation || "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[110px]">Department:</span>
                  <span className="font-medium" data-testid="text-department">{employee?.department || "-"}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[110px]">PF No:</span>
                  <span className="font-medium" data-testid="text-pf-no">{employee?.pfNo || "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[110px]">ESIC No:</span>
                  <span className="font-medium" data-testid="text-esic-no">{employee?.esicNo || "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[110px]">UAN No:</span>
                  <span className="font-medium" data-testid="text-uan-no">{employee?.uanNo || "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[110px]">Bank A/C:</span>
                  <span className="font-medium" data-testid="text-bank-ac">{employee?.accountNo ? `${employee.bankName || ''} - ${employee.accountNo}` : "-"}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 text-sm border-b pb-4">
              <div className="flex gap-2">
                <span className="text-muted-foreground">Days Worked:</span>
                <span className="font-bold" data-testid="text-days-worked">{n(salary.daysWorked)}</span>
              </div>
              {n(salary.overtimeHours) > 0 && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground">OT Hours:</span>
                  <span className="font-medium">{n(salary.overtimeHours)} @ {fmt(n(salary.overtimeRate))}/hr</span>
                </div>
              )}
              {salary.paymentMode && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Payment Mode:</span>
                  <span className="font-medium">{salary.paymentMode}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-sm mb-3 border-b pb-2 uppercase tracking-wider">Earnings</h3>
                <div className="space-y-2 text-sm">
                  {earnings.map((item) => (
                    <div key={item.label} className="flex justify-between">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{fmt(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Gross Wage</span>
                    <span data-testid="text-gross-wage">{fmt(n(salary.grossWage))}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm mb-3 border-b pb-2 uppercase tracking-wider">Deductions</h3>
                <div className="space-y-2 text-sm">
                  {deductions.map((item) => (
                    <div key={item.label} className="flex justify-between">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{fmt(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total Deductions</span>
                    <span className="text-red-600 dark:text-red-400" data-testid="text-total-deductions">{fmt(n(salary.totalDeduction))}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-b-2 py-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>NET PAY</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-xl" data-testid="text-net-pay">{fmt(n(salary.netPay))}</span>
              </div>
              {salary.paidOn && (
                <p className="text-xs text-muted-foreground mt-1">Paid on: {salary.paidOn}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8 pt-12 text-sm">
              <div className="text-center">
                <div className="border-t border-foreground/30 pt-2 mx-8">
                  <p className="font-medium">Employee Signature</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-foreground/30 pt-2 mx-8">
                  <p className="font-medium">Employer Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
