import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { loadFaceModels, faceapi } from "@/lib/face-api-loader";
import { Camera, CheckCircle2, Loader2, RefreshCw, ScanFace, X } from "lucide-react";

interface Props {
  employeeId: number;
  employeeName: string;
  hasExisting: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "idle" | "loading-models" | "camera" | "detecting" | "captured" | "saving";

export function FaceEnrollDialog({ employeeId, employeeName, hasExisting, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setStep("loading-models");
    try {
      await loadFaceModels();
    } catch {
      toast({ title: "Model Load Error", description: "Could not load face models. Check internet connection.", variant: "destructive" });
      setStep("idle"); return;
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
      setStep("camera");
    } catch (err: any) {
      const msg = err?.name === "NotAllowedError" ? "Camera permission denied. Please allow camera access in your browser settings." : err?.name === "NotFoundError" ? "No camera found on this device." : "Could not access camera. Try reloading the page.";
      toast({ title: "Camera Error", description: msg, variant: "destructive" });
      setStep("idle");
    }
  };

  const captureAndDetect = async () => {
    if (!videoRef.current) return;
    setStep("detecting");
    try {
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!result) {
        toast({ title: "No Face Detected", description: "Please position your face clearly in the frame.", variant: "destructive" });
        setStep("camera"); return;
      }

      const { x, y, width, height } = result.detection.box;
      const vw = videoRef.current.videoWidth || 640;
      const vh = videoRef.current.videoHeight || 480;
      setFaceBox({ x: x / vw * 100, y: y / vh * 100, w: width / vw * 100, h: height / vh * 100 });
      setDescriptor(Array.from(result.descriptor));
      stopCamera();
      setStep("captured");
    } catch {
      toast({ title: "Detection Error", description: "Face detection failed. Try again.", variant: "destructive" });
      setStep("camera");
    }
  };

  const saveDescriptor = async () => {
    if (!descriptor) return;
    setStep("saving");
    try {
      const res = await fetch(`/api/employees/${employeeId}/face`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceDescriptor: JSON.stringify(descriptor) }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Face Enrolled!", description: `${employeeName}'s face has been saved.` });
      onSuccess();
      onClose();
    } catch {
      toast({ title: "Save Error", description: "Could not save face data.", variant: "destructive" });
      setStep("captured");
    }
  };

  const reset = () => { stopCamera(); setDescriptor(null); setFaceBox(null); setStep("idle"); };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-full p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-t-lg" />
        <div className="p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScanFace className="w-5 h-5 text-violet-600" />
              Enroll Face — {employeeName}
            </DialogTitle>
          </DialogHeader>

          {hasExisting && step === "idle" && (
            <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Face already enrolled — re-capture to update
            </div>
          )}

          {step === "idle" && (
            <div className="flex flex-col items-center gap-4 py-6 border-2 border-dashed border-violet-200 dark:border-violet-800 rounded-xl">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Camera className="w-8 h-8 text-violet-500" />
              </div>
              <p className="text-sm text-muted-foreground text-center">Open camera and look straight ahead to capture your face</p>
              <Button onClick={startCamera} className="bg-violet-600 hover:bg-violet-700 text-white gap-2" data-testid="button-start-enroll">
                <Camera className="w-4 h-4" /> Open Camera
              </Button>
            </div>
          )}

          {step === "loading-models" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Loading face models…</p>
            </div>
          )}

          {(step === "camera" || step === "detecting") && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} autoPlay muted playsInline className="w-full block" style={{ maxHeight: 280 }} />
                {step === "detecting" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              <Button onClick={captureAndDetect} disabled={step === "detecting"} className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2" data-testid="button-capture">
                {step === "detecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
                {step === "detecting" ? "Detecting…" : "Capture Face"}
              </Button>
            </div>
          )}

          {step === "captured" && descriptor && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-muted flex items-center justify-center" style={{ height: 180 }}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Face Captured ✓</Badge>
                </div>
                {faceBox && (
                  <div className="absolute top-2 left-2 text-xs text-muted-foreground bg-white/80 dark:bg-black/60 rounded px-2 py-0.5">
                    128 face points recorded
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset} className="flex-1 gap-1.5" data-testid="button-retake">
                  <RefreshCw className="w-3.5 h-3.5" /> Retake
                </Button>
                <Button onClick={saveDescriptor} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white gap-1.5" data-testid="button-save-face">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Save Face
                </Button>
              </div>
            </div>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Saving face data…</p>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
