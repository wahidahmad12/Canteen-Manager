import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Import your printable forms
import FormVIIWages from "./FormVIIWages";
import FormIIPF from "./FormIIPF";
import FormIIIGratuity from "./FormIIIGratuity";

export default function NominationManager() {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [formType, setFormType] = useState<string>("FORM_VII_WAGES");
  const [nominees, setNominees] = useState<any[]>([]);
  
  // Nominee form states
  const [newNominee, setNewNominee] = useState({ name: "", address: "", relationship: "", dateOfBirth: "", sharePercentage: "", guardianName: "" });

  // Fetch Employees
  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
  });

  const selectedEmployee = employees?.find((e: any) => e.id.toString() === selectedEmployeeId);

  const emptyNominee = { name: "", address: "", relationship: "", dateOfBirth: "", sharePercentage: "", guardianName: "" };
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const isAuto = (n: any) => n.sharePercentage === "" || n.sharePercentage === null || n.sharePercentage === undefined;

  // Nominees without an explicit share split the remaining percentage equally
  const withEffectiveShares = (list: any[]) => {
    const fixedSum = list.filter(n => !isAuto(n)).reduce((s, n) => s + Number(n.sharePercentage), 0);
    const autoCount = list.filter(isAuto).length;
    const remaining = Math.max(0, 100 - fixedSum);
    let given = 0;
    let seen = 0;
    return list.map(n => {
      if (!isAuto(n)) return { ...n, sharePercentage: Number(n.sharePercentage) };
      seen++;
      const share = seen === autoCount
        ? Math.round((remaining - given) * 100) / 100
        : Math.floor((remaining / autoCount) * 100) / 100;
      given += share;
      return { ...n, sharePercentage: share };
    });
  };

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
    if (!newNominee.name.trim()) return;
    const entry = { ...newNominee, sharePercentage: newNominee.sharePercentage === "" ? "" : Number(newNominee.sharePercentage) };
    const next = editIndex === null ? [...nominees, entry] : nominees.map((n, i) => (i === editIndex ? entry : n));
    const err = validateList(next);
    if (err) { toast({ title: "Invalid share", description: err, variant: "destructive" }); return; }
    setNominees(next);
    setNewNominee(emptyNominee);
    setEditIndex(null);
  };

  const handleEditNominee = (index: number) => {
    const n = nominees[index];
    setNewNominee({
      name: n.name || "", address: n.address || "", relationship: n.relationship || "",
      dateOfBirth: n.dateOfBirth || "", guardianName: n.guardianName || "",
      sharePercentage: isAuto(n) ? "" : String(n.sharePercentage),
    });
    setEditIndex(index);
  };

  const handleRemoveNominee = (index: number) => {
    setNominees(nominees.filter((_, i) => i !== index));
    if (editIndex === index) { setEditIndex(null); setNewNominee(emptyNominee); }
  };
  const saveNomination = useMutation({
    mutationFn: async () => {
      const payload = {
        nomination: {
          employeeId: Number(selectedEmployeeId),
          formType: formType,
          dateOfSubmission: new Date().toISOString().split('T')[0],
          place: "Kolkata",
          // Add other defaults as needed
        },
        nominees: effectiveNominees
      };
      await apiRequest("POST", "/api/nominations", payload);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Nomination saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save nomination", variant: "destructive" });
    }
  });

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
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
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
            <Select value={formType} onValueChange={setFormType}>
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
        <div className="border p-4 rounded bg-gray-50 mt-4 space-y-3">
          <h3 className="font-semibold">Add Nominee</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input placeholder="Name" value={newNominee.name} onChange={e => setNewNominee({...newNominee, name: e.target.value})} />
            <Input placeholder="Relationship" value={newNominee.relationship} onChange={e => setNewNominee({...newNominee, relationship: e.target.value})} />
            <Input placeholder="Share % (blank = auto equal split)" type="number" value={newNominee.sharePercentage} onChange={e => setNewNominee({...newNominee, sharePercentage: e.target.value})} />
            <Input placeholder="DOB (YYYY-MM-DD)" value={newNominee.dateOfBirth} onChange={e => setNewNominee({...newNominee, dateOfBirth: e.target.value})} />
            <Input placeholder="Address" value={newNominee.address} onChange={e => setNewNominee({...newNominee, address: e.target.value})} />
            <Input placeholder="Guardian (if minor)" value={newNominee.guardianName} onChange={e => setNewNominee({...newNominee, guardianName: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAddNominee} variant="secondary">{editIndex === null ? "Add to List" : "Update Nominee"}</Button>
            {editIndex !== null && <Button type="button" variant="outline" onClick={() => { setEditIndex(null); setNewNominee(emptyNominee); }}>Cancel Edit</Button>}
          </div>
        </div>

        {/* Show added nominees list */}
        {nominees.length > 0 && (
          <div className="text-sm">
            <strong>Added Nominees:</strong>
            <ul className="list-disc pl-5 mt-2">
              {effectiveNominees.map((n, idx) => (
                <li key={idx}>
                  {n.name} ({n.relationship}) - {n.sharePercentage}%{isAuto(nominees[idx]) ? " (auto)" : ""}
                  <button onClick={() => handleEditNominee(idx)} className="text-blue-600 ml-4 text-xs font-bold">[Edit]</button>
                  <button onClick={() => handleRemoveNominee(idx)} className="text-red-500 ml-3 text-xs font-bold">[X] Remove</button>
                </li>
              ))}
            </ul>
            <p className={`mt-2 font-semibold ${totalShare > 100 ? "text-red-600" : totalShare === 100 ? "text-green-600" : "text-amber-600"}`}>Total share: {totalShare}% / 100%</p>
          </div>
        )}

        <Button 
          className="mt-4 w-full" 
          disabled={!selectedEmployeeId || nominees.length === 0 || saveNomination.isPending} 
          onClick={() => saveNomination.mutate()}
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
