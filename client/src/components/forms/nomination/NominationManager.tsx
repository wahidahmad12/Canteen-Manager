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

  const handleAddNominee = () => {
    if (!newNominee.name || !newNominee.sharePercentage) return;
    setNominees([...nominees, { ...newNominee, sharePercentage: Number(newNominee.sharePercentage) }]);
    setNewNominee({ name: "", address: "", relationship: "", dateOfBirth: "", sharePercentage: "", guardianName: "" }); // reset
  };

  const handleRemoveNominee = (index: number) => {
    const updated = [...nominees];
    updated.splice(index, 1);
    setNominees(updated);
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
        nominees: nominees
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
    nomination: { maritalStatus: "Married", place: "Kolkata" }, // You can add inputs for these later
    nominees: nominees
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
            <Input placeholder="Share % (e.g. 100)" type="number" value={newNominee.sharePercentage} onChange={e => setNewNominee({...newNominee, sharePercentage: e.target.value})} />
            <Input placeholder="DOB (YYYY-MM-DD)" value={newNominee.dateOfBirth} onChange={e => setNewNominee({...newNominee, dateOfBirth: e.target.value})} />
            <Input placeholder="Address" value={newNominee.address} onChange={e => setNewNominee({...newNominee, address: e.target.value})} />
            <Input placeholder="Guardian (if minor)" value={newNominee.guardianName} onChange={e => setNewNominee({...newNominee, guardianName: e.target.value})} />
          </div>
          <Button type="button" onClick={handleAddNominee} variant="secondary">Add to List</Button>
        </div>

        {/* Show added nominees list */}
        {nominees.length > 0 && (
          <div className="text-sm">
            <strong>Added Nominees:</strong>
            <ul className="list-disc pl-5 mt-2">
              {nominees.map((n, idx) => (
                <li key={idx}>
                  {n.name} ({n.relationship}) - {n.sharePercentage}% 
                  <button onClick={() => handleRemoveNominee(idx)} className="text-red-500 ml-4 text-xs font-bold">[X] Remove</button>
                </li>
              ))}
            </ul>
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
