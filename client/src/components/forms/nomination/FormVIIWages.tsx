import React from "react";
import { Button } from "@/components/ui/button";

export default function FormVIIWages({ data }: { data: any }) {
  const handlePrint = () => window.print();

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto border shadow-sm print:shadow-none print:border-none print:p-0">
      {/* Print Button - Sirf screen par dikhega, print mein hide ho jayega */}
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={handlePrint}>Print Form VII</Button>
      </div>

      {/* Form Content - Jo print hoga */}
      <div className="text-sm space-y-4">
        <div className="text-center font-bold text-lg mb-6">
          FORM-VII <br /> NOMINATION FORM[cite: 9]
        </div>

        {/* Employee Details */}
        <div className="space-y-2">
          <p><strong>1. Name of person making nomination:</strong> {data?.employee?.name || "_________________"}</p>
          <p><strong>2. Father's/Spouse's Name:</strong> {data?.employee?.fatherName || "_________________"}</p>
          <p><strong>3. Date of Birth:</strong> {data?.employee?.dob || "_________________"}</p>
          <p><strong>4. Sex:</strong> {data?.employee?.gender || "_________________"}</p>
          <p><strong>5. Marital Status:</strong> {data?.nomination?.maritalStatus || "_________________"}</p>
          <p><strong>6. Address (Permanent):</strong> {data?.employee?.address || "_________________"}</p>
        </div>

        <p className="mt-4">
          I hereby nominate the person(s)/cancel the nomination made by me previously and nominate the person(s) mentioned below to receive any amount due to me from the employer in the event of my death:-[cite: 9]
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
                  <td className="border border-gray-800 p-2">{nominee.dateOfBirth}</td>
                  <td className="border border-gray-800 p-2">{nominee.sharePercentage}%</td>
                  <td className="border border-gray-800 p-2">{nominee.guardianName || "-"}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="border border-gray-800 p-8">No nominees added</td></tr>
            )}
          </tbody>
        </table>

        {/* Declarations & Signatures */}
        <div className="mt-8 space-y-8">
          <div>
            <p>1. Certified that I have no family and if I acquire a family hereafter, the above nomination shall be deemed as cancelled.[cite: 9]</p>
            <p>2. Certified that my father/mother is/are dependent upon me.[cite: 9]</p>
          </div>
          <div className="flex justify-between items-end mt-12">
            <div>Place: {data?.nomination?.place || "Kolkata"}<br/>Date: ____________</div>
            <div className="text-right">_________________________________<br/>Signature/Thumb impression of employee</div>
          </div>
          
          <div className="border-t-2 border-black pt-4 mt-8">
            <h3 className="font-bold text-center mb-4">CERTIFICATE BY EMPLOYER[cite: 9]</h3>
            <p>Certified that the above declaration and nomination has been signed/thumb impressed before me by Shri/Smt {data?.employee?.name || "________"} employed in my establishment...[cite: 9]</p>
            <div className="flex justify-between mt-12">
              <div>Date: ____________</div>
              <div className="text-right">_________________________________<br/>Signature of Employer (DJ KPF)[cite: 10]</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
