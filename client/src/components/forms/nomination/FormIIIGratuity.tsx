import React from "react";
import { Button } from "@/components/ui/button";

export default function FormIIIGratuity({ data }: { data: any }) {
  const handlePrint = () => window.print();

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto border shadow-sm print:shadow-none print:border-none print:p-0">
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={handlePrint}>Print Form III (Gratuity)</Button>
      </div>

      <div className="text-sm space-y-4 text-black">
        <div className="text-center font-bold text-lg mb-6">
          FORM-III<br/>
          Nomination/Fresh Nomination/Modification of Nomination<br/>
          (Gratuity)[cite: 13]
        </div>

        {/* Employee Details 1 to 12 */}
        <table className="w-full border-collapse border border-black mb-6">
          <tbody>
            <tr><td className="border border-black p-2 w-10">1</td><td className="border border-black p-2 font-bold w-1/3">Name of employee in full</td><td className="border border-black p-2">{data?.employee?.name || ""}</td></tr>
            <tr><td className="border border-black p-2">2</td><td className="border border-black p-2 font-bold">Father's/Spouse's name</td><td className="border border-black p-2">{data?.employee?.fatherName || ""}</td></tr>
            <tr><td className="border border-black p-2">3</td><td className="border border-black p-2 font-bold">Date of Birth</td><td className="border border-black p-2">{data?.employee?.dob || ""}</td></tr>
            <tr><td className="border border-black p-2">4</td><td className="border border-black p-2 font-bold">UAN (Universal Account Number)</td><td className="border border-black p-2">{data?.employee?.uan || ""}</td></tr>
            <tr><td className="border border-black p-2">5</td><td className="border border-black p-2 font-bold">Sex</td><td className="border border-black p-2">{data?.employee?.gender || ""}</td></tr>
            <tr><td className="border border-black p-2">6</td><td className="border border-black p-2 font-bold">Religion</td><td className="border border-black p-2">{data?.nomination?.religion || ""}</td></tr>
            <tr><td className="border border-black p-2">7</td><td className="border border-black p-2 font-bold">Marital Status</td><td className="border border-black p-2">{data?.nomination?.maritalStatus || ""}</td></tr>
            <tr><td className="border border-black p-2">8</td><td className="border border-black p-2 font-bold">Department</td><td className="border border-black p-2">{data?.employee?.designation || ""}</td></tr>
            <tr><td className="border border-black p-2">9</td><td className="border border-black p-2 font-bold">Date of appointment</td><td className="border border-black p-2">{data?.employee?.dateOfJoining || ""}</td></tr>
            <tr><td className="border border-black p-2">10</td><td className="border border-black p-2 font-bold">Permanent address</td><td className="border border-black p-2">{data?.employee?.address || ""}</td></tr>
          </tbody>
        </table>

        <p>I, Shri/Shrimati/Kumari {data?.employee?.name} hereby nominate the person(s) mentioned below to receive the gratuity payable after my death...[cite: 14]</p>

        {/* Nominees Table */}
        <table className="w-full border-collapse border border-black mt-4 text-center">
          <thead>
            <tr>
              <th className="border border-black p-2">Sr. No.</th>
              <th className="border border-black p-2">Name in full with address of nominee(s)</th>
              <th className="border border-black p-2">Relationship</th>
              <th className="border border-black p-2">Age</th>
              <th className="border border-black p-2">Proportion of Gratuity Share</th>
            </tr>
          </thead>
          <tbody>
            {data?.nominees?.length > 0 ? (
              data.nominees.map((nominee: any, i: number) => (
                <tr key={i}>
                  <td className="border border-black p-2">{i + 1}</td>
                  <td className="border border-black p-2">{nominee.name}, {nominee.address}</td>
                  <td className="border border-black p-2">{nominee.relationship}</td>
                  <td className="border border-black p-2">{nominee.age || "-"}</td>
                  <td className="border border-black p-2">{nominee.sharePercentage}%</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="border border-black p-4">No nominees added</td></tr>
            )}
          </tbody>
        </table>

        {/* Declarations */}
        <div className="mt-8">
          <h4 className="font-bold underline mb-2">DECLARATION</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>I hereby certify that the person(s) mentioned is/are a member(s) of my family...[cite: 14]</li>
            <li>My father/mother/parents is/are not dependent on me.[cite: 14, 15]</li>
          </ol>
        </div>

        <div className="flex justify-between items-end mt-12">
          <div>Place: {data?.nomination?.place || "Kolkata"}<br/>Date: ____________</div>
          <div className="text-right">_________________________________<br/>Signature/Thumb-impression of Employee[cite: 15]</div>
        </div>

        <div className="border-t-2 border-black pt-4 mt-8">
          <h3 className="font-bold text-center mb-2">Certificate by the Employer[cite: 15]</h3>
          <p>Certified that the particulars of the above nomination have been verified and recorded in this establishment.[cite: 15]</p>
          <div className="flex justify-between mt-8">
            <div>Date: ____________</div>
            <div className="text-right">_________________________________<br/>Employer's Signature (DJ KPF)[cite: 15]</div>
          </div>
        </div>
      </div>
    </div>
  );
}
