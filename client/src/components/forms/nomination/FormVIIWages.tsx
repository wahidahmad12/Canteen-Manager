import React from "react";
import { Button } from "@/components/ui/button";
import "./nomination-form.css";

export default function FormVIIWages({ data }: { data: any }) {
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("T")[0].split("-");
    return year && month && day ? `${day}-${month}-${year}` : dateStr;
  };
  const employee = data?.employee || {};
  const nominees = data?.nominees || [];

  return (
    <div className="nomination-form-set">
      <div className="nomination-form-control">
        <Button onClick={() => window.print()}>Print Form VII</Button>
      </div>

      <section className="nomination-form-page">
        <header className="nomination-form-heading">
          <h1>FORM - VII</h1>
          <h2>NOMINATION FORM</h2>
        </header>

        <div className="nomination-form-details">
          <p>1. Name of person making nomination (In block letters): <strong>{employee.name || ""}</strong></p>
          <p>2. Father&apos;s/Spouse&apos;s Name: <strong>{employee.fatherName || ""}</strong></p>
          <p>3. Date of Birth: <strong>{formatDate(employee.dob)}</strong></p>
          <p>4. Sex: <strong>{employee.gender || ""}</strong></p>
          <p>5. Marital Status: <strong>{employee.maritalStatus || ""}</strong></p>
          <p>6. Address:</p>
          <p>Permanent: <strong>{employee.permanentAddress || employee.address || ""}</strong></p>
          <p>Temporary: <strong>{employee.localAddress || ""}</strong></p>
        </div>

        <p>
          I hereby nominate the person(s)/cancel the nomination made by me previously and nominate
          the person(s) mentioned below to receive any amount due to me from the employer in the
          event of my death: -
        </p>

        <table className="nomination-form-table">
          <thead>
            <tr>
              <th>Name of nominee/nominees<span className="nomination-column-number">(1)</span></th>
              <th>Address<span className="nomination-column-number">(2)</span></th>
              <th>Relationship with the employee<span className="nomination-column-number">(3)</span></th>
              <th>Date of Birth<span className="nomination-column-number">(4)</span></th>
              <th>Nominee&apos;s share of accumulations in credit to be paid to each nominee<span className="nomination-column-number">(5)</span></th>
              <th>If nominee is minor: name, relationship and address of guardian<span className="nomination-column-number">(6)</span></th>
            </tr>
          </thead>
          <tbody>
            {nominees.length > 0 ? nominees.map((nominee: any, index: number) => (
              <tr key={index}>
                <td>{nominee.name}</td>
                <td>{nominee.address}</td>
                <td>{nominee.relationship}</td>
                <td>{formatDate(nominee.dateOfBirth)}</td>
                <td>{nominee.sharePercentage}%</td>
                <td>{nominee.guardianName || ""}</td>
              </tr>
            )) : Array.from({ length: 4 }, (_, index) => (
              <tr key={index}>{Array.from({ length: 6 }, (_, column) => (
                <td key={column} style={{ height: "8mm" }} />
              ))}</tr>
            ))}
          </tbody>
        </table>

        <div className="nomination-form-details">
          <p>1. Certified that I have no family and if I acquire a family hereafter, the above nomination shall be deemed as cancelled.</p>
          <p>2. Certified that my father/mother is/are dependent upon me.</p>
          <p>3. Strike out whichever is not applicable.</p>
        </div>

        <div className="nomination-form-signatures">
          <div />
          <div>Signature or thumb impression of the employee</div>
        </div>

        <h3 className="nomination-form-heading">CERTIFICATE BY EMPLOYER</h3>
        <p>
          Certified that the above declaration and nomination has been signed/thumb impressed
          before me by Shri/Smt/Ku <strong>{employee.name || ""}</strong> employed in my
          establishment after he/she has read the entry/entries or have been read over to him/her
          by me and got confirmed by him/her in either of the cases.
        </p>
        <div className="nomination-form-signatures">
          <div>Place: {data?.nomination?.place || ""}</div>
          <div>Signature of the employer or other authorised officer of the establishment and Designation</div>
        </div>
      </section>

      <section className="nomination-form-page">
        <p>Name and Address of the Factory/Establishment and rubber stamp thereof</p>
        <span className="nomination-form-wide-line" />
        <span className="nomination-form-wide-line" />

        <h2 className="nomination-form-heading" style={{ marginTop: "24mm" }}>
          ACKNOWLEDGEMENT BY THE EMPLOYEE
        </h2>
        <p>
          Received the duplicate copy of nomination in Form - VII filed by me and duly certified
          by the employer.
        </p>
        <div className="nomination-form-signatures" style={{ marginTop: "35mm" }}>
          <div>Date: ____________________</div>
          <div>Signature of the Employee</div>
        </div>
      </section>
    </div>
  );
}
