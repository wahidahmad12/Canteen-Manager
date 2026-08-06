import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { useClientNames } from '@/hooks/use-reports';
import { LETTERHEAD_HTML, LETTERHEAD_CSS } from '@/lib/letterhead';

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "";
  const s = String(d).split("T")[0];
  if (!s) return "";
  const [y, m, dd] = s.split("-");
  return `${dd}-${m}-${y}`;
};

export default function FormVIA() {
  const { data: clientNames = [] } = useClientNames();
  const [selectedClient, setSelectedClient] = useState('');
  const [formType, setFormType] = useState<'commencement' | 'completion'>('commencement');
  const [contractorName, setContractorName] = useState('DJ Hospitality & Facility Management Pvt. Ltd.');
  const [contractorAddress, setContractorAddress] = useState('70D, Tiljala Road, Kolkata - 700046');
  const [nameOfWork, setNameOfWork] = useState('Canteen Services');
  const [principalEmployer, setPrincipalEmployer] = useState('');
  const [principalAddress, setPrincipalAddress] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseDate, setLicenseDate] = useState('');
  const [licensingOfficer, setLicensingOfficer] = useState('');
  const [effectDate, setEffectDate] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorAddress1, setInspectorAddress1] = useState('');
  const [inspectorAddress2, setInspectorAddress2] = useState('');

  const handleClientChange = (val: string) => {
    setSelectedClient(val);
    setPrincipalEmployer(val);
    const client = (clientNames as any[]).find((c: any) => (c.name || c) === val);
    if (client?.address) {
      setPrincipalAddress(client.address);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/form-xiii">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold" data-testid="text-title">
          Form VI-A — Notice of Commencement / Completion
        </h1>
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2" data-testid="button-print">
          <Printer className="w-4 h-4" /> Print
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 print:hidden border rounded-lg p-4 bg-muted/30">
        <div>
          <Label>Client / Principal Employer</Label>
          <Select value={selectedClient} onValueChange={handleClientChange}>
            <SelectTrigger data-testid="select-client">
              <SelectValue placeholder="Select Client" />
            </SelectTrigger>
            <SelectContent>
              {(clientNames as any[]).map((c: any) => {
                const name = c.name || c;
                return <SelectItem key={name} value={name}>{name}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Notice Type</Label>
          <Select value={formType} onValueChange={(v) => setFormType(v as 'commencement' | 'completion')}>
            <SelectTrigger data-testid="select-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="commencement">Commencement</SelectItem>
              <SelectItem value="completion">Completion</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Contractor Name</Label>
          <Input value={contractorName} onChange={(e) => setContractorName(e.target.value)} data-testid="input-contractor-name" />
        </div>
        <div>
          <Label>Contractor Address</Label>
          <Input value={contractorAddress} onChange={(e) => setContractorAddress(e.target.value)} data-testid="input-contractor-address" />
        </div>
        <div>
          <Label>Name of Work</Label>
          <Input value={nameOfWork} onChange={(e) => setNameOfWork(e.target.value)} data-testid="input-work-name" />
        </div>
        <div>
          <Label>Principal Employer Name</Label>
          <Input value={principalEmployer} onChange={(e) => setPrincipalEmployer(e.target.value)} data-testid="input-principal-employer" />
        </div>
        <div>
          <Label>Principal Employer Address</Label>
          <Input value={principalAddress} onChange={(e) => setPrincipalAddress(e.target.value)} data-testid="input-principal-address" />
        </div>
        <div>
          <Label>License No.</Label>
          <Input value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} data-testid="input-license-no" />
        </div>
        <div>
          <Label>License Date</Label>
          <Input type="date" value={licenseDate} onChange={(e) => setLicenseDate(e.target.value)} data-testid="input-license-date" />
        </div>
        <div>
          <Label>Licensing Officer (Name of Headquarters)</Label>
          <Input value={licensingOfficer} onChange={(e) => setLicensingOfficer(e.target.value)} data-testid="input-licensing-officer" />
        </div>
        <div>
          <Label>{formType === 'commencement' ? 'Commenced w.e.f. Date' : 'Completed on Date'}</Label>
          <Input type="date" value={effectDate} onChange={(e) => setEffectDate(e.target.value)} data-testid="input-effect-date" />
        </div>
        <div>
          <Label>The Inspector (Name)</Label>
          <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} data-testid="input-inspector-name" />
        </div>
        <div>
          <Label>Inspector Address Line 1</Label>
          <Input value={inspectorAddress1} onChange={(e) => setInspectorAddress1(e.target.value)} data-testid="input-inspector-addr1" />
        </div>
        <div>
          <Label>Inspector Address Line 2</Label>
          <Input value={inspectorAddress2} onChange={(e) => setInspectorAddress2(e.target.value)} data-testid="input-inspector-addr2" />
        </div>
      </div>

      <style>{`
        ${LETTERHEAD_CSS}
        @media print {
          @page { size: A4 portrait; margin: 12mm 20mm 20mm 20mm; }
          body * { visibility: hidden; }
          .form-via-print, .form-via-print * { visibility: visible; }
          .form-via-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="form-via-print border-2 border-black bg-white text-black p-8 sm:p-12 print:border-0 print:p-0" style={{ fontFamily: 'serif', lineHeight: 1.8 }}>
        <div dangerouslySetInnerHTML={{ __html: LETTERHEAD_HTML }} />
        <div className="text-center mb-10 mt-6">
          <h2 className="text-xl font-bold uppercase tracking-wide">FORM VI-A</h2>
          <p className="text-sm mt-1 italic">See Rule 25(2)(viii)</p>
          <p className="text-lg font-bold mt-4 uppercase underline">
            NOTICE OF {formType === 'commencement' ? 'COMMENCEMENT' : 'COMPLETION'} OF CONTRACT WORK
          </p>
        </div>

        <div className="text-base leading-loose space-y-6">
          <p className="text-justify">
            I/We, Shri/M/s.{' '}
            <span className="font-bold underline">{contractorName || '.......................................................'}</span>
            {' '}
            ({contractorAddress || '.......................................................'})
            {' '}hereby intimate that the contract work{' '}
            <span className="font-bold underline">{nameOfWork || '.......................................................'}</span>
            {' '}(Name of work){' '}
            in the establishment of{' '}
            <span className="font-bold underline">{principalEmployer || '.......................................................'}</span>
            {principalAddress ? `, ${principalAddress}` : ''}
            {' '}(Name & address of principal employer){' '}
            for which license No.{' '}
            <span className="font-bold">{licenseNo || '...................'}</span>
            {' '}dated{' '}
            <span className="font-bold">{fmtDate(licenseDate) || '...................'}</span>
            {' '}has been issued to me/us by the licensing officer{' '}
            ({licensingOfficer || '.....................'}),
            {' '}has been{' '}
            <span className="font-bold underline">{formType === 'commencement' ? 'commenced' : 'completed'}</span>
            {' '}with effect from / on{' '}
            <span className="font-bold">{fmtDate(effectDate) || '...................'}</span>.
          </p>
        </div>

        <div className="mt-20 flex justify-end">
          <div className="text-center">
            <div className="border-t-2 border-black w-56 pt-2 text-sm">
              Signature of the Contractor(s)
            </div>
            <p className="text-xs mt-1">{contractorName}</p>
          </div>
        </div>

        <div className="mt-16">
          <p className="text-sm font-semibold">To</p>
          <div className="ml-8 mt-2 space-y-1 text-sm">
            <p className="font-semibold">The Inspector</p>
            <p>{inspectorName || '.......................................................'}</p>
            <p>{inspectorAddress1 || '.......................................................'}</p>
            <p>{inspectorAddress2 || '.......................................................'}</p>
          </div>
        </div>

        <div className="mt-12 text-sm">
          <p>Place: Kolkata</p>
          <p>Date: {fmtDate(effectDate) || '_______________'}</p>
        </div>
      </div>
    </div>
  );
}
