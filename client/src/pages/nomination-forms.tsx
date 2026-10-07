import NominationManager from "@/components/forms/nomination/NominationManager";

export default function NominationFormsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Nomination Forms</h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate, save and print statutory nomination forms (Form II, Form III, Form VII)
        </p>
      </div>
      
      {/* Yahan humne apne pichle step wala Manager call kar liya */}
      <NominationManager />
    </div>
  );
}
