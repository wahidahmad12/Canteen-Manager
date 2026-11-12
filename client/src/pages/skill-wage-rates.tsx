import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, IndianRupee } from "lucide-react";
import { Link } from "wouter";
import type { SkillWageRate } from "@shared/schema";
import { SKILL_CATEGORIES } from "@shared/schema";
import { useClientNames } from "@/hooks/use-reports";
import { DEFAULT_WAGE_STATE, fetchSkillWageRates, initialWageState } from "@/lib/skill-wage-rates";

const DEFAULT_STATE = DEFAULT_WAGE_STATE;
const EMPTY_RATES: SkillWageRate[] = [];
const EMPTY_CLIENTS: { name: string; stateName?: string }[] = [];
const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

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
  const [selectedState, setSelectedState] = useState("");
  const [rates, setRates] = useState<Record<string, Record<number, string>>>({});
  const { data: clientData, isLoading: clientsLoading, isError: clientsError, refetch: refetchClients } = useClientNames();
  const clients = clientData ?? EMPTY_CLIENTS;

  const { data: rateData, isLoading, isError, error, refetch } = useQuery<SkillWageRate[]>({
    queryKey: ["/api/skill-wage-rates", selectedYear],
    queryFn: () => fetchSkillWageRates(selectedYear),
  });
  const existingRates = rateData ?? EMPTY_RATES;

  const stateOptions = useMemo(() => {
    const savedStates = existingRates.map(rate => rate.stateName?.trim()).filter((state): state is string => !!state);
    const clientStates = clients.map(client => client.stateName?.trim()).filter((state): state is string => !!state);
    return Array.from(new Set([...INDIAN_STATES_AND_UTS, ...savedStates, ...clientStates])).sort((a, b) => a.localeCompare(b));
  }, [clients, existingRates]);

  useEffect(() => {
    if (!selectedState && !clientsLoading && !isLoading && !clientsError && !isError) {
      setSelectedState(initialWageState(clients, existingRates));
    }
  }, [clients, clientsLoading, clientsError, existingRates, isLoading, isError, selectedState]);

  useEffect(() => {
    const newRates: Record<string, Record<number, string>> = {};
    for (const skill of SKILL_CATEGORIES) {
      newRates[skill] = {};
      for (const m of MONTHS) {
        const stateName = selectedState === DEFAULT_STATE ? "" : selectedState;
        const existing = existingRates.find(r =>
          r.skillCategory === skill &&
          r.month === m.value &&
          (r.stateName || "").trim().toLowerCase() === stateName.trim().toLowerCase()
        );
        newRates[skill][m.value] = existing ? String(existing.dailyRate) : "";
      }
    }
    setRates(newRates);
  }, [existingRates, selectedYear, selectedState]);

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

  const fillJanToJun = (skill: string) => {
    const firstVal = rates[skill]?.[1];
    if (!firstVal) {
      toast({ title: "Enter Jan rate first", variant: "destructive" });
      return;
    }
    setRates(prev => {
      const updated = { ...prev[skill] };
      for (let m = 2; m <= 6; m++) {
        updated[m] = firstVal;
      }
      return { ...prev, [skill]: updated };
    });
  };

  const fillJulToDec = (skill: string) => {
    const julVal = rates[skill]?.[7];
    if (!julVal) {
      toast({ title: "Enter Jul rate first", variant: "destructive" });
      return;
    }
    setRates(prev => {
      const updated = { ...prev[skill] };
      for (let m = 8; m <= 12; m++) {
        updated[m] = julVal;
      }
      return { ...prev, [skill]: updated };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const bulkRates: { stateName: string; skillCategory: string; month: number; year: number; dailyRate: string }[] = [];
      const stateName = selectedState === DEFAULT_STATE ? "" : selectedState.trim();
      for (const skill of SKILL_CATEGORIES) {
        for (const m of MONTHS) {
          const val = rates[skill]?.[m.value];
          if (val && Number(val) > 0) {
            bulkRates.push({ stateName, skillCategory: skill, month: m.value, year: selectedYear, dailyRate: val });
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
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !selectedState || isLoading || isError || clientsError} data-testid="button-save-all">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save All
            </Button>
          </div>
        </div>

        {isLoading || clientsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isError || clientsError ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-destructive" role="alert">
                {isError ? (error instanceof Error ? error.message : "Could not load wage rates.") : "Could not load client states."}
              </p>
              <Button variant="outline" onClick={() => { if (isError) refetch(); if (clientsError) refetchClients(); }}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <Label htmlFor="select-state" className="shrink-0">Applicable state</Label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger id="select-state" className="w-full sm:w-[320px]" data-testid="select-state">
                    <SelectValue placeholder="Select a state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_STATE}>Default / legacy rates</SelectItem>
                    {stateOptions.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Salary generation uses the state configured for the employee's client. Default rates are used only when no rate exists for that state.
                </p>
              </CardContent>
            </Card>
            {selectedState !== DEFAULT_STATE && existingRates.some(rate => !rate.stateName?.trim()) && (
              <p className="text-sm text-muted-foreground">
                Existing rates without a state are under <button className="underline" onClick={() => setSelectedState(DEFAULT_STATE)}>Default / legacy rates</button>.
                Blank state-specific fields use those default rates for salary calculations.
              </p>
            )}
            {SKILL_CATEGORIES.map(skill => (
              <Card key={skill}>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{skill}</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => fillJanToJun(skill)} data-testid={`button-fill-jan-jun-${skill}`}>
                        Fill Jan–Jun
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => fillJulToDec(skill)} data-testid={`button-fill-jul-dec-${skill}`}>
                        Fill Jul–Dec
                      </Button>
                    </div>
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
              Enter the applicable monthly base rates manually; salary and Leave With Wages calculations use the rate for the client's configured state and skill category.
              If no matching state rate is set, the system uses a default/legacy rate and then the employee's individual rate.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
