  import React from "react";
import NominationManager from "@/components/forms/nomination/NominationManager";

export default function NominationFormsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Nomination Forms (II, III, VII)</h1>
      {/* Ye wo component hai jo humne pichle step mein banaya tha */}
      <NominationManager />
    </div>
  );
}
