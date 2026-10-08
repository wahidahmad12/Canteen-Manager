import React from "react";
import { Button } from "@/components/ui/button";
import "./nomination-form.css";

export default function FormIIPF({ data }: { data: any }) {
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("T")[0].split("-");
    return year && month && day ? `${day}/${month}/${year}` : dateStr;
  };
  const employee = data?.employee || {};
  const nominees = data?.nominees || [];
  const field = (label: string, value?: string | null) => (
    <div className="nomination-form-field">
      {label} <strong>{value || ""}</strong>
    </div>
  );

  return (
    <div className="nomination-form-set">
      <div className="nomination-form-control">
        <Button onClick={() => window.print()}>Print Form II (PF)</Button>
      </div>

      <section className="nomination-form-page">
        <header className="nomination-form-heading">
          <h1>Employee&apos;s Provident Fund Organisation</h1>
          <p>(Form 2)</p>
          <h2>Declaration and Nomination Form</h2>
          <p>For Unexempted / Exempted Establishments</p>
          <p>
            Declaration and Nomination Form under the Employees&apos; Provident Fund Scheme and
            Employees&apos; Pension Scheme
          </p>
        </header>

        <div className="nomination-form-details">
          {field("1. Name (IN BLOCK LETTERS):", employee.name)}
          {field("2. Name - Father's/Husband's (x):", employee.fatherName)}
          <p><em>(Married female members to mention Husband&apos;s name)</em></p>
          <div className="nomination-form-field-row">
            {field("3. Date of Birth (dd/mm/yyyy):", formatDate(employee.dob))}
            {field("4. Sex:", employee.gender)}
          </div>
          <div className="nomination-form-field-row">
            {field("5. Marital Status:", employee.maritalStatus)}
            {field("6. EPF Account No.:", employee.pfNo || employee.uanNo)}
          </div>
          {field("7. Address - Permanent/Temporary (x):", employee.permanentAddress || employee.address)}
          <span className="nomination-form-wide-line" />
          <p style={{ marginTop: 8 }}>
            City: <strong>{employee.city || ""}</strong>
            <span style={{ marginLeft: 30 }}>Pin Code: <strong>{employee.pinCode || ""}</strong></span>
          </p>
        </div>

        <h2 className="nomination-form-heading">PART - A (EPF)</h2>
        <p>
          I hereby nominate the person(s)/cancel the nomination made by me previously and
          nominate the person(s) mentioned below to receive the amount standing to my credit in
          the Employees&apos; Provident Fund in the event of my death.
        </p>
        <p>
          I certify that the person(s) named below is/are a member(s) of my family as defined in
          the Employees&apos; Provident Fund Scheme.
        </p>

        <table className="nomination-form-table">
          <thead>
            <tr>
              <th>Name and address of nominee</th>
              <th>Relationship</th>
              <th>Date of birth</th>
              <th>Total share (%)</th>
              <th>If minor, guardian details</th>
            </tr>
          </thead>
          <tbody>
            {nominees.length > 0 ? nominees.map((nominee: any, index: number) => (
              <tr key={index}>
                <td>{nominee.name}<br />{nominee.address}</td>
                <td>{nominee.relationship}</td>
                <td>{formatDate(nominee.dateOfBirth)}</td>
                <td>{nominee.sharePercentage}%</td>
                <td>{nominee.guardianName || ""}</td>
              </tr>
            )) : Array.from({ length: 3 }, (_, index) => (
              <tr key={index}>{Array.from({ length: 5 }, (_, column) => (
                <td key={column} style={{ height: "9mm" }} />
              ))}</tr>
            ))}
          </tbody>
        </table>

        <div className="nomination-form-signatures">
          <div>Date: ____________________</div>
          <div>Signature or thumb impression of the subscriber</div>
        </div>
      </section>

      <section className="nomination-form-page">
        <h2 className="nomination-form-heading">PART - B (EPS)</h2>
        <p style={{ textAlign: "center" }}>Para 18</p>
        <p>
          I hereby furnish below particulars of the members of my family who would be eligible to
          receive Widow / Children Pension in the event of my premature death in service.
        </p>
        <p>
          <strong>Note: To be filled-in only by Married members - Can nominate only Spouse/Children</strong>
        </p>

        <table className="nomination-form-table">
          <thead>
            <tr>
              <th>Name &amp; Address of the Family Member</th>
              <th>Nominee&apos;s relationship with member</th>
              <th>Date of Birth (dd/mm/yyyy)</th>
              <th>Share of pension in EPS payable to each</th>
            </tr>
          </thead>
          <tbody>
            {nominees.length > 0 ? nominees.map((nominee: any, index: number) => (
              <tr key={index}>
                <td>{nominee.name}<br />{nominee.address}</td>
                <td>{nominee.relationship}</td>
                <td>{formatDate(nominee.dateOfBirth)}</td>
                <td>{nominee.sharePercentage}%</td>
              </tr>
            )) : Array.from({ length: 4 }, (_, index) => (
              <tr key={index}>{Array.from({ length: 4 }, (_, column) => (
                <td key={column} style={{ height: "12mm" }} />
              ))}</tr>
            ))}
          </tbody>
        </table>

        <p>
          I hereby declare that the particulars furnished above are true and correct to the best
          of my knowledge and belief.
        </p>
        <div className="nomination-form-signatures">
          <div>Place: {data?.nomination?.place || ""}<br />Date: ____________________</div>
          <div>Signature or thumb impression of the subscriber</div>
        </div>
        <div style={{ marginTop: "18mm" }}>
          <h3 className="nomination-form-heading">CERTIFICATE BY THE EMPLOYER</h3>
          <p>
            Certified that the above declaration and nomination has been signed/thumb impressed
            before me by Shri/Smt <strong>{employee.name || ""}</strong> employed in my
            establishment.
          </p>
          <div className="nomination-form-signatures">
            <div>Date: ____________________</div>
            <div>Signature of Employer &amp; Stamp</div>
          </div>
        </div>
      </section>
    </div>
  );
}
