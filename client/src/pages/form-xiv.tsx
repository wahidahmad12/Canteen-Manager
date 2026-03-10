import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'wouter';
import type { Employee } from '@shared/schema';

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "";
  const s = String(d).split("T")[0];
  if (!s) return "";
  const [y, m, dd] = s.split("-");
  return `${dd}-${m}-${y}`;
};

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

  const tenure = (() => {
    const from = fmtDate(employee.joiningDate);
    const to = fmtDate(employee.leavingDate);
    if (from && to) return `${from} to ${to}`;
    if (from) return `${from} to Present`;
    return "-";
  })();

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/form-xiii">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold" data-testid="text-title">
          Employment Card (Form XIV)
        </h1>
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2" data-testid="button-print">
          <Printer className="w-4 h-4" /> Print
        </Button>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm; }
          body * { visibility: hidden; }
          .form-xiv-print, .form-xiv-print * { visibility: visible; }
          .form-xiv-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="form-xiv-print border-2 border-black bg-white text-black p-6 sm:p-10 print:border-2 print:border-black print:p-10">
        <div className="text-center mb-8">
          <h2 className="text-lg font-bold uppercase tracking-wide" data-testid="text-form-title">FORM XIV</h2>
          <p className="text-sm mt-1">(See Rule 76)</p>
          <p className="text-base font-bold mt-2 underline">Employment Card</p>
        </div>

        <div className="space-y-4 text-sm leading-relaxed mb-8">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border border-black px-3 py-2 font-semibold w-1/2 align-top">Name and address of contractor</td>
                <td className="border border-black px-3 py-2 align-top">
                  DJ Hospitality & Facility Management Pvt. Ltd.<br />
                  70D, Tiljala Road, Kolkata - 700046
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-2 font-semibold align-top">Name and address of establishment in/under which contract is carried on</td>
                <td className="border border-black px-3 py-2 align-top">{employee.clientName || '-'}</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-2 font-semibold align-top">Nature of work and location of work</td>
                <td className="border border-black px-3 py-2 align-top">{employee.department || 'Canteen'} Services</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-2 font-semibold align-top">Name and address of principal employer</td>
                <td className="border border-black px-3 py-2 align-top">{employee.clientName || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-0">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border border-black px-3 py-3 font-semibold w-16 text-center align-top">1.</td>
                <td className="border border-black px-3 py-3 font-semibold w-2/5 align-top">Name of the workman</td>
                <td className="border border-black px-3 py-3 align-top font-bold">{employee.name}</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-3 font-semibold text-center align-top">2.</td>
                <td className="border border-black px-3 py-3 font-semibold align-top">Serial number in the register of workmen employed</td>
                <td className="border border-black px-3 py-3 align-top font-mono">{employee.employeeCode}</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-3 font-semibold text-center align-top">3.</td>
                <td className="border border-black px-3 py-3 font-semibold align-top">Nature of employment / designation</td>
                <td className="border border-black px-3 py-3 align-top">{employee.designation || '-'}</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-3 font-semibold text-center align-top">4.</td>
                <td className="border border-black px-3 py-3 font-semibold align-top">Wage rate with particulars of unit, in case of piece work</td>
                <td className="border border-black px-3 py-3 align-top">
                  {employee.dailyRate && employee.dailyRate !== "0" && employee.dailyRate !== "0.00"
                    ? `₹${Number(employee.dailyRate).toLocaleString('en-IN')} per day`
                    : '___________'}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-3 font-semibold text-center align-top">5.</td>
                <td className="border border-black px-3 py-3 font-semibold align-top">Wage period</td>
                <td className="border border-black px-3 py-3 align-top">Monthly</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-3 font-semibold text-center align-top">6.</td>
                <td className="border border-black px-3 py-3 font-semibold align-top">Tenure of employment</td>
                <td className="border border-black px-3 py-3 align-top">{tenure}</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-3 font-semibold text-center align-top">7.</td>
                <td className="border border-black px-3 py-3 font-semibold align-top">Remarks</td>
                <td className="border border-black px-3 py-3 align-top">{employee.leavingReason || ''}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-16 flex justify-between text-sm">
          <div className="text-center">
            <div className="border-t-2 border-black w-48 pt-2">
              Signature / Thumb impression of Workman
            </div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-black w-48 pt-2">
              Signature of Contractor
            </div>
            <p className="text-xs mt-1">DJ Hospitality & Facility Mgmt. Pvt. Ltd.</p>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>Place: Kolkata</p>
          <p>Date: _______________</p>
        </div>
      </div>
    </div>
  );
}
