import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Printer, Plus, Save, Trash2, FileText, Edit, ArrowLeft, Loader2 } from 'lucide-react';
import { useClientNames } from '@/hooks/use-reports';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { LETTERHEAD_HTML, getCoverLetterPrintStyles } from '@/lib/letterhead';
import type { Letter } from '@shared/schema';

export default function Letterhead() {
  const { toast } = useToast();
  const { data: clientNames = [] } = useClientNames();

  const [activeTab, setActiveTab] = useState("compose");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [refNumber, setRefNumber] = useState("");
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0]);
  const [toName, setToName] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [toGstin, setToGstin] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [regards, setRegards] = useState("Wahid Ahmad\nZonal Manager & Partner\nDJ Hospitality & Facility Management Pvt Ltd");
  const [clientName, setClientName] = useState("");

  const { data: allLetters = [], isLoading: lettersLoading } = useQuery<Letter[]>({
    queryKey: ['/api/letters'],
  });

  const { data: nextSerialData } = useQuery<{ nextSerial: number }>({
    queryKey: ['/api/letters/next-serial'],
  });

  const generateRefNumber = (serial: number) => {
    const yr = String(new Date().getFullYear()).slice(2);
    const num = String(serial).padStart(3, '0');
    return `DJ/KOL/${yr}/${num}`;
  };

  const resetForm = () => {
    setEditingId(null);
    setRefNumber("");
    setLetterDate(new Date().toISOString().split('T')[0]);
    setToName("");
    setToAddress("");
    setToGstin("");
    setSubject("");
    setBody("");
    setRegards("Wahid Ahmad\nZonal Manager & Partner\nDJ Hospitality & Facility Management Pvt Ltd");
    setClientName("");
    queryClient.invalidateQueries({ queryKey: ['/api/letters/next-serial'] });
  };

  const loadLetter = (letter: Letter) => {
    setEditingId(letter.id);
    setRefNumber(letter.refNumber);
    setLetterDate(letter.letterDate);
    setToName(letter.toName || "");
    setToAddress(letter.toAddress || "");
    setToGstin(letter.toGstin || "");
    setSubject(letter.subject || "");
    setBody(letter.body || "");
    setRegards(letter.regards || "Wahid Ahmad\nZonal Manager & Partner\nDJ Hospitality & Facility Management Pvt Ltd");
    setClientName(letter.clientName || "");
    setActiveTab("compose");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalRef = refNumber || generateRefNumber(nextSerialData?.nextSerial || 1);
      const payload = {
        refNumber: finalRef,
        letterDate,
        toName,
        toAddress,
        toGstin,
        subject,
        body,
        regards,
        clientName: clientName === '__none__' ? '' : clientName,
      };
      if (editingId) {
        return apiRequest('PUT', `/api/letters/${editingId}`, payload);
      } else {
        return apiRequest('POST', '/api/letters', payload);
      }
    },
    onSuccess: async (res) => {
      const saved = await res.json();
      toast({ title: editingId ? "Letter updated" : "Letter saved", description: `Ref: ${saved.refNumber}` });
      setEditingId(saved.id);
      setRefNumber(saved.refNumber);
      queryClient.invalidateQueries({ queryKey: ['/api/letters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/letters/next-serial'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save letter", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/letters/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Letter deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/letters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/letters/next-serial'] });
      if (editingId) resetForm();
    },
  });

  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const handlePrint = () => {
    const finalRef = refNumber || generateRefNumber(nextSerialData?.nextSerial || 1);
    const fmtDate = letterDate ? letterDate.split('-').reverse().join('/') : '___/___/______';

    const bodyLines = (body || '').split('\n').map(line => `<p>${esc(line) || '&nbsp;'}</p>`).join('');
    const regardsLines = (regards || '').split('\n').map((line, i) => {
      if (i === 0) return `<p style="font-weight:bold">${esc(line)}</p>`;
      return `<p>${esc(line)}</p>`;
    }).join('');

    const html = `
      ${LETTERHEAD_HTML}
      <div class="ref-line">
        <span>Ref. ${esc(finalRef)}</span>
        <span>Date: ${esc(fmtDate)}</span>
      </div>
      <div style="margin-bottom:16px">
        <p>To,</p>
        ${toName ? `<p><strong>${esc(toName)}</strong></p>` : ''}
        ${(toAddress || '').split('\n').map(l => `<p>${esc(l)}</p>`).join('')}
        ${toGstin ? `<p>GSTIN. ${esc(toGstin)}</p>` : ''}
      </div>
      ${subject ? `<div class="subject"><p>${esc(subject)}</p></div>` : ''}
      <div style="margin-bottom:16px">
        ${bodyLines}
      </div>
      <div style="margin-top:40px">
        <p>Regards</p>
        <div style="margin-top:15px">
          ${regardsLines}
        </div>
      </div>
    `;

    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(`<!DOCTYPE html><html><head><title>Letter - ${finalRef}</title>
      <style>${getCoverLetterPrintStyles()}</style>
    </head><body>${html}</body></html>`);
    pw.document.close();
    pw.onload = () => { pw.print(); pw.onafterprint = () => pw.close(); };
  };

  const handleNewLetter = () => {
    resetForm();
    if (nextSerialData) {
      setRefNumber(generateRefNumber(nextSerialData.nextSerial));
    }
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2 truncate" data-testid="text-page-title">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> Letter Head
            </h1>
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Type, save and print letters on company letterhead</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto" data-testid="tabs-letterhead">
            <TabsTrigger value="compose" className="flex-1 sm:flex-none gap-1" data-testid="tab-compose">
              <Edit className="w-3.5 h-3.5" /> Compose
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex-1 sm:flex-none gap-1" data-testid="tab-saved">
              <FileText className="w-3.5 h-3.5" /> Saved Letters <span className="text-xs text-muted-foreground">({allLetters.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={handleNewLetter} className="gap-1.5 text-xs sm:text-sm" data-testid="button-new-letter">
                      <Plus className="w-4 h-4" /> New Letter
                    </Button>
                    <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1.5 text-xs sm:text-sm" data-testid="button-save-letter">
                      {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {editingId ? 'Update' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 text-xs sm:text-sm" data-testid="button-print-letter">
                      <Printer className="w-4 h-4" /> Print
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Ref. Number</Label>
                      <Input
                        value={refNumber}
                        onChange={e => setRefNumber(e.target.value)}
                        placeholder={nextSerialData ? generateRefNumber(nextSerialData.nextSerial) : "DJ/KOL/26/001"}
                        data-testid="input-ref-number"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Date</Label>
                      <Input type="date" value={letterDate} onChange={e => setLetterDate(e.target.value)} data-testid="input-letter-date" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Client (optional)</Label>
                      <Select value={clientName} onValueChange={setClientName}>
                        <SelectTrigger data-testid="select-client"><SelectValue placeholder="Select Client" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {clientNames.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-1">
                    <Label className="text-xs font-semibold text-muted-foreground mb-2 block">TO (Recipient)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Name / Designation</Label>
                        <Input value={toName} onChange={e => setToName(e.target.value)} placeholder="H R Manager" data-testid="input-to-name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">GSTIN (optional)</Label>
                        <Input value={toGstin} onChange={e => setToGstin(e.target.value)} placeholder="19AAACH1004N1ZR" data-testid="input-to-gstin" />
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <Label className="text-xs">Address</Label>
                      <Textarea
                        value={toAddress}
                        onChange={e => setToAddress(e.target.value)}
                        placeholder={"Hindustan Unilever Limited – TEC\n1 Transport Depot Road Kolkata-700088"}
                        rows={3}
                        data-testid="input-to-address"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Subject</Label>
                      <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="QUOTATION FOR SPECIAL MEALS – 4th March 2026" data-testid="input-subject" />
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Letter Body</Label>
                      <Textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        placeholder={"This is the quotation for special Non-Veg & Veg meals for Details given Bellow.\n\nNote: - As per order Quantity we will prepare. So we need purchase order with quantity.\n\nWe will surely provide excellent Service."}
                        rows={8}
                        className="font-serif"
                        data-testid="input-body"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Regards / Signature</Label>
                      <Textarea
                        value={regards}
                        onChange={e => setRegards(e.target.value)}
                        rows={3}
                        data-testid="input-regards"
                      />
                    </div>
                  </div>

                  {editingId && (
                    <div className="flex justify-end">
                      <Badge variant="secondary" className="text-xs">Editing Letter #{editingId}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="space-y-3">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[50px]">#</TableHead>
                        <TableHead className="text-xs">Ref. Number</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">To</TableHead>
                        <TableHead className="text-xs">Subject</TableHead>
                        <TableHead className="text-xs">Client</TableHead>
                        <TableHead className="text-xs w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lettersLoading ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : allLetters.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No saved letters yet</TableCell></TableRow>
                      ) : (
                        allLetters.map((letter) => (
                          <TableRow key={letter.id} data-testid={`row-letter-${letter.id}`}>
                            <TableCell className="text-xs font-mono">{letter.serialNumber}</TableCell>
                            <TableCell className="text-xs font-semibold">{letter.refNumber}</TableCell>
                            <TableCell className="text-xs">{letter.letterDate ? letter.letterDate.split('-').reverse().join('/') : '-'}</TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{letter.toName || '-'}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{letter.subject || '-'}</TableCell>
                            <TableCell className="text-xs max-w-[120px] truncate">{letter.clientName || '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => loadLetter(letter)} data-testid={`button-edit-letter-${letter.id}`}>
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Delete this letter?')) deleteMutation.mutate(letter.id); }} data-testid={`button-delete-letter-${letter.id}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
