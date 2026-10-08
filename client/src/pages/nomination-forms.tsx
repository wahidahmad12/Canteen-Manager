import NominationManager from "@/components/forms/nomination/NominationManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NominationFormsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button
          variant="outline"
          onClick={() => navigate("/")}
          className="w-fit print:hidden"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 print:hidden">Nomination Forms</h1>
          <p className="text-sm text-slate-500 mt-1 print:hidden">
            Generate, save and print statutory nomination forms (Form II, Form III, Form VII)
          </p>
        </div>
      </div>

      <NominationManager />
    </div>
  );
}
