import { useState, useRef, useEffect, useCallback } from "react";
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
import { loadFaceModels, faceapi, euclideanDistance, FACE_MATCH_THRESHOLD } from "@/lib/face-api-loader";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  Camera, CheckCircle2, Loader2, MapPin, ScanFace, Users,
  AlertTriangle, X, CalendarDays, ClipboardList, RefreshCw,
  Upload, Pencil, Trash2, ChevronRight, Send, Fingerprint
} from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUS_CODES = ["P","A","H","P/HL","HD","WO","CL","SL","EL"];

type ScanStep = "idle" | "loading-models" | "camera" | "detecting" | "matched" | "no-match" | "saving";

function isVideoBlack(video: HTMLVideoElement): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(video, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
    return sum < 1000;
  } catch { return false; }
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

interface MatchedEmployee { id: number; name: string; employeeCode: string; distance: number }

export default function DailyAttendancePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: clients } = useClientNames();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [tab, setTab] = useState<"scan" | "monthly">("scan");
  const [detectingAttempt, setDetectingAttempt] = useState(0);
  const [clientName, setClientName] = useState("");
  const [scanDate, setScanDate] = useState(todayStr());

  // Monthly view
  const [monthViewDate, setMonthViewDate] = useState(() => {
    const n = new Date(); return { month: String(n.getMonth()+1), year: String(n.getFullYear()) };
  });

  // GPS state
  const [locationStatus, setLocationStatus] = useState<"idle"|"checking"|"ok"|"error"|"no-config">("idle");
  const [locationMsg, setLocationMsg] = useState("");
  const [userCoords, setUserCoords] = useState<{lat:number;lng:number}|null>(null);

  // Scan state
  const [scanMode, setScanMode] = useState<"face" | "fingerprint">("face");
  const [scanStep, setScanStep] = useState<ScanStep>("idle");
  const [matchedEmp, setMatchedEmp] = useState<MatchedEmployee | null>(null);
  const [scanStatus, setScanStatus] = useState("P");

  // Fingerprint state
  const [fpEmployeeId, setFpEmployeeId] = useState<string>("");
  const [fpStatus, setFpStatus] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const [fpResult, setFpResult] = useState<any>(null);

  // Data
  const { data: todayLogs, refetch: refetchToday } = useQuery({
    queryKey: ["/api/daily-attendance", clientName, scanDate],
    queryFn: async () => {
      if (!clientName) return [];
      const res = await fetch(`/api/daily-attendance?clientName=${encodeURIComponent(clientName)}&date=${scanDate}`, { credentials:"include" });
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName,
  });

  const { data: monthLogs, refetch: refetchMonth } = useQuery({
    queryKey: ["/api/daily-attendance/month", clientName, monthViewDate.month, monthViewDate.year],
    queryFn: async () => {
      if (!clientName) return [];
      const res = await fetch(`/api/daily-attendance/month?clientName=${encodeURIComponent(clientName)}&month=${monthViewDate.month}&year=${monthViewDate.year}`, { credentials:"include" });
      return res.json() as Promise<any[]>;
    },
    enabled: !!clientName && tab === "monthly",
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

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/daily-attendance", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchToday();
      qc.invalidateQueries({ queryKey: ["/api/daily-attendance"] });
      toast({ title: "Attendance Marked!", description: `${matchedEmp?.name} marked as ${scanStatus}` });
      resetScan();
    },
    onError: (e: any) => {
      if (e.message?.includes("already recorded")) {
        toast({ title: "Already Recorded", description: "Attendance already marked for this employee today.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
      resetScan();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/daily-attendance/${id}`),
    onSuccess: () => { refetchToday(); refetchMonth(); qc.invalidateQueries({ queryKey: ["/api/daily-attendance"] }); },
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/daily-attendance/push-to-muster-roll", {
        clientName, month: Number(monthViewDate.month), year: Number(monthViewDate.year),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Pushed!", description: `${data.pushed} employee(s) pushed to Muster Roll.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

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

  const startFaceScan = async () => {
    if (navigator.permissions) {
      try {
        const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (perm.state === "denied") {
          toast({ title: "Camera Blocked", description: "Camera is blocked. Go to Browser Settings → Site permissions → Camera and allow this site, then reload.", variant: "destructive" });
          return;
        }
      } catch {}
    }
    setScanStep("loading-models");
    try {
      await loadFaceModels();
    } catch {
      toast({ title: "Error", description: "Could not load face models.", variant: "destructive" });
      setScanStep("idle"); return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject();
          videoRef.current.onloadedmetadata = () => videoRef.current!.play().then(resolve).catch(reject);
        });
      }
      setScanStep("camera");
    } catch (err: any) {
      const msg = err?.name === "NotAllowedError" ? "Camera permission denied. Please allow camera access in your browser settings." : err?.name === "NotFoundError" ? "No camera found on this device." : "Could not access camera. Try reloading the page.";
      toast({ title: "Camera Error", description: msg, variant: "destructive" });
      setScanStep("idle");
    }
  };

  const detectAndMatch = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    setDetectingAttempt(0);
    setScanStep("detecting");

    // Give camera stream 1.5 s to fully stabilise on mobile before running inference
    await new Promise<void>(res => setTimeout(res, 1500));

    // Load enrolled descriptors
    let descriptors: { id: number; name: string; employeeCode: string; faceDescriptor: string }[] = [];
    try {
      const res = await fetch(`/api/employees/face-descriptors?clientName=${encodeURIComponent(clientName)}`, { credentials:"include" });
      descriptors = await res.json();
    } catch {
      toast({ title: "Error", description: "Could not load enrolled faces.", variant: "destructive" });
      setScanStep("camera"); return;
    }

    if (descriptors.length === 0) {
      toast({ title: "No Faces Enrolled", description: "No employees have faces enrolled for this client.", variant: "destructive" });
      setScanStep("camera"); return;
    }

    try {
      const attempts: [number, number][] = [[416, 0.3], [320, 0.2], [224, 0.15]];
      let result = null;
      for (let i = 0; i < attempts.length; i++) {
        setDetectingAttempt(i + 1);
        const [inputSize, scoreThreshold] = attempts[i];
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
        result = await faceapi.detectSingleFace(video, options).withFaceLandmarks(true).withFaceDescriptor();
        if (result) break;
        if (i < attempts.length - 1) await new Promise<void>(res => setTimeout(res, 300));
      }
      if (!result) {
        toast({ title: "No Face Detected", description: "Make sure your face is well-lit and centred. Hold still and try again.", variant: "destructive" });
        setScanStep("camera"); return;
      }

      const scanned = result.descriptor;
      let bestMatch: MatchedEmployee | null = null;
      let bestDist = Infinity;

      for (const d of descriptors) {
        try {
          const stored = new Float32Array(JSON.parse(d.faceDescriptor));
          const dist = euclideanDistance(scanned, stored);
          if (dist < bestDist) { bestDist = dist; bestMatch = { id: d.id, name: d.name, employeeCode: d.employeeCode, distance: dist }; }
        } catch { /* skip */ }
      }

      stopCamera();
      if (bestMatch && bestDist < FACE_MATCH_THRESHOLD) {
        setMatchedEmp(bestMatch);
        setScanStep("matched");
      } else {
        setScanStep("no-match");
      }
    } catch {
      toast({ title: "Detection Error", description: "Face detection failed.", variant: "destructive" });
      setScanStep("camera");
    }
  };

  const confirmAttendance = async () => {
    if (!matchedEmp) return;
    setScanStep("saving");
    saveMutation.mutate({
      employeeId: matchedEmp.id,
      clientName,
      attendanceDate: scanDate,
      status: scanStatus,
      scannedLat: userCoords?.lat || null,
      scannedLng: userCoords?.lng || null,
    });
  };

  const resetScan = () => { stopCamera(); setMatchedEmp(null); setScanStep("idle"); };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-indigo-600" /> Daily Attendance
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Fingerprint biometric attendance</p>
          </div>
        </div>

        {/* Client + Date row */}
        <Card>
          <CardContent className="p-3 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Client</Label>
              <Select value={clientName} onValueChange={v => { setClientName(v); setLocationStatus("idle"); setLocationMsg(""); resetScan(); }}>
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

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(["scan","monthly"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab===t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`tab-${t}`}>
              {t === "scan" ? "📷 Scan Today" : "📅 Monthly View"}
            </button>
          ))}
        </div>

        {/* === SCAN TAB === */}
        {tab === "scan" && (
          <div className="space-y-4">
            {!clientName ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground text-sm"><ScanFace className="w-8 h-8 mx-auto mb-2 opacity-40" />Select a client to start scanning</CardContent></Card>
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
                        <Fingerprint className="w-4 h-4 text-indigo-500" /> Fingerprint Attendance
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
                                    {e.name}
                                    {alreadyScannedIds.has(e.id) && " ✓"}
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
        )}

        {/* === MONTHLY TAB === */}
        {tab === "monthly" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-3 flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Month</Label>
                  <Select value={monthViewDate.month} onValueChange={v => setMonthViewDate(p => ({...p, month: v}))}>
                    <SelectTrigger className="w-36" data-testid="select-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year</Label>
                  <Input type="number" value={monthViewDate.year} onChange={e => setMonthViewDate(p => ({...p, year: e.target.value}))} className="w-24" data-testid="input-month-year" />
                </div>
                <Button onClick={() => refetchMonth()} variant="outline" size="sm" data-testid="button-load-month">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
                <Button onClick={() => pushMutation.mutate()} disabled={pushMutation.isPending || !clientName} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 ml-auto" data-testid="button-push-muster">
                  {pushMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Push to Muster Roll
                </Button>
              </CardContent>
            </Card>

            {!clientName ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Select a client to view monthly data</CardContent></Card>
            ) : !monthLogs || monthLogs.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No attendance records for this month
              </CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Employee</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Status</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Time</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">By</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthLogs.map((log: any) => (
                          <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-monthly-${log.id}`}>
                            <td className="px-3 py-2 text-xs">{log.attendance_date}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-xs">{log.employee_name}</div>
                              <div className="text-xs text-muted-foreground">{log.employee_code}</div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge className={`text-xs ${log.status==="P" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                {log.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {log.scanned_at ? new Date(log.scanned_at).toLocaleTimeString() : ""}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{log.scanned_by || ""}</td>
                            <td className="px-3 py-2 text-right">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { deleteMutation.mutate(log.id); refetchMonth(); }} data-testid={`button-delete-monthly-${log.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
