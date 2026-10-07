import React from "react";
import { Button } from "@/components/ui/button";

export default function FormIIPF({ data }: { data: any }) {
  const handlePrint = () => window.print();

  // Date ko DD-MM-YYYY format mein badalne ka function
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "_________________";
    try {
      const onlyDate = dateStr.split("T")[0]; // T00:00:00.000Z ko hatayega
      const [year, month, day] = onlyDate.split("-"); // YYYY, MM, DD ko alag karega
      
      // Agar date format proper nahi hai, toh wahi wapas bhej do
      if (!day || !month || !year) return onlyDate; 
      
      return `${day}-${month}-${year}`; // DD-MM-YYYY format mein jodega
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto border shadow-sm print:shadow-none print:border-none print:p-0">
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={handlePrint}>Print Form II (PF)</Button>
      </div>

      <div className="text-sm space-y-4 text-black">
        <div className="text-center font-bold text-lg mb-6">
          DECLARATION AND NOMINATION FORM UNDER THE EMPLOYEES' PROVIDENT FUND AND EMPLOYEES' PENSION SCHEME<br/>
          (Form 2 Revised)
        </div>

        <div className="grid grid-cols-2 gap-4 border p-4">
          <p><strong>1. Name:</strong> {data?.employee?.name || "_________________"}</p>
          
          {/* Yahan Date of Birth ke liye formatDate function lagaya gaya hai */}
          <p><strong>2. Date of Birth:</strong> {formatDate(data?.employee?.dob)}</p>
          
          <p><strong>3. Father's/Husband's Name:</strong> {data?.employee?.fatherName || "_________________"}</p>
          <p><strong>4. Sex:</strong> {data?.employee?.gender || "_________________"}</p>
          <p><strong>5. Marital Status:</strong> {data?.nomination?.maritalStatus || "_________________"}</p>
          <p><strong>6. EPS Account No.:</strong> {data?.nomination?.epsAccountNo || "_________________"}</p>
          <p className="col-span-2"><strong>7. Address:</strong> {data?.employee?.address || "_________________"}</p>
        </div>

        {/* PART A - EPF */}
        <h3 className="font-bold text-center mt-6 text-lg">PART - A (EPF)</h3>
        <p>I hereby nominate the person(s)/cancel the nomination made by me previously and nominate the person(s) mentioned below to receive the amount standing to my credit in the Employees' Provident Fund...</p>

        <table className="w-full border-collapse border border-black mt-2 text-center text-xs">
          <thead>
            <tr>
              <th className="border border-black p-2">Name & Address of Nominee(s)</th>
              <th className="border border-black p-2">Relationship</th>
              <th className="border border-black p-2">Date of Birth</th>
              <th className="border border-black p-2">Share (%)</th>
              <th className="border border-black p-2">If Minor, Guardian Details</th>
            </tr>
          </thead>
          <tbody>
            {data?.nominees?.length > 0 ? (
              data.nominees.map((nominee: any, i: number) => (
                <tr key={i}>
                  <td className="border border-black p-2">{nominee.name}<br/>{nominee.address}</td>
                  <td className="border border-black p-2">{nominee.relationship}</td>
                  <td className="border border-black p-2">{formatDate(nominee.dateOfBirth)}</td>
                  <td className="border border-black p-2">{nominee.sharePercentage}%</td>
                  <td className="border border-black p-2">{nominee.guardianName || "-"}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="border border-black p-4">No nominees added</td></tr>
            )}
          </tbody>
        </table>

        {/* PART B - EPS */}
        <h3 className="font-bold text-center mt-6 text-lg">PART - B (EPS) (Para 18)</h3>
        <p>I hereby furnish below particulars of the members of my family who would be eligible to receive Widow/Children Pension in the event of my premature death in service.</p>

        <table className="w-full border-collapse border border-black mt-2 text-center text-xs">
          <thead>
            <tr>
              <th className="border border-black p-2">Name & Address of Family Member</th>
              <th className="border border-black p-2">Relationship</th>
              <th className="border border-black p-2">Date of Birth</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={3} className="border border-black p-8 text-gray-500">Family Members for Pension Scheme</td></tr>
          </tbody>
        </table>

        <div className="flex justify-between items-end mt-12">
          <div>Date: ____________</div>
          <div className="text-right">_________________________________<br/>Signature/Thumb impression of subscriber</div>
        </div>

        <div className="border-t border-black pt-4 mt-8">
          <p>Certified that the above declaration and nomination has been signed/thumb impressed before me by Shri/Smt {data?.employee?.name} employed in my establishment...</p>
          <div className="flex justify-between mt-8">
            <div>Place: {data?.nomination?.place || "Kolkata"}<br/>Date: ____________</div>
            <div className="text-right">_________________________________<br/>Signature of Employer & Stamp (DJ KPF)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
