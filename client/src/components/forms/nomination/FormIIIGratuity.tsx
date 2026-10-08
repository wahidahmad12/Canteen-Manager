import React from "react";
import { Button } from "@/components/ui/button";
import "./nomination-form.css";

export default function FormIIIGratuity({ data }: { data: any }) {
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("T")[0].split("-");
    return year && month && day ? `${day}/${month}/${year}` : dateStr;
  };
  const employee = data?.employee || {};
  const nominees = data?.nominees || [];

  return (
    <div className="nomination-form-set">
      <div className="nomination-form-control">
        <Button onClick={() => window.print()}>Print Form III (Gratuity)</Button>
      </div>

      <section className="nomination-form-page">
        <header className="nomination-form-heading">
          <h1>FORM - III</h1>
          <p>[See rules 3(2), (3) and (4)]</p>
          <p>[For the purpose of Chapter V]</p>
          <h2 style={{ marginTop: "12mm" }}>Nomination/Fresh Nomination/Modification of Nomination</h2>
          <p><em>(Strike out the words not applicable)</em></p>
        </header>

        <table className="nomination-form-table">
          <thead>
            <tr>
              <th style={{ width: "12%" }}>Sl. No.</th>
              <th colSpan={2} style={{ textAlign: "left" }}>Details of the employee:</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Name of employee in full</td><td>{employee.name || ""}</td></tr>
            <tr><td>2</td><td>Father&apos;s/Spouse&apos;s name</td><td>{employee.fatherName || ""}</td></tr>
            <tr><td>3</td><td>Date of Birth (- - / - - / - - - -):</td><td>{formatDate(employee.dob)}</td></tr>
            <tr><td>4</td><td>Universal Account Number (if available):</td><td>{employee.uanNo || ""}</td></tr>
            <tr><td>5</td><td>Sex</td><td>{employee.gender || ""}</td></tr>
            <tr><td>6</td><td>Religion</td><td>{employee.religion || ""}</td></tr>
            <tr><td>7</td><td>Whether unmarried/married/widow/widower</td><td>{employee.maritalStatus || ""}</td></tr>
            <tr><td>8</td><td>Department/Branch/Section where employed</td><td>{employee.department || ""}</td></tr>
            <tr><td>9</td><td>Post held with Ticket No. or Serial No., if any</td><td>{employee.designation || ""}</td></tr>
            <tr><td>10</td><td>Date of appointment</td><td>{formatDate(employee.joiningDate)}</td></tr>
            <tr><td>11</td><td>Date of Superannuation</td><td /></tr>
            <tr><td>12</td><td colSpan={2}>Permanent address:</td></tr>
            {["Village", "Post-Office", "Thana", "Sub-Division", "District", "State", "Pin-Code", "E-mail ID", "Mobile Number"].map((label, index) => (
              <tr key={label}>
                <td />
                <td>{label}:</td>
                <td>{index === 0 ? (employee.permanentAddress || employee.address || "") : index === 7 ? (employee.email || "") : index === 8 ? (employee.mobile || "") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="nomination-form-page-number">Page 1 of 3</p>
      </section>

      <section className="nomination-form-page">
        <p>To: <span className="nomination-form-write-line" style={{ width: "100%" }} /></p>
        <p><em>(Give here name or description of the establishment with full address)</em></p>

        <p style={{ marginTop: "12mm" }}>
          I, Shri/Shrimati/Kumari <strong>{employee.name || ""}</strong> (Name in full here) whose
          particulars are given in the statement below, hereby nominate the person(s) mentioned
          below to receive the gratuity payable after my death, as also the gratuity standing to
          my credit in the event of my death before that amount has become payable, or having
          become payable has not been paid, and direct that the said amount of gratuity shall be
          paid in proportion indicated against the name(s) of the nominee(s).
        </p>
        <p style={{ textAlign: "center" }}>OR</p>
        <p>
          I, Shri/Shrimati/Kumari <strong>{employee.name || ""}</strong>, hereby give notice that
          the nomination filled by me on date __________ and recorded under your reference No.
          __________ dated __________ shall stand modified in the following manner: -
        </p>
        <p><em>*Strike out unnecessary portions.</em></p>

        <table className="nomination-form-table">
          <thead>
            <tr>
              <th style={{ width: "10%" }}>Sr. No.</th>
              <th>Name in full with full address of nominee</th>
              <th>Relationship with the employee</th>
              <th>Age of nominee</th>
              <th>Proportion by which the gratuity will be shared</th>
            </tr>
          </thead>
          <tbody>
            {nominees.length > 0 ? nominees.map((nominee: any, index: number) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{nominee.name}<br />{nominee.address}</td>
                <td>{nominee.relationship}</td>
                <td>{nominee.age || formatDate(nominee.dateOfBirth)}</td>
                <td>{nominee.sharePercentage}%</td>
              </tr>
            )) : Array.from({ length: 3 }, (_, index) => (
              <tr key={index}>{Array.from({ length: 5 }, (_, column) => (
                <td key={column} style={{ height: "11mm" }} />
              ))}</tr>
            ))}
          </tbody>
        </table>

        <h3 className="nomination-form-heading">DECLARATION</h3>
        <p>
          I hereby declare that the particulars given above are true and correct and that the
          person(s) nominated is/are entitled to receive the gratuity in accordance with the
          provisions of the Code on Social Security, 2020.
        </p>
        <p className="nomination-form-page-number">Page 2 of 3</p>
      </section>

      <section className="nomination-form-page">
        <div className="nomination-form-details">
          <p>4. I have excluded my husband from my family by a notice dated the __________ to the competent authority of the establishment.</p>
          <p>5. Nomination made herein invalidates my previous nomination.</p>
        </div>

        <h3>Manner of acquiring a “Family”</h3>
        <p>
          Here give details as to how a family was acquired, i.e., whether by marriage or parents
          being rendered dependent or through other process like adoption.
        </p>
        <span className="nomination-form-wide-line" />
        <span className="nomination-form-wide-line" />
        <span className="nomination-form-wide-line" />

        <div className="nomination-form-signatures" style={{ marginTop: "20mm" }}>
          <div>Place: {data?.nomination?.place || ""}<br />Date: ____________________</div>
          <div>Signature/Thumb-impression of the Employee</div>
        </div>

        <h3 className="nomination-form-heading" style={{ marginTop: "22mm" }}>
          Certificate by the Employer
        </h3>
        <p>
          Certified that the particulars of the above nomination have been verified and recorded
          in this establishment.
        </p>
        <div className="nomination-form-signatures">
          <div>Employer&apos;s Reference No., if any</div>
          <div>Signature/Thumb-impression of the Employee</div>
        </div>

        <h3 className="nomination-form-heading" style={{ marginTop: "18mm" }}>
          Acknowledgement by the Employee
        </h3>
        <p>
          Received the duplicate copy of nomination in Form - III filed by me and duly certified
          by the employer.
        </p>
        <div className="nomination-form-signatures">
          <div>Date: ____________________</div>
          <div>Signature of the Employee</div>
        </div>
        <p className="nomination-form-page-number">Page 3 of 3</p>
      </section>
    </div>
  );
}
