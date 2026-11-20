import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Plus, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseVoiceExpenseTranscript, type ExpenseCategory, type VoiceExpenseCatalogItem, type VoiceExpenseItem } from "@/lib/voice-expense";

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface VoiceExpenseDialogProps {
  category: ExpenseCategory;
  catalog: VoiceExpenseCatalogItem[];
  onAdd: (items: VoiceExpenseItem[]) => void;
}

const categoryLabels: Record<ExpenseCategory, string> = {
  fixed: "Fixed Items",
  vegetable: "Vegetable Purchase",
  other: "Other Item Purchase",
};

const examples: Record<ExpenseCategory, string> = {
  fixed: "Petrol, 2 litre, 200 rupees.",
  vegetable: "Aloo, 2 kilo, 100 rupees.",
  other: "Rice, 2 kilo, 100 rupees.",
};

export function VoiceExpenseDialog({ category, catalog, onAdd }: VoiceExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("hi-IN");
  const [transcript, setTranscript] = useState("");
  const [reviewItems, setReviewItems] = useState<VoiceExpenseItem[]>([]);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptBeforeListeningRef = useRef("");
  const sectionCatalog = catalog.filter(item => item.category === category);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const startListening = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setError("Voice recognition is not available in this browser. You can type the details below.");
      return;
    }

    setError("");
    setReviewItems([]);
    transcriptBeforeListeningRef.current = transcript.trim();
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else interimText += `${result[0].transcript} `;
      }
      const base = transcriptBeforeListeningRef.current;
      setTranscript([base, finalText.trim(), interimText.trim()].filter(Boolean).join("\n"));
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(event.error === "not-allowed"
        ? "Microphone permission was denied. Allow microphone access in your browser settings."
        : `Voice recognition stopped (${event.error}). Please try again or type the details.`);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError("Could not start voice recognition. Please check microphone access and try again.");
    }
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
    } else {
      startListening();
    }
  };

  const handleParse = () => {
    const parsed = parseVoiceExpenseTranscript(transcript, sectionCatalog, category);
    if (parsed.length === 0) {
      setReviewItems([]);
      setError(`No expense items found. Try saying an item, quantity, and total amount, for example: ${examples[category]}`);
      return;
    }
    setReviewItems(parsed);
    setError("");
  };

  const updateItem = (index: number, patch: Partial<VoiceExpenseItem>) => {
    setReviewItems(current => current.map((item, currentIndex) => {
      if (currentIndex !== index) return item;
      const updated = { ...item, ...patch };
      if (patch.qty !== undefined || patch.amount !== undefined) {
        updated.rate = updated.qty > 0 ? updated.amount / updated.qty : 0;
      }
      return updated;
    }));
  };

  const handleAdd = () => {
    if (reviewItems.some(item => !item.description.trim())) {
      setError("Enter a description for every item before continuing.");
      return;
    }
    if (category === "fixed" && reviewItems.some(item => !sectionCatalog.some(option => option.name === item.description))) {
      setError("Choose a fixed item for every entry before continuing.");
      return;
    }
    if (category === "fixed" && reviewItems.some(item => sectionCatalog.find(option => option.name === item.description)?.uom.toLowerCase() !== item.uom.toLowerCase())) {
      setError("The unit does not match the fixed item. Correct the unit and quantity before adding.");
      return;
    }
    onAdd(reviewItems);
    setOpen(false);
    setTranscript("");
    setReviewItems([]);
    setError("");
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        size="sm"
        variant="secondary"
        className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
        aria-label={`Voice entry for ${categoryLabels[category]}`}
        data-testid={`button-voice-expense-${category}`}
      >
        <Mic className="w-4 h-4 mr-1" />
        Voice Entry
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            recognitionRef.current?.stop();
            setListening(false);
          }
          setOpen(nextOpen);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-indigo-600" />
              {categoryLabels[category]} — Voice Entry
            </DialogTitle>
            <DialogDescription>
              Speak one expense per sentence with its quantity and total amount. Review the suggestions before adding them to {categoryLabels[category]}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={language} onValueChange={setLanguage} disabled={listening}>
                <SelectTrigger className="sm:w-48" aria-label="Speech language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hi-IN">Hindi</SelectItem>
                  <SelectItem value="en-IN">English (India)</SelectItem>
                  <SelectItem value="bn-IN">Bengali</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" onClick={toggleListening} variant={listening ? "destructive" : "default"} className="sm:flex-1">
                {listening ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                {listening ? "Stop listening" : "Start speaking"}
              </Button>
            </div>

            {listening && (
              <p className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300" role="status">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Listening… Speak clearly, then stop when finished.
              </p>
            )}

            <label htmlFor={`voice-expense-transcript-${category}`} className="block text-sm font-medium">
              Transcript
            </label>
            <textarea
              id={`voice-expense-transcript-${category}`}
              value={transcript}
              disabled={listening}
              onChange={(event) => {
                setTranscript(event.target.value);
                setReviewItems([]);
              }}
              placeholder={`Example: ${examples[category]}`}
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="textarea-voice-expense-transcript"
            />
            <p className="text-xs text-muted-foreground">
              Example: “{examples[category]}” Speak each item as a separate sentence. You can correct the transcript before parsing. Your browser may process voice audio online.
            </p>

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

            <Button type="button" variant="secondary" onClick={handleParse} disabled={!transcript.trim() || listening}>
              <WandSparkles className="w-4 h-4 mr-2" />
              Review detected items
            </Button>

            {reviewItems.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Review before adding</h3>
                {reviewItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-5 gap-2 rounded-lg border p-3">
                    {category === "fixed" ? (
                      <div className="sm:col-span-2">
                        <Select
                          value={sectionCatalog.some(option => option.name === item.description) ? item.description : ""}
                          onValueChange={(value) => {
                            const selected = sectionCatalog.find(option => option.name === value);
                            updateItem(index, { description: value, uom: selected?.uom ?? item.uom });
                          }}
                        >
                          <SelectTrigger aria-label={`Item ${index + 1} fixed item`}>
                            <SelectValue placeholder="Choose fixed item" />
                          </SelectTrigger>
                          <SelectContent>
                            {sectionCatalog.map(option => (
                              <SelectItem key={option.name} value={option.name}>{option.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!sectionCatalog.some(option => option.name === item.description) && (
                          <p className="text-xs text-muted-foreground mt-1">Heard: {item.description}. Choose the matching fixed item.</p>
                        )}
                      </div>
                    ) : (
                      <Input
                        value={item.description}
                        onChange={(event) => updateItem(index, { description: event.target.value })}
                        aria-label={`Item ${index + 1} description`}
                        placeholder="Item name"
                        className="sm:col-span-2"
                      />
                    )}
                    <Input
                      value={item.uom}
                      onChange={(event) => updateItem(index, { uom: event.target.value })}
                      aria-label={`Item ${index + 1} unit`}
                      placeholder="Unit"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={item.qty}
                      onChange={(event) => updateItem(index, { qty: Number(event.target.value) || 0 })}
                      aria-label={`Item ${index + 1} quantity`}
                      placeholder="Qty"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={item.amount}
                      onChange={(event) => updateItem(index, { amount: Number(event.target.value) || 0 })}
                      aria-label={`Item ${index + 1} amount`}
                      placeholder="Amount ₹"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              recognitionRef.current?.stop();
              setListening(false);
              setOpen(false);
            }}>Cancel</Button>
            <Button type="button" onClick={handleAdd} disabled={reviewItems.length === 0 || listening}>
              <Plus className="w-4 h-4 mr-2" />
              Add {reviewItems.length || ""} {reviewItems.length === 1 ? "item" : "items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
