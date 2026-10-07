import React from "react";
import { Button } from "@/components/ui/button";

export default function FormVIIWages({ data }: { data: any }) {
  const handlePrint = () => window.print();

  // Date ko DD-MM-YYYY format mein badalne ka function
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "_________________";
    try {
      const onlyDate = dateStr.split("T")[0]; // T00:00:00.000Z ko hatayega
      const [year, month, day] = onlyDate.split("-"); // YYYY, MM, DD ko alag karega
      
      // Agar date sahi se alag nahi hui, toh wahi wapas kar dega
      if (!day || !month || !year) return onlyDate; 
      
      return `${day}-${month}-${year}`; // DD-MM-YYYY format mein jodega
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto border shadow-sm print:shadow-none print:border-none print:p-0">
      {/* Print Button - Sirf screen par dikhega, print mein hide ho jayega */}
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={handlePrint}>Print Form VII</Button>
      </div>

      {/* Form Content - Jo print hoga */}
      <div className="text-sm space-y-4">
        <div className="text-center font-bold text-lg mb-6">
          FORM-VII <br /> NOMINATION FORM
        </div>

        {/* Employee Details */}
        <div className="space-y-2">
          <p><strong>1. Name of person making nomination:</strong> {data?.employee?.name || "_________________"}</p>
          <p><strong>2. Father's/Spouse's Name:</strong> {data?.employee?.fatherName || "_________________"}</p>
          {/* Yahan formatDate function ka use kiya gaya hai */}
          <p><strong>3. Date of Birth:</strong> {formatDate(data?.employee?.dob)}</p>
          <p><strong>4. Sex:</strong> {data?.employee?.gender || "_________________"}</p>
          <p><strong>5. Marital Status:</strong> {data?.nomination?.maritalStatus || "_________________"}</p>
          <p><strong>6. Address (Permanent):</strong> {data?.employee?.address || "_________________"}</p>
        </div>

        <p className="mt-4">
          I hereby nominate the person(s)/cancel the nomination made by me previously and nominate the person(s) mentioned below to receive any amount due to me from the employer in the event of my death:-
        </p>

        {/* Nominees Table */}
        <table className="w-full border-collapse border border-gray-800 mt-4 text-center">
          <thead>
            <tr>
              <th className="border border-gray-800 p-2">Name of nominee(s)</th>
              <th className="border border-gray-800 p-2">Address</th>
              <th className="border border-gray-800 p-2">Relationship</th>
              <th className="border border-gray-800 p-2">Date of Birth</th>
              <th className="border border-gray-800 p-2">Total share (%)</th>
              <th className="border border-gray-800 p-2">If minor, guardian details</th>
            </tr>
          </thead>
          <tbody>
            {data?.nominees?.length > 0 ? (
              data.nominees.map((nominee: any, index: number) => (
                <tr key={index}>
                  <td className="border border-gray-800 p-2">{nominee.name}</td>
                  <td className="border border-gray-800 p-2">{nominee.address}</td>
                  <td className="border border-gray-800 p-2">{nominee.relationship}</td>
                  {/* Agar
