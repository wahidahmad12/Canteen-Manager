import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import { isAuto, restoreShare, withEffectiveShares } from "./nomination-shares";

// Import your printable forms
import FormVIIWages from "./FormVIIWages";
import FormIIPF from "./FormIIPF";
import FormIIIGratuity from "./FormIIIGratuity";

export default function NominationManager() {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [formType, setFormType] = useState<string>("FORM_VII_WAGES");
  const [nominees, setNominees] = useState<any[]>([]);
  const [loadingNominees, setLoadingNominees] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  
  // Nominee form states
  const [newNominee, setNewNominee] = useState({ name: "", address: "", relationship: "", dateOfBirth: "", sharePercentage: "", guardianName: "" });

  // Fetch Employees
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const selectedEmployee = employees?.find((e: any) => e.id.toString() === selectedEmployeeId);

  // Load saved nominees of the selected employee (latest saved nomination)
  useEffect(() => {
    setEditIndex(null);
    setNewNominee(emptyNominee);
    if (!selectedEmployeeId) { setNominees([]); return; }
    setNominees([]);
    setLoadingNominees(true);
    setLoadFailed(false);
    let cancelled = false;
    (async () => {
      try {
        const listRes = await apiRequest("GET", `/api/nominations?employeeId=${selectedEmployeeId}`);
        const list: any[] = await listRes.json();
        const latest = list.map((r) => r.nomination).sort((a, b) => b.id - a.id)[0];
        if (!latest) { if (!cancelled) setNominees([]); return; }
        const detRes = await apiRequest("GET", `/api/nominations/${latest.id}`);
        const det = await detRes.json();
        if (!cancelled) {
          setNominees((det.nominees || []).map((n: any) => ({ ...restoreShare(n), dateOfBirth: n.dateOfBirth ? String(n.dateOfBirth).split("T")[0] : "" })));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadFailed(true);
          console.error("Unable to load nominees:", error);
          toast({ title: "Unable to load nominees", description: "Existing nominees could not be loaded. Please try again.", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoadingNominees(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedEmployeeId, loadAttempt]);

  const emptyNominee = { name: "", address: "", relationship: "", dateOfBirth: "", sharePercentage: "", guardianName: "" };
  const isoToDmy = (s?: string | null) => {
    if (!s) return "";
    const [y, m, d] = String(s).split("T")[0].split("-");
    return y && m && d ? `${d}-${m}-${y}` : String(s);
  };
  // Returns "" for blank, ISO date for valid DD-MM-YYYY, null if invalid
  const dmyToIso = (s: string): string | null => {
    const v = (s || "").trim();
    if (!v) return "";
    const mt = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (!mt) return null;
    const [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const effectiveNominees = withEffectiveShares(nominees);
  const totalShare = Math.round(effectiveNominees.reduce((s, n) => s + Number(n.sharePercentage || 0), 0) * 100) / 100;

  const validateList = (list: any[]): string | null => {
    const fixedSum = list.filter(n => !isAuto(n)).reduce((s, n) => s + Number(n.sharePercentage), 0);
    if (list.some(n => !isAuto(n) && (isNaN(Number(n.sharePercentage)) || Number(n.sharePercentage) <= 0))) return "Share % must be greater than 0";
    if (fixedSum > 100) return `Total share cannot exceed 100% (currently ${fixedSum}%)`;
    if (list.some(isAuto) && fixedSum >= 100) return "No share left (100% already given) for nominees without share %";
    return null;
  };

  const handleAddNominee = () => {
    if (!selectedEmployeeId) { toast({ title: "Select an employee first", variant: "destructive" }); return; }
    if (!newNominee.name.trim()) { toast({ title: "Nominee name is required", variant: "destructive" }); return; }
    const dobIso = dmyToIso(newNominee.dateOfBirth);
    if (dobIso === null) { toast({ title: "Invalid date", description: "Date of Birth DD-MM-YYYY format mein likho", variant: "destructive" }); return; }
    const entry = { ...newNominee, dateOfBirth: dobIso, sharePercentage: newNominee.sharePercentage === "" ? "" : Number(newNominee.sharePercentage) };
    const next = editIndex === null ? [...nominees, entry] : nominees.map((n, i) => (i === editIndex ? entry : n));
    const err = validateList(next);
    if (err) { toast({ title: "Invalid share", description: err, variant: "destructive" }); return; }
    saveNomination.mutate({ next, clearEditor: true });
  };

  const handleEditNominee = (index: number) => {
    const n = nominees[index];
    setNewNominee({
      name: n.name || "", address: n.address || "", relationship: n.relationship || "",
      dateOfBirth: isoToDmy(n.dateOfBirth), guardianName: n.guardianName || "",
      sharePercentage: isAuto(n) ? "" : String(n.sharePercentage),
    });
    setEditIndex(index);
  };

  const handleRemoveNominee = (index: number) => {
    const next = nominees.filter((_, i) => i !== index);
    saveNomination.mutate({ next, clearEditor: true });
  };
  const saveNomination = useMutation({
    mutationFn: async ({ next }: { next: any[]; clearEditor: boolean }) => {
      const payload = {
        nomination: {
          employeeId: Number(selectedEmployeeId),
          formType: formType,
          dateOfSubmission: new Date().toISOString().split('T')[0],
          place: "Kolkata",
          // Add other defaults as needed
        },
        nominees: withEffectiveShares(next)
      };
      await apiRequest("POST", "/api/nominations", payload);
    },
    onSuccess: (_data, { next, clearEditor }) => {
      setNominees(next);
      if (clearEditor) {
        setNewNominee(emptyNominee);
        setEditIndex(null);
      }
      toast({ title: "Success", description: "Nomination saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save nomination", variant: "destructive" });
    }
  });
  const busy = loadingNominees || saveNomination.isPending;

  // Data to pass to printable forms
  const printData = {
    employee: selectedEmployee || {},
    nomination: {
      maritalStatus: selectedEmployee?.maritalStatus || "",
      religion: selectedEmployee?.religion || "",
      place: "Kolkata",
    },
    nominees: effectiveNominees
  };

  return (
    <div className="space-y-6">
      {/* UI Controls - Will be hidden when printing */}
      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4 print:hidden">
        <h2 className="text-xl font-bold">Manage Nominations (Forms II, III, VII)</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Select Employee</Label>
            <Select value={selectedEmployeeId} disabled={busy} onValueChange={(id) => { setNominees([]); setLoadingNominees(true); setSelectedEmployeeId(id); }}>
              <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
              <SelectContent>
                {employees?.map((emp: any) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name} ({emp.employeeId || emp.id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Select Form Type</Label>
            <Select value={formType} disabled={busy} onValueChange={setFormType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FORM_VII_WAGES">Form VII - Wages</SelectItem>
                <SelectItem value="FORM_II_PF">Form II - PF & Pension</SelectItem>
                <SelectItem value="FORM_III_GRATUITY">Form III - Gratuity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Add Nominee Section */}
        <fieldset disabled={busy || loadFailed} className="border p-4 rounded bg-gray-50 mt-4 space-y-3">
          <h3 className="font-semibold">Add Nominee</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input placeholder="Name" value={newNominee.name} onChange={e => setNewNominee({...newNominee, name: e.target.value})} />
            <Input placeholder="Relationship" value={newNominee.relationship} onChange={e => setNewNominee({...newNominee, relationship: e.target.value})} />
            <Input placeholder="Share % (blank = auto equal split)" type="number" value={newNominee.sharePercentage} onChange={e => setNewNominee({...newNominee, sharePercentage: e.target.value})} />
            <Input placeholder="DOB (DD-MM-YYYY)" value={newNominee.dateOfBirth} onChange={e => setNewNominee({...newNominee, dateOfBirth: e.target.value})} />
            <Input placeholder="Address" value={newNominee.address} onChange={e => setNewNominee({...newNominee, address: e.target.value})} />
            <Input placeholder="Guardian (if minor)" value={newNominee.guardianName} onChange={e => setNewNominee({...newNominee, guardianName: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAddNominee} variant="secondary">{editIndex === null ? "Add & Save Nominee" : "Update & Save Nominee"}</Button>
            {editIndex !== null && <Button type="button" variant="outline" onClick={() => { setEditIndex(null); setNewNominee(emptyNominee); }}>Cancel Edit</Button>}
          </div>
        </fieldset>
        {loadingNominees && <p className="text-sm">Loading saved nominees...</p>}
        {loadFailed && <div className="text-sm text-red-600">Could not load saved nominees. <Button type="button" variant="outline" onClick={() => setLoadAttempt(n => n + 1)}>Retry</Button></div>}

        {/* Show added nominees list */}
        {nominees.length > 0 && (
          <div className="text-sm">
            <strong>Added Nominees:</strong>
            <ul className="list-disc pl-5 mt-2">
              {effectiveNominees.map((n, idx) => (
                <li key={idx}>
                  {n.name} ({n.relationship}) - {n.sharePercentage}%{isAuto(nominees[idx]) ? " (auto)" : ""}
                  <button type="button" disabled={busy || loadFailed} onClick={() => handleEditNominee(idx)} className="text-blue-600 ml-4 text-xs font-bold">[Edit]</button>
                  <button type="button" disabled={busy || loadFailed} onClick={() => handleRemoveNominee(idx)} className="text-red-500 ml-3 text-xs font-bold">[X] Remove</button>
                </li>
              ))}
            </ul>
            <p className={`mt-2 font-semibold ${totalShare > 100 ? "text-red-600" : totalShare === 100 ? "text-green-600" : "text-amber-600"}`}>Total share: {totalShare}% / 100%</p>
          </div>
        )}

        <Button 
          className="mt-4 w-full" 
          disabled={!selectedEmployeeId || nominees.length === 0 || busy || loadFailed}
          onClick={() => saveNomination.mutate({ next: nominees, clearEditor: false })}
        >
          {saveNomination.isPending ? "Saving..." : "Save Nomination to Database"}
        </Button>
      </div>

      {/* Printable Area - Renders based on selection */}
      <div className="mt-8">
        {selectedEmployeeId ? (
          <>
            {formType === "FORM_VII_WAGES" && <FormVIIWages data={printData} />}
            {formType === "FORM_II_PF" && <FormIIPF data={printData} />}
            {formType === "FORM_III_GRATUITY" && <FormIIIGratuity data={printData} />}
          </>
        ) : (
          <div className="text-center p-8 text-gray-500 border rounded print:hidden">
            Please select an employee to view and print the form.
          </div>
        )}
      </div>
    </div>
  );
}
