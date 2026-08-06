import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'wouter';
import type { Employee } from '@shared/schema';
import { LETTERHEAD_HTML, LETTERHEAD_CSS } from '@/lib/letterhead';

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "";
  const s = String(d).split("T")[0];
  if (!s) return "";
  const [y, m, dd] = s.split("-");
  return `${dd}-${m}-${y}`;
};

export default function FormXV() {
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

  const age = employee.dob ? new Date().getFullYear() - new Date(employee.dob).getFullYear() : '';
  const dobDisplay = fmtDate(employee.dob);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/form-xiii">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold" data-testid="text-title">
          Service Certificate (Form XV)
        </h1>
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2" data-testid="button-print">
          <Printer className="w-4 h-4" /> Print
        </Button>
      </div>

      <style>{`
        ${LETTERHEAD_CSS}
        @media print {
          @page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }
          body * { visibility: hidden; }
          .form-xv-print, .form-xv-print * { visibility: visible; }
          .form-xv-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="form-xv-print border-2 border-black bg-white text-black p-6 sm:p-10 print:border-0 print:p-0">
        <div dangerouslySetInnerHTML={{ __html: LETTERHEAD_HTML }} />
        <div className="text-center mb-6 mt-4">
          <h2 className="text-lg font-bold uppercase tracking-wide" data-testid="text-form-title">FORM XV</h2>
          <p className="text-sm mt-1">(See Rule 77)</p>
          <p className="text-base font-bold mt-2 underline">Service Certificate</p>
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <span className="font-semibold">Name and address of contractor:</span>
              <p className="mt-0.5">DJ Hospitality & Facility Management Pvt. Ltd.</p>
              <p>70D, Tiljala Road, Kolkata - 700046</p>
            </div>
            <div>
              <span className="font-semibold">Name and address of establishment in/under which contract is carried on:</span>
              <p className="mt-0.5">{employee.clientName || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <span className="font-semibold">Nature and location of work:</span>
              <p className="mt-0.5">{employee.department || 'Canteen'} Services</p>
            </div>
            <div>
              <span className="font-semibold">Name and address of principal employer:</span>
              <p className="mt-0.5">{employee.clientName || '-'}</p>
            </div>
          </div>

          <div className="border-t border-black pt-3 mt-4">
            <p className="font-bold mb-2">Details of Workman:</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <span className="font-semibold">Name and address of the workman:</span>
              <p className="mt-0.5">{employee.name}</p>
              <p>{employee.permanentAddress || employee.localAddress || employee.address || '-'}</p>
            </div>
            <div>
              <span className="font-semibold">Age or Date of Birth:</span>
              <p className="mt-0.5">{dobDisplay ? `${dobDisplay}${age ? ` (Age: ${age} years)` : ''}` : (age ? `${age} years` : '-')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <span className="font-semibold">Identification marks:</span>
              <p className="mt-0.5">{employee.identificationMarks || '___________________________'}</p>
            </div>
            <div>
              <span className="font-semibold">Father's / Husband's name:</span>
              <p className="mt-0.5">{employee.fatherName || '-'}</p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <table className="w-full border-collapse border-2 border-black text-sm" data-testid="table-service">
            <thead>
              <tr className="bg-gray-100 print:bg-gray-100">
                <th className="border border-black px-2 py-2 text-center w-12" rowSpan={2}>Sr. No.</th>
                <th className="border border-black px-2 py-2 text-center" colSpan={2}>Total period for which employed</th>
                <th className="border border-black px-2 py-2 text-center" rowSpan={2}>Nature of work done</th>
                <th className="border border-black px-2 py-2 text-center" rowSpan={2}>Rate of wage<br/>(with particulars of unit in case of piece work)</th>
                <th className="border border-black px-2 py-2 text-center w-24" rowSpan={2}>Remarks</th>
              </tr>
              <tr className="bg-gray-50 print:bg-gray-50">
                <th className="border border-black px-2 py-1 text-center text-xs">From</th>
                <th className="border border-black px-2 py-1 text-center text-xs">To</th>
              </tr>
              <tr className="text-center text-xs text-gray-500">
                <td className="border border-black px-1 py-0.5">1</td>
                <td className="border border-black px-1 py-0.5">2</td>
                <td className="border border-black px-1 py-0.5">3</td>
                <td className="border border-black px-1 py-0.5">4</td>
                <td className="border border-black px-1 py-0.5">5</td>
                <td className="border border-black px-1 py-0.5">6</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-3 text-center">1</td>
                <td className="border border-black px-2 py-3 text-center">{fmtDate(employee.joiningDate) || '___________'}</td>
                <td className="border border-black px-2 py-3 text-center">{fmtDate(employee.leavingDate) || '___________'}</td>
                <td className="border border-black px-2 py-3 text-center">{employee.designation || '-'}</td>
                <td className="border border-black px-2 py-3 text-center">
                  {employee.dailyRate && employee.dailyRate !== "0" && employee.dailyRate !== "0.00"
                    ? `₹${Number(employee.dailyRate).toLocaleString('en-IN')} / day`
                    : '___________'}
                </td>
                <td className="border border-black px-2 py-3 text-center">{employee.leavingReason || ''}</td>
              </tr>
              {[2, 3, 4, 5, 6].map(n => (
                <tr key={n}>
                  <td className="border border-black px-2 py-3 text-center">{n}</td>
                  <td className="border border-black px-2 py-3 text-center"></td>
                  <td className="border border-black px-2 py-3 text-center"></td>
                  <td className="border border-black px-2 py-3 text-center"></td>
                  <td className="border border-black px-2 py-3 text-center"></td>
                  <td className="border border-black px-2 py-3 text-center"></td>
                </tr>
              ))}
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
