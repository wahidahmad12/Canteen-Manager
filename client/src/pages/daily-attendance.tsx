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
import {
  Camera, CheckCircle2, Loader2, MapPin, ScanFace, Users,
  AlertTriangle, X, CalendarDays, ClipboardList, RefreshCw,
  Upload, Pencil, Trash2, ChevronRight, Send
} from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUS_CODES = ["P","A","H","P/HL","HD","WO","CL","SL","EL"];

type ScanStep = "idle" | "loading-models" | "camera" | "detecting" | "matched" | "no-match" | "saving";

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
  const [scanStep, setScanStep] = useState<ScanStep>("idle");
  const [matchedEmp, setMatchedEmp] = useState<MatchedEmployee | null>(null);
  const [scanStatus, setScanStatus] = useState("P");

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
    setScanStep("detecting");

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
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
      const result = await faceapi.detectSingleFace(videoRef.current, options).withFaceLandmarks(true).withFaceDescriptor();
      if (!result) {
        toast({ title: "No Face Detected", description: "Position your face clearly and try again.", variant: "destructive" });
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

  const canScan = locationStatus === "ok" || locationStatus === "no-config";

  const alreadyScannedIds = new Set((todayLogs || []).map((l:any) => l.employee_id));

  return (
    <Layout>
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-violet-600" /> Daily Attendance
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Face recognition attendance scanner</p>
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

                {/* Face Scanner */}
                {!canScan ? (
                  <Card className="border-dashed">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500 opacity-70" />
                      Verify your GPS location before scanning
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Camera className="w-4 h-4 text-violet-500" /> Face Scanner
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                      {scanStep === "idle" && (
                        <div className="text-center py-8 border-2 border-dashed border-violet-200 dark:border-violet-800 rounded-xl">
                          <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-3">
                            <Camera className="w-8 h-8 text-violet-500" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">Open camera to scan employee face</p>
                          <Button onClick={startFaceScan} className="bg-violet-600 hover:bg-violet-700 text-white gap-2" data-testid="button-start-scan">
                            <Camera className="w-4 h-4" /> Open Camera
                          </Button>
                        </div>
                      )}

                      {scanStep === "loading-models" && (
                        <div className="flex flex-col items-center gap-2 py-8">
                          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                          <p className="text-sm text-muted-foreground">Loading face models…</p>
                        </div>
                      )}

                      {(scanStep === "camera" || scanStep === "detecting") && (
                        <div className="space-y-3">
                          <div className="relative rounded-xl overflow-hidden bg-black">
                            <video ref={videoRef} autoPlay muted playsInline className="w-full block" style={{ maxHeight: 280 }} />
                            {scanStep === "detecting" && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-white" />
                                <p className="text-white text-sm">Scanning face…</p>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={resetScan} className="flex-1" data-testid="button-cancel-scan">
                              <X className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                            <Button onClick={detectAndMatch} disabled={scanStep==="detecting"} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white gap-1.5" data-testid="button-detect">
                              {scanStep==="detecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
                              Scan Face
                            </Button>
                          </div>
                        </div>
                      )}

                      {scanStep === "no-match" && (
                        <div className="text-center py-8 space-y-4">
                          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <X className="w-8 h-8 text-red-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-red-600">Face Not Recognised</p>
                            <p className="text-xs text-muted-foreground mt-1">No enrolled employee matched. Ask admin to enrol this face.</p>
                          </div>
                          <Button variant="outline" onClick={resetScan} data-testid="button-retry">
                            <RefreshCw className="w-4 h-4 mr-1.5" /> Try Again
                          </Button>
                        </div>
                      )}

                      {scanStep === "matched" && matchedEmp && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-green-800 dark:text-green-300">{matchedEmp.name}</p>
                              <p className="text-xs text-green-600 dark:text-green-400">{matchedEmp.employeeCode} · Score: {(100 - matchedEmp.distance * 100).toFixed(0)}%</p>
                            </div>
                          </div>

                          {alreadyScannedIds.has(matchedEmp.id) && (
                            <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 text-amber-700 dark:text-amber-400 text-xs">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              Already marked today — will overwrite if you confirm
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <Label className="text-sm w-20 shrink-0">Status</Label>
                            <Select value={scanStatus} onValueChange={setScanStatus}>
                              <SelectTrigger className="flex-1" data-testid="select-scan-status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_CODES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex gap-2">
                            <Button variant="outline" onClick={resetScan} className="flex-1" data-testid="button-cancel-confirm">
                              <X className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                            <Button onClick={confirmAttendance} disabled={saveMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5" data-testid="button-confirm-attendance">
                              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              Confirm
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

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
