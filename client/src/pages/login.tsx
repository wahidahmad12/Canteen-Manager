import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Eye, EyeOff, Fingerprint, RotateCcw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import logoImg from "@assets/logo1_1771660912341.png";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

const FP_STORAGE_KEY = "dj_fp_username";

type Mode = "password" | "fingerprint" | "register-fp";

export default function Login() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [mode, setMode] = useState<Mode>("password");
  const [fpUsername, setFpUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [fpSuccess, setFpSuccess] = useState(false);
  const autoTriggered = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(FP_STORAGE_KEY);
    if (stored) {
      setFpUsername(stored);
      setMode("fingerprint");
    }
  }, []);

  useEffect(() => {
    if (mode === "fingerprint" && fpUsername && !autoTriggered.current) {
      autoTriggered.current = true;
      setTimeout(() => triggerFingerprint(fpUsername), 600);
    }
  }, [mode, fpUsername]);

  const triggerFingerprint = async (uname: string) => {
    setFpLoading(true);
    try {
      const challengeRes = await fetch("/api/auth/webauthn/login/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname }),
        credentials: "include",
      });
      if (!challengeRes.ok) {
        const err = await challengeRes.json();
        throw new Error(err.message || "Could not start fingerprint");
      }
      const options = await challengeRes.json();
      const authResponse = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/webauthn/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname, authenticationResponse: authResponse }),
        credentials: "include",
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.message || "Fingerprint verification failed");
      }
      setFpSuccess(true);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: [api.auth.me.path] }), 700);
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        toast({ title: "Fingerprint Failed", description: err.message || "Could not verify fingerprint", variant: "destructive" });
      }
    } finally {
      setFpLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(api.auth.login.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login failed");
      }
      const user = await res.json();
      if (user.employeeId) {
        const credsRes = await fetch(`/api/employees/${user.employeeId}/webauthn/credentials`, { credentials: "include" });
        const creds = credsRes.ok ? await credsRes.json() : [];
        if (Array.isArray(creds) && creds.length > 0) {
          localStorage.setItem(FP_STORAGE_KEY, username.trim());
          queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
        } else {
          setPendingUser(user);
          setMode("register-fp");
        }
      } else {
        queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      }
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterFingerprint = async () => {
    if (!pendingUser?.employeeId) return;
    setFpLoading(true);
    try {
      const challengeRes = await fetch("/api/webauthn/register/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: pendingUser.employeeId }),
        credentials: "include",
      });
      if (!challengeRes.ok) { const e = await challengeRes.json(); throw new Error(e.message); }
      const options = await challengeRes.json();
      const registrationResponse = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: pendingUser.employeeId, registrationResponse }),
        credentials: "include",
      });
      if (!verifyRes.ok) { const e = await verifyRes.json(); throw new Error(e.message); }
      localStorage.setItem(FP_STORAGE_KEY, username.trim());
      toast({ title: "Fingerprint Registered!", description: "Next time you can sign in with just your fingerprint." });
      setFpSuccess(true);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: [api.auth.me.path] }), 700);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast({ title: "Cancelled", description: "Fingerprint registration was cancelled. You can register it later from your profile.", variant: "destructive" });
      } else {
        toast({ title: "Registration Failed", description: err.message || "Could not register fingerprint.", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    } finally {
      setFpLoading(false);
    }
  };

  const switchToPassword = () => {
    localStorage.removeItem(FP_STORAGE_KEY);
    setMode("password");
    autoTriggered.current = false;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 relative overflow-hidden p-4">
      <div className="absolute top-[-100px] left-[-80px] w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-60px] w-64 h-64 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-3xl bg-teal-400/25 blur-xl scale-110" />
            <img src={logoImg} alt="DJ Hospitality" className="relative w-20 h-20 rounded-2xl object-cover shadow-2xl ring-2 ring-white/10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">DJ Hospitality</h1>
          <p className="text-sm text-teal-300/80 mt-0.5 font-medium">& Facility Management Pvt Ltd</p>
          <p className="text-xs text-slate-400 mt-1">Daily Cash Expance — Canteen Management</p>
        </div>

        {/* ── FINGERPRINT MODE ── */}
        {mode === "fingerprint" && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
            <p className="text-slate-300 text-sm mb-1">Welcome back</p>
            <p className="text-white font-bold text-xl mb-6">{fpUsername}</p>

            <div className="flex flex-col items-center gap-4">
              {fpSuccess ? (
                <CheckCircle2 className="w-20 h-20 text-teal-400" />
              ) : (
                <button
                  onClick={() => { autoTriggered.current = false; triggerFingerprint(fpUsername); }}
                  disabled={fpLoading}
                  data-testid="button-fp-tap"
                  className="w-24 h-24 rounded-full bg-teal-500/20 border-2 border-teal-400/40 flex items-center justify-center hover:bg-teal-500/30 active:scale-95 transition-all disabled:opacity-50 group"
                >
                  {fpLoading
                    ? <Loader2 className="w-10 h-10 text-teal-300 animate-spin" />
                    : <Fingerprint className="w-10 h-10 text-teal-300 group-hover:text-teal-200 transition-colors" />
                  }
                </button>
              )}
              <p className="text-slate-400 text-xs">
                {fpSuccess ? "Signed in!" : fpLoading ? "Verifying fingerprint…" : "Tap to sign in with fingerprint"}
              </p>
            </div>

            <button
              onClick={switchToPassword}
              className="mt-8 text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 mx-auto"
              data-testid="button-use-password"
            >
              <RotateCcw className="w-3 h-3" /> Use password instead
            </button>
          </div>
        )}

        {/* ── REGISTER FINGERPRINT PROMPT ── */}
        {mode === "register-fp" && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-teal-500/20 border-2 border-teal-400/40 flex items-center justify-center">
                {fpSuccess
                  ? <CheckCircle2 className="w-8 h-8 text-teal-400" />
                  : <Fingerprint className="w-8 h-8 text-teal-300" />
                }
              </div>
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">
              {fpSuccess ? "Fingerprint Registered!" : "Register Your Fingerprint"}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              {fpSuccess
                ? "Next time you can sign in with just a tap."
                : "Register your fingerprint now so you can sign in quickly next time — no password needed."}
            </p>
            {!fpSuccess && (
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleRegisterFingerprint}
                  disabled={fpLoading}
                  className="w-full h-11 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold border-0"
                  data-testid="button-register-fp"
                >
                  {fpLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Fingerprint className="w-4 h-4 mr-2" />}
                  {fpLoading ? "Scanning…" : "Register Fingerprint"}
                </Button>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: [api.auth.me.path] })}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  data-testid="button-skip-fp"
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PASSWORD MODE ── */}
        {mode === "password" && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-5 text-center">Sign In</h2>
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm text-slate-300 font-medium">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  data-testid="input-login-username"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-teal-400 focus:ring-teal-400/20 h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-slate-300 font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-login-password"
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-teal-400 focus:ring-teal-400/20 h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold shadow-lg shadow-teal-900/40 border-0 mt-2"
                disabled={loading || !username.trim() || !password.trim()}
                data-testid="button-login"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </div>
        )}

        <button
          onClick={() => window.location.href = "/kiosk"}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 text-sm font-medium transition-colors"
          data-testid="button-open-kiosk"
        >
          <Fingerprint className="w-4 h-4" />
          Employee Attendance Kiosk
        </button>

        <p className="text-center text-xs text-slate-500 mt-4">
          DJ KPF Daily Cash Expance &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
