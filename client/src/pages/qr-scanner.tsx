import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode, Html5QrcodeScanner } from "html5-qrcode";
import { QrCode, Camera, Upload, X, Copy, Check, RefreshCw, ScanLine } from "lucide-react";

type ScanMode = "camera" | "file";

function parseQrData(raw: string): { label: string; value: string }[] {
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const pairs: { label: string; value: string }[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    const equalIdx = line.indexOf("=");
    const pipeIdx = line.indexOf("|");

    if (colonIdx > 0 && colonIdx < 40) {
      pairs.push({ label: line.slice(0, colonIdx).trim(), value: line.slice(colonIdx + 1).trim() });
    } else if (equalIdx > 0 && equalIdx < 40) {
      pairs.push({ label: line.slice(0, equalIdx).trim(), value: line.slice(equalIdx + 1).trim() });
    } else if (pipeIdx > 0) {
      const parts = line.split("|").map(p => p.trim()).filter(Boolean);
      parts.forEach((p, i) => pairs.push({ label: `Field ${i + 1}`, value: p }));
    } else {
      pairs.push({ label: `Line ${pairs.length + 1}`, value: line.trim() });
    }
  }

  if (pairs.length === 0 && raw.trim()) {
    pairs.push({ label: "Data", value: raw.trim() });
  }

  return pairs;
}

export default function QrScannerPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<ScanMode>("camera");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SCANNER_ID = "qr-reader";

  const stopCamera = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (_) {}
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setResult(null);
    setScanning(true);
    try {
      const qr = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setResult(decodedText);
          stopCamera();
          toast({ title: "QR Code Scanned!", description: "Data extracted successfully." });
        },
        () => {}
      );
    } catch (err: any) {
      setScanning(false);
      toast({ title: "Camera Error", description: err?.message || "Could not access camera.", variant: "destructive" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    try {
      const qr = new Html5Qrcode("qr-file-reader");
      const res = await qr.scanFile(file, false);
      setResult(res);
      toast({ title: "QR Code Scanned!", description: "Data extracted successfully." });
    } catch (err: any) {
      toast({ title: "Scan Failed", description: "Could not read QR code from this image. Try a clearer image.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    stopCamera();
    setResult(null);
  };

  const parsedData = result ? parseQrData(result) : [];

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">QR Code Scanner</h1>
            <p className="text-sm text-muted-foreground">Scan via camera or upload an image</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={mode === "camera" ? "default" : "outline"}
            size="sm"
            onClick={() => { stopCamera(); setMode("camera"); setResult(null); }}
            data-testid="button-mode-camera"
            className="gap-2"
          >
            <Camera className="w-4 h-4" /> Camera
          </Button>
          <Button
            variant={mode === "file" ? "default" : "outline"}
            size="sm"
            onClick={() => { stopCamera(); setMode("file"); setResult(null); }}
            data-testid="button-mode-file"
            className="gap-2"
          >
            <Upload className="w-4 h-4" /> Upload Image
          </Button>
        </div>

        {!result && mode === "camera" && (
          <Card className="border-violet-200 dark:border-violet-800">
            <CardContent className="p-4 space-y-4">
              <div
                id={SCANNER_ID}
                className={`w-full rounded-xl overflow-hidden bg-black min-h-[280px] flex items-center justify-center ${scanning ? "" : "hidden"}`}
              />
              {!scanning && (
                <div className="flex flex-col items-center justify-center gap-4 py-10 border-2 border-dashed border-violet-200 dark:border-violet-800 rounded-xl">
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <ScanLine className="w-8 h-8 text-violet-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Point camera at a QR code</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Make sure the QR code is well-lit and within frame</p>
                  </div>
                  <Button onClick={startCamera} data-testid="button-start-camera" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                    <Camera className="w-4 h-4" /> Start Camera
                  </Button>
                </div>
              )}
              {scanning && (
                <Button variant="outline" size="sm" onClick={stopCamera} data-testid="button-stop-camera" className="w-full gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400">
                  <X className="w-4 h-4" /> Stop Camera
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!result && mode === "file" && (
          <Card className="border-violet-200 dark:border-violet-800">
            <CardContent className="p-4">
              <div id="qr-file-reader" className="hidden" />
              <label
                htmlFor="qr-file-input"
                className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed border-violet-200 dark:border-violet-800 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-colors"
                data-testid="label-file-upload"
              >
                <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-violet-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">Click to upload QR code image</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Supports JPG, PNG, GIF, WebP</p>
                </div>
              </label>
              <input
                id="qr-file-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file-qr"
              />
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                  <Check className="w-3 h-3" /> Scan Successful
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-result" className="gap-1.5">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy All"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-scan-again" className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Scan Again
                </Button>
              </div>
            </div>

            {parsedData.length > 1 ? (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                    <QrCode className="w-4 h-4" /> Scanned Data
                    <Badge variant="secondary" className="ml-auto text-[10px] h-5">{parsedData.length} fields</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {parsedData.map((item, i) => (
                      <div key={i} className="flex gap-3 py-2 border-b last:border-0 border-muted" data-testid={`row-qr-field-${i}`}>
                        <span className="text-xs font-semibold text-muted-foreground w-32 shrink-0 pt-0.5">{item.label}</span>
                        <span className="text-sm font-medium break-all">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Raw Data</p>
                  <p className="text-sm font-mono break-all bg-muted rounded-lg p-3" data-testid="text-qr-raw">{result}</p>
                </CardContent>
              </Card>
            )}

            <Card className="border-muted">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Raw Text</p>
                <pre className="text-xs font-mono break-all bg-muted/50 rounded-lg p-3 whitespace-pre-wrap" data-testid="text-qr-raw-full">{result}</pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
