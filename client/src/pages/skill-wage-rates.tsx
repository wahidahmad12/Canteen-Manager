import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, IndianRupee, Trash2 } from "lucide-react";
import { Link } from "wouter";
import type { SkillWageRate } from "@shared/schema";
import { SKILL_CATEGORIES } from "@shared/schema";

const MONTHS = [
  { value: 1, label: "Jan" }, { value: 2, label: "Feb" }, { value: 3, label: "Mar" },
  { value: 4, label: "Apr" }, { value: 5, label: "May" }, { value: 6, label: "Jun" },
  { value: 7, label: "Jul" }, { value: 8, label: "Aug" }, { value: 9, label: "Sep" },
  { value: 10, label: "Oct" }, { value: 11, label: "Nov" }, { value: 12, label: "Dec" },
];

export default function SkillWageRatesPage() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [rates, setRates] = useState<Record<string, Record<number, string>>>({});

  const { data: existingRates = [], isLoading } = useQuery<SkillWageRate[]>({
    queryKey: ["/api/skill-wage-rates", selectedYear],
    queryFn: () => fetch(`/api/skill-wage-rates?year=${selectedYear}`, { credentials: "include" }).then(r => r.json()),
  });

  useEffect(() => {
    const newRates: Record<string, Record<number, string>> = {};
    for (const skill of SKILL_CATEGORIES) {
      newRates[skill] = {};
      for (const m of MONTHS) {
        const existing = existingRates.find(r => r.skillCategory === skill && r.month === m.value);
        newRates[skill][m.value] = existing ? String(existing.dailyRate) : "";
      }
    }
    setRates(newRates);
  }, [existingRates, selectedYear]);

  const handleYearChange = (y: number) => {
    setSelectedYear(y);
  };

  const updateRate = (skill: string, month: number, value: string) => {
    setRates(prev => ({
      ...prev,
      [skill]: { ...prev[skill], [month]: value },
    }));
  };

  const copyFromPrev = (skill: string, month: number) => {
    const prevMonth = month - 1;
    if (prevMonth >= 1 && rates[skill]?.[prevMonth]) {
      updateRate(skill, month, rates[skill][prevMonth]);
    }
  };

  const fillAllMonths = (skill: string) => {
    const firstVal = rates[skill]?.[1];
    if (!firstVal) {
      toast({ title: "Enter Jan rate first", variant: "destructive" });
      return;
    }
    setRates(prev => {
      const updated = { ...prev[skill] };
      for (let m = 2; m <= 12; m++) {
        if (!updated[m]) updated[m] = firstVal;
      }
      return { ...prev, [skill]: updated };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const bulkRates: any[] = [];
      for (const skill of SKILL_CATEGORIES) {
        for (const m of MONTHS) {
          const val = rates[skill]?.[m.value];
          if (val && Number(val) > 0) {
            bulkRates.push({ skillCategory: skill, month: m.value, year: selectedYear, dailyRate: val });
          }
        }
      }
      return apiRequest("POST", "/api/skill-wage-rates/bulk", { rates: bulkRates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skill-wage-rates", selectedYear] });
      toast({ title: `Wage rates saved for ${selectedYear}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const years: number[] = [];
  for (let y = currentYear - 3; y <= currentYear + 2; y++) years.push(y);

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-[1200px] mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/salary">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-title">
                <IndianRupee className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                Skill-wise Base Wage Rates
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Set daily wage rates by skill category, month & year</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={String(selectedYear)} onValueChange={v => handleYearChange(Number(v))}>
              <SelectTrigger className="w-[100px]" data-testid="select-year"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-all">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save All
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {SKILL_CATEGORIES.map(skill => (
              <Card key={skill}>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{skill}</CardTitle>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => fillAllMonths(skill)} data-testid={`button-fill-${skill}`}>
                      Fill All from Jan
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {MONTHS.map(m => (
                            <th key={m.value} className="text-center text-xs font-medium text-muted-foreground px-1 pb-1" style={{ minWidth: 70 }}>{m.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {MONTHS.map(m => (
                            <td key={m.value} className="px-1 py-0.5">
                              <Input
                                className="text-center text-sm"
                                placeholder="0"
                                value={rates[skill]?.[m.value] || ""}
                                onChange={e => updateRate(skill, m.value, e.target.value)}
                                data-testid={`input-rate-${skill}-${m.value}`}
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              These rates are used in Salary Register generation and Leave With Wages calculations. 
              When a salary is generated for a month/year, the system looks up the daily rate from this table based on the employee's skill category. 
              If no rate is set, it falls back to the employee's individual rate from Employee Master.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
