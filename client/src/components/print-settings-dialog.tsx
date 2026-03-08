import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer, CheckSquare, Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PrintEmployee {
  id: number;
  name: string;
  employeeCode?: string;
}

interface PrintSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees?: PrintEmployee[];
  selectedEmployeeIds?: Set<number>;
  onSelectedEmployeeIdsChange?: (ids: Set<number>) => void;
  sections?: { key: string; label: string }[];
  selectedSections?: Set<string>;
  onSelectedSectionsChange?: (keys: Set<string>) => void;
  dateRange?: boolean;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (d: string) => void;
  onDateToChange?: (d: string) => void;
  onPrint: () => void;
  title?: string;
}

export function PrintSettingsDialog({
  open, onOpenChange, employees, selectedEmployeeIds, onSelectedEmployeeIdsChange,
  sections, selectedSections, onSelectedSectionsChange,
  dateRange, dateFrom, dateTo, onDateFromChange, onDateToChange,
  onPrint, title = "Print Settings",
}: PrintSettingsDialogProps) {
  const [search, setSearch] = useState("");

  const filteredEmployees = employees?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.employeeCode || "").toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = employees && selectedEmployeeIds && employees.length === selectedEmployeeIds.size;

  const toggleAll = () => {
    if (!employees || !onSelectedEmployeeIdsChange) return;
    if (allSelected) {
      onSelectedEmployeeIdsChange(new Set());
    } else {
      onSelectedEmployeeIdsChange(new Set(employees.map(e => e.id)));
    }
  };

  const toggleEmployee = (id: number) => {
    if (!selectedEmployeeIds || !onSelectedEmployeeIdsChange) return;
    const next = new Set(selectedEmployeeIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectedEmployeeIdsChange(next);
  };

  const toggleSection = (key: string) => {
    if (!selectedSections || !onSelectedSectionsChange) return;
    const next = new Set(selectedSections);
    if (next.has(key)) next.delete(key); else next.add(key);
    onSelectedSectionsChange(next);
  };

  const handlePrint = () => {
    onOpenChange(false);
    setTimeout(() => onPrint(), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {dateRange && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={dateFrom || ""} onChange={e => onDateFromChange?.(e.target.value)} data-testid="input-print-date-from" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={dateTo || ""} onChange={e => onDateToChange?.(e.target.value)} data-testid="input-print-date-to" />
                </div>
              </div>
            </div>
          )}

          {sections && sections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sections to Print</Label>
              <div className="space-y-1.5">
                {sections.map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`section-${s.key}`}
                      checked={selectedSections?.has(s.key)}
                      onCheckedChange={() => toggleSection(s.key)}
                      data-testid={`checkbox-section-${s.key}`}
                    />
                    <Label htmlFor={`section-${s.key}`} className="text-sm cursor-pointer">{s.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {employees && employees.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Employees ({selectedEmployeeIds?.size || 0}/{employees.length})
                </Label>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs" data-testid="button-toggle-all-employees">
                  {allSelected ? <><Square className="w-3.5 h-3.5 mr-1" /> Deselect All</> : <><CheckSquare className="w-3.5 h-3.5 mr-1" /> Select All</>}
                </Button>
              </div>
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-search-employees"
              />
              <ScrollArea className="h-48 border rounded-md p-2">
                <div className="space-y-1">
                  {filteredEmployees?.map(e => (
                    <div key={e.id} className="flex items-center gap-2 py-0.5">
                      <Checkbox
                        id={`emp-${e.id}`}
                        checked={selectedEmployeeIds?.has(e.id)}
                        onCheckedChange={() => toggleEmployee(e.id)}
                        data-testid={`checkbox-employee-${e.id}`}
                      />
                      <Label htmlFor={`emp-${e.id}`} className="text-sm cursor-pointer flex-1">
                        {e.employeeCode ? <span className="text-muted-foreground mr-1">{e.employeeCode}</span> : null}
                        {e.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-print">Cancel</Button>
          <Button onClick={handlePrint} disabled={employees ? (selectedEmployeeIds?.size || 0) === 0 : false} data-testid="button-confirm-print">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
