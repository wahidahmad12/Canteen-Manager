import { useState, useEffect } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, CheckCircle2, X, ChevronLeft, Clock, CalendarDays, Users } from "lucide-react";
import logoImg from "@assets/logo1_1771660912341.png";

type KioskStep = "select-client" | "select-employee" | "verify" | "success" | "error";

export default function AttendanceKiosk() {
  const [step, setStep] = useState<KioskStep>("select-client");
  const [clients, setClients] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successName, setSuccessName] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [todayLogs, setTodayLogs] = useState<Set<number>>(new Set());

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch("/api/kiosk/clients").then(r => r.json()).then(setClients).catch(() => {});
    const tick = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateStr(now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    fetch(`/api/kiosk/employees?clientName=${encodeURIComponent(selectedClient)}`)
      .then(r => r.json()).then(setEmployees).catch(() => {});
    fetch(`/api/kiosk/today-logs?clientName=${encodeURIComponent(selectedClient)}&date=${today}`)
      .then(r => r.json()).then((logs: any[]) => setTodayLogs(new Set(logs.map((l: any) => l.employee_id))))
      .catch(() => {});
  }, [selectedClient, today]);

  useEffect(() => {
    if (step === "success") {
      const t = setTimeout(() => {
        setStep("select-employee");
        setSelectedEmployee(null);
        setSuccessName("");
        fetch(`/api/kiosk/today-logs?clientName=${encodeURIComponent(selectedClient)}&date=${today}`)
          .then(r => r.json()).then((logs: any[]) => setTodayLogs(new Set(logs.map((l: any) => l.employee_id))))
          .catch(() => {});
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [step, selectedClient, today]);

  const handleClientSelect = (name: string) => {
    setSelectedClient(name);
    setStep("select-employee");
    setSelectedEmployee(null);
  };

  const handleEmployeeSelect = (emp: any) => {
    setSelectedEmployee(emp);
    setStep("verify");
    setErrorMsg("");
  };

  const handleVerify = async () => {
    if (!selectedEmployee) return;
    setVerifying(true);
    setErrorMsg("");
    try {
      const challengeRes = await fetch("/api/kiosk/webauthn/challenge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployee.id }),
      });
      if (!challengeRes.ok) { const e = await challengeRes.json(); throw new Error(e.message); }
      const options = await challengeRes.json();
      const authResponse = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/kiosk/webauthn/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployee.id, authenticationResponse: authResponse, clientName: selectedClient, attendanceDate: today }),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(result.message);
      setSuccessName(selectedEmployee.name);
      setStep("success");
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setStep("verify");
      } else {
        setErrorMsg(err.message || "Verification failed. Please try again.");
        setStep("error");
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col relative overflow-hidden">
      <div className="absolute top-[-100px] left-[-80px] w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-60px] w-72 h-72 rounded-full bg-violet-400/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="DJ Hospitality" className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/20 shadow-lg" />
          <div>
            <p className="text-white font-semibold text-sm leading-tight">DJ Hospitality</p>
            <p className="text-indigo-300/70 text-[10px]">& Facility Management Pvt Ltd</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-indigo-200 justify-end mb-0.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-base font-bold text-white">{timeStr}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 justify-end">
            <CalendarDays className="w-3 h-3" />
            <span className="text-[10px]">{dateStr}</span>
          </div>
        </div>
      </div>

      {/* Title bar */}
      <div className="relative z-10 px-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-indigo-400" />
              Fingerprint Attendance
            </h1>
            {selectedClient && (
              <p className="text-indigo-300/80 text-xs mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                {selectedClient}
              </p>
            )}
          </div>
          {step !== "select-client" && (
            <button
              onClick={() => { setStep("select-client"); setSelectedClient(""); setSelectedEmployee(null); setErrorMsg(""); }}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs border border-white/10 rounded-lg px-2.5 py-1.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Change Client
            </button>
          )}
        </div>
        <div className="mt-3 border-t border-white/10" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 px-5 pb-6">

        {/* Step 1: Select Client */}
        {step === "select-client" && (
          <div className="space-y-3">
            <p className="text-slate-300 text-sm font-medium mb-3">Select your worksite:</p>
            {clients.length === 0 ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {clients.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => handleClientSelect(c.name)}
                    className="w-full text-left p-4 rounded-2xl bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-400/40 transition-all duration-200 group active:scale-[0.98]"
                    data-testid={`button-kiosk-client-${c.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 group-hover:bg-indigo-500/30 flex items-center justify-center shrink-0 transition-colors">
                        <span className="text-indigo-300 font-bold text-sm">{c.name.charAt(0)}</span>
                      </div>
                      <span className="text-white font-medium text-sm">{c.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Employee */}
        {step === "select-employee" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-300 text-sm font-medium">Select your name:</p>
              <span className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {employees.length} employees</span>
            </div>
            {employees.length === 0 ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {employees.map((emp: any) => {
                  const done = todayLogs.has(emp.id);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => !done && handleEmployeeSelect(emp)}
                      className={`relative p-3.5 rounded-2xl border transition-all duration-200 text-left active:scale-[0.97]
                        ${done
                          ? "bg-green-500/10 border-green-500/30 cursor-default"
                          : "bg-white/5 hover:bg-indigo-500/20 border-white/10 hover:border-indigo-400/40"}`}
                      data-testid={`button-kiosk-emp-${emp.id}`}
                    >
                      {done && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        </div>
                      )}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-sm font-bold
                        ${done ? "bg-green-500/20 text-green-300" : "bg-indigo-500/20 text-indigo-300"}`}>
                        {emp.name.charAt(0)}
                      </div>
                      <p className={`font-medium text-xs leading-snug ${done ? "text-green-200" : "text-white"}`}>
                        {emp.name}
                      </p>
                      <p className="text-slate-500 text-[10px] mt-0.5">{emp.employeeCode}</p>
                      {done && <p className="text-green-400/80 text-[10px] mt-0.5 font-medium">✓ Marked</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Verify Fingerprint */}
        {step === "verify" && selectedEmployee && (
          <div className="flex flex-col items-center justify-center py-6 gap-5">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-3 text-2xl font-bold text-indigo-300">
                {selectedEmployee.name.charAt(0)}
              </div>
              <p className="text-white font-semibold text-base">{selectedEmployee.name}</p>
              <p className="text-slate-400 text-xs mt-0.5">{selectedEmployee.employeeCode} · {selectedEmployee.designation}</p>
            </div>

            <div className="w-full max-w-xs flex flex-col items-center gap-4 p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-20 h-20 rounded-3xl bg-indigo-900/60 flex items-center justify-center">
                {verifying ? (
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                ) : (
                  <Fingerprint className="w-10 h-10 text-indigo-400" />
                )}
              </div>
              <div className="text-center space-y-1">
                <p className="text-white font-semibold text-sm">{verifying ? "Verifying…" : "Touch your fingerprint sensor"}</p>
                <p className="text-slate-400 text-xs">Press and hold your finger when prompted</p>
              </div>
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                data-testid="button-kiosk-verify"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                {verifying ? "Verifying…" : "Mark My Attendance"}
              </button>
            </div>

            <button
              onClick={() => { setStep("select-employee"); setSelectedEmployee(null); }}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to employee list
            </button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-bold text-lg">Attendance Marked!</p>
              <p className="text-green-300 font-semibold text-base">{successName}</p>
              <p className="text-slate-400 text-xs mt-1">Have a great day at work</p>
            </div>
            <div className="flex items-center gap-2 mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <Fingerprint className="w-4 h-4 text-green-400" />
              <span className="text-green-200 text-sm font-medium">Verified via Fingerprint</span>
            </div>
            <p className="text-slate-600 text-xs mt-4">Returning to employee list…</p>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="w-8 h-8 text-red-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-bold text-base">Verification Failed</p>
              <p className="text-red-300 text-sm">{errorMsg}</p>
            </div>
            <button
              onClick={() => { setStep("verify"); setErrorMsg(""); }}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => { setStep("select-employee"); setSelectedEmployee(null); setErrorMsg(""); }}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              Back to employee list
            </button>
          </div>
        )}
      </div>

      <p className="relative z-10 text-center text-xs text-slate-600 pb-4">
        DJ KPF Attendance Kiosk &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
