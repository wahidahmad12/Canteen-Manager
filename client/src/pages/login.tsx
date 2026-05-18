import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Eye, EyeOff, Fingerprint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import logoImg from "@assets/logo1_1771660912341.png";
import { startAuthentication } from "@simplewebauthn/browser";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await fetch(api.auth.login.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
    onError: (error: Error) => {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    loginMutation.mutate({ username, password });
  };

  const handleFingerprint = async () => {
    if (!username.trim()) {
      toast({ title: "Username required", description: "Please enter your username first, then tap the fingerprint button.", variant: "destructive" });
      return;
    }
    setFpLoading(true);
    try {
      const challengeRes = await fetch("/api/auth/webauthn/login/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
        credentials: "include",
      });
      if (!challengeRes.ok) {
        const err = await challengeRes.json();
        throw new Error(err.message || "Could not start fingerprint login");
      }
      const options = await challengeRes.json();
      const authResponse = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/webauthn/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), authenticationResponse: authResponse }),
        credentials: "include",
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.message || "Fingerprint verification failed");
      }
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast({ title: "Cancelled", description: "Fingerprint scan was cancelled.", variant: "destructive" });
      } else {
        toast({ title: "Fingerprint Login Failed", description: err.message || "Could not verify fingerprint", variant: "destructive" });
      }
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 relative overflow-hidden p-4">
      {/* Background blobs */}
      <div className="absolute top-[-100px] left-[-80px] w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-60px] w-64 h-64 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-teal-700/8 blur-3xl pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-sm z-10">
        {/* Logo section */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-3xl bg-teal-400/25 blur-xl scale-110" />
            <img src={logoImg} alt="DJ Hospitality" className="relative w-20 h-20 rounded-2xl object-cover shadow-2xl ring-2 ring-white/10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">DJ Hospitality</h1>
          <p className="text-sm text-teal-300/80 mt-0.5 font-medium">& Facility Management Pvt Ltd</p>
          <p className="text-xs text-slate-400 mt-1">Daily Cash Expance — Canteen Management</p>
        </div>

        {/* Form card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-5 text-center">Sign In</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Sign In + Fingerprint row */}
            <div className="flex gap-2 mt-2">
              <Button
                type="submit"
                className="flex-1 h-11 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold shadow-lg shadow-teal-900/40 border-0"
                disabled={loginMutation.isPending || !username.trim() || !password.trim()}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="w-4 h-4 mr-2" />
                )}
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>

              <button
                type="button"
                onClick={handleFingerprint}
                disabled={fpLoading}
                data-testid="button-fingerprint-login"
                title="Sign in with fingerprint"
                className="h-11 w-14 flex items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/10 hover:bg-teal-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {fpLoading ? (
                  <Loader2 className="w-5 h-5 text-teal-300 animate-spin" />
                ) : (
                  <Fingerprint className="w-6 h-6 text-teal-300 group-hover:text-teal-200 transition-colors" />
                )}
              </button>
            </div>

            <p className="text-center text-xs text-slate-500 pt-1">
              Enter username then tap <Fingerprint className="inline w-3 h-3 mb-0.5" /> to sign in with fingerprint
            </p>
          </form>
        </div>

        <button
          onClick={() => setLocation("/kiosk")}
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
