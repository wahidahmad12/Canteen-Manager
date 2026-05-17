import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useClientNames } from "@/hooks/use-reports";
import { apiRequest } from "@/lib/queryClient";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  CheckCircle2, Loader2, MapPin, AlertTriangle,
  ClipboardList, RefreshCw, Trash2, Fingerprint
} from "lucide-react";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function DailyAttendancePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: clients } = useClientNames();

  const [clientName, setClientName] = useState("");
  const [scanDate, setScanDate] = useState(todayStr());

  // GPS state
  const [locationStatus, setLocationStatus] = useState<"idle"|"checking"|"ok"|"error"|"no-config">("idle");
  const [locationMsg, setLocationMsg] = useState("");
  const [userCoords, setUserCoords] = useState<{lat:number;lng:number}|null>(null);

  // Fingerprint state
  const [fpEmployeeId, setFpEmployeeId] = useState<string>("");
  const [fpStatus, setFpStatus] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const [fpResult, setFpResult] = useState<any>(null);

  const { data: todayLogs, refetch: refetchToday } = useQuery({
    queryKey: ["/api/daily-attendance", clientName, scanDate],
    queryFn: async () => {
      if (!clientName) return [];
      const res = await fetch(`/api/daily-attendance?clientName=${encodeURIComponent(clientName)}&date=${scanDate}`, { credentials:"include" });
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const { data: clientInfo } = useQuery({
    queryKey: ["/api/clients", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/clients`, { credentials:"include" });
      const all = await res.json() as any[];
      return all.find((c:any) => c.name === clientName);
    },
    enabled: !!clientName,
  });

  const { data: clientEmployees } = useQuery({
    queryKey: ["/api/employees", clientName],
    queryFn: async () => {
      const res = await fetch(`/api/employees?clientName=${encodeURIComponent(clientName)}`, { credentials:"include" });
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/daily-attendance/${id}`),
    onSuccess: () => { refetchToday(); qc.invalidateQueries({ queryKey: ["/api/daily-attendance"] }); },
  });

  const checkLocation = async () => {
    setLocationStatus("checking");
    if (!navigator.geolocation) { setLocationStatus("error"); setLocationMsg("GPS not available"); return; }
    const clientLat = clientInfo?.attendanceLat ? Number(clientInfo.attendanceLat) : null;
    const clientLng = clientInfo?.attendanceLng ? Number(clientInfo.attendanceLng) : null;
    const radius = clientInfo?.attendanceRadius ? Number(clientInfo.attendanceRadius) : 200;
    if (!clientLat || !clientLng) {
      setLocationStatus("no-config");
      setLocationMsg("No location configured for this client — GPS check skipped");
      setUserCoords({ lat: 0, lng: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        const dist = haversineMeters(latitude, longitude, clientLat, clientLng);
        if (dist <= radius) {
          setLocationStatus("ok");
          setLocationMsg(`Within range (${Math.round(dist)}m from site)`);
        } else {
          setLocationStatus("error");
          setLocationMsg(`Too far: ${Math.round(dist)}m away (limit ${radius}m)`);
        }
      },
      (err) => { setLocationStatus("error"); setLocationMsg(err.message); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFingerprintVerify = async () => {
    if (!fpEmployeeId) { toast({ title: "Select Employee", description: "Please select an employee first.", variant: "destructive" }); return; }
    if (!window.PublicKeyCredential) { toast({ title: "Not Supported", description: "Fingerprint authentication is not supported on this device/browser.", variant: "destructive" }); return; }
    setFpStatus("verifying"); setFpResult(null);
    try {
      const challengeRes = await fetch("/api/webauthn/authenticate/challenge", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: Number(fpEmployeeId) }),
      });
      if (!challengeRes.ok) { const e = await challengeRes.json(); throw new Error(e.message); }
      const options = await challengeRes.json();
      const authResponse = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: Number(fpEmployeeId),
          authenticationResponse: authResponse,
          clientName,
          attendanceDate: scanDate,
          scannedLat: userCoords?.lat ?? null,
          scannedLng: userCoords?.lng ?? null,
        }),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(result.message);
      setFpResult(result);
      setFpStatus("done");
      refetchToday();
      qc.invalidateQueries({ queryKey: ["/api/daily-attendance"] });
      toast({ title: "Attendance Marked!", description: `${result.log?.employee_name || "Employee"} marked present via fingerprint.` });
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setFpStatus("idle"); toast({ title: "Cancelled", description: "Fingerprint verification was cancelled.", variant: "destructive" });
      } else if (err.message?.includes("already recorded")) {
        setFpStatus("done"); toast({ title: "Already Marked", description: "Attendance already recorded today.", variant: "destructive" });
      } else {
        setFpStatus("error"); toast({ title: "Verification Failed", description: err.message || "Could not verify fingerprint.", variant: "destructive" });
      }
    }
  };

  const canScan = locationStatus === "ok" || locationStatus === "no-config";
  const alreadyScannedIds = new Set((todayLogs || []).map((l:any) => l.employee_id));

  return (
    <Layout>
      <div className="space-y-4 max-w-2xl mx-auto">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-indigo-600" /> Fingerprint Attendance
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Mark daily attendance with biometric fingerprint</p>
        </div>

        {/* Client + Date row */}
        <Card>
          <CardContent className="p-3 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Client</Label>
              <Select value={clientName} onValueChange={v => { setClientName(v); setLocationStatus("idle"); setLocationMsg(""); setFpStatus("idle"); setFpResult(null); setFpEmployeeId(""); }}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {(clients||[]).map((c:any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={scanDate} onChange={e => setScanDate(e.target.value)} data-testid="input-scan-date" />
            </div>
          </CardContent>
        </Card>

        {!clientName ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              <Fingerprint className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Select a client to start fingerprint attendance
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Location Check */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-medium">Location Check</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {locationStatus === "ok" && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✓ Verified</Badge>}
                    {locationStatus === "no-config" && <Badge variant="outline" className="text-amber-600 border-amber-300">Skipped</Badge>}
                    {locationStatus === "error" && <Badge variant="destructive">Failed</Badge>}
                    {locationStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-violet-500" />}
                    <Button size="sm" variant="outline" onClick={checkLocation} disabled={locationStatus==="checking"} data-testid="button-check-location">
                      {locationStatus === "idle" ? "Check GPS" : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                {locationMsg && (
                  <p className={`text-xs mt-2 ${locationStatus==="error" ? "text-red-500" : "text-muted-foreground"}`}>{locationMsg}</p>
                )}
              </CardContent>
            </Card>

            {/* Fingerprint Scanner */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-indigo-500" /> Fingerprint Scan
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {!canScan ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-xl">
                    <AlertTriangle className="w-7 h-7 mx-auto mb-2 text-amber-500 opacity-70" />
                    Verify your GPS location before scanning
                  </div>
                ) : fpStatus === "done" && fpResult ? (
                  <div className="text-center py-4 space-y-2">
                    <div className="w-14 h-14 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-medium text-sm">{fpResult.log?.employee_name}</p>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✓ Attendance Marked via Fingerprint</Badge>
                    <div className="pt-2">
                      <Button size="sm" variant="outline" onClick={() => { setFpStatus("idle"); setFpResult(null); setFpEmployeeId(""); }} data-testid="button-fp-reset">
                        Scan Next Employee
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Select Employee</Label>
                      <Select value={fpEmployeeId} onValueChange={v => { setFpEmployeeId(v); setFpStatus("idle"); setFpResult(null); }}>
                        <SelectTrigger data-testid="select-fp-employee">
                          <SelectValue placeholder="Choose employee…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(clientEmployees || []).filter((e:any) => e.isActive).map((e:any) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.name}{alreadyScannedIds.has(e.id) ? " ✓" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {fpEmployeeId && alreadyScannedIds.has(Number(fpEmployeeId)) && (
                      <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Already marked today
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-3 py-4 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl px-4">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        {fpStatus === "verifying" ? <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /> : <Fingerprint className="w-7 h-7 text-indigo-500" />}
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium">{fpStatus === "verifying" ? "Verifying…" : "Verify with Fingerprint"}</p>
                        <p className="text-xs text-muted-foreground">Touch your fingerprint sensor when prompted</p>
                      </div>
                      <Button onClick={handleFingerprintVerify} disabled={fpStatus === "verifying" || !fpEmployeeId} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11" data-testid="button-fp-verify">
                        {fpStatus === "verifying" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                        {fpStatus === "verifying" ? "Verifying…" : "Verify Fingerprint & Mark Attendance"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Today's Log */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Today's Log
                  {todayLogs && <span className="ml-auto text-xs font-normal text-muted-foreground">{todayLogs.length} scanned</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!todayLogs || todayLogs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No attendance scanned yet today</p>
                ) : (
                  <div className="divide-y">
                    {todayLogs.map((log: any) => (
                      <div key={log.id} className="flex items-center gap-3 px-3 py-2.5" data-testid={`row-log-${log.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{log.employee_name}</p>
                          <p className="text-xs text-muted-foreground">{log.employee_code} · {log.scanned_at ? new Date(log.scanned_at).toLocaleTimeString() : ""}</p>
                        </div>
                        <Badge className={`text-xs ${log.status==="P" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {log.status}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(log.id)} data-testid={`button-delete-log-${log.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
