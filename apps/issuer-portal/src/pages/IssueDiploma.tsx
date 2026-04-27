import { useState, useEffect, type CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  createConnection,
  createCredentialOffer,
  pollCredentialRecord,
  waitForConnection,
  writeVcHashToCardano,
  listManagedDids,
  listSchemas,
} from "../services/agentApi.js";
import type { AgentCredentialRecord } from "@university-diplomas/common";

type Step = "form" | "qr" | "polling" | "success" | "error";

interface FormValues {
  studentName: string;
  studentId: string;
  degree: string;
  graduationDate: string;
  gpa: string;
}

const DEGREE_OPTIONS = [
  "Bachelor of Science in Computer Science",
  "Bachelor of Science in Mathematics",
  "Bachelor of Arts in Economics",
  "Master of Science in Data Science",
  "Master of Business Administration",
  "Doctor of Philosophy in Engineering",
];

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  fontSize: "0.95rem",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#374151",
};

const btnStyle = (variant: "primary" | "secondary"): CSSProperties => ({
  padding: "10px 24px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.9rem",
  background: variant === "primary" ? "#1e3a5f" : "#e2e8f0",
  color: variant === "primary" ? "#fff" : "#374151",
});

export function IssueDiploma() {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormValues>({
    studentName: "",
    studentId: "",
    degree: DEGREE_OPTIONS[0],
    graduationDate: "",
    gpa: "",
  });
  const [invitationUrl, setInvitationUrl] = useState<string>("");
  const [connectionId, setConnectionId] = useState<string>("");
  const [credentialRecord, setCredentialRecord] = useState<AgentCredentialRecord | null>(null);
  const [cardanoResult, setCardanoResult] = useState<{ txHash: string; cardanoscanUrl: string; vcHash: string } | null>(null);
  const [error, setError] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");

  const [issuingDid, setIssuingDid] = useState<string>(import.meta.env.VITE_UNIVERSITY_DID ?? "");
  const [schemaId, setSchemaId] = useState<string>(import.meta.env.VITE_DIPLOMA_SCHEMA_ID ?? "");

  // Load DIDs / schemas from agent if env vars are not set
  useEffect(() => {
    if (!issuingDid) {
      listManagedDids()
        .then((dids) => {
          const published = dids.find((d) => d.status === "PUBLISHED");
          if (published) setIssuingDid(published.did);
        })
        .catch(() => {});
    }
    if (!schemaId) {
      listSchemas()
        .then((schemas) => {
          const diploma = schemas.find((s) => s.name === "DiplomaCredential");
          if (diploma) setSchemaId(`http://localhost:8085/schema-registry/schemas/${diploma.guid}`);  
        })
        .catch(() => {});
    }
  }, [issuingDid, schemaId]);

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGenerateOffer = async () => {
    setError("");
    if (!form.studentName || !form.studentId || !form.graduationDate) {
      setError("Student name, ID and graduation date are required.");
      return;
    }
    if (!issuingDid) {
      setError(
        "No published DID found. Run scripts/01-init-university-did.sh first."
      );
      return;
    }
    if (!schemaId) {
      setError(
        "No diploma schema found. Run scripts/02-register-diploma-schema.sh first."
      );
      return;
    }

    try {
      setStatusMsg("Creating DIDComm connection…");
      const conn = await createConnection(
        `Diploma for ${form.studentName}`
      );
      setConnectionId(conn.connectionId);
      setInvitationUrl(conn.invitationUrl);
      setStep("qr");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  const handleAcceptAndIssue = async () => {
    setStep("polling");
    setError("");
    try {
      setStatusMsg("Waiting for student wallet to accept the connection…");
      await waitForConnection(connectionId);

      setStatusMsg("Creating credential offer…");
      const record = await createCredentialOffer({
        studentName: form.studentName,
        studentId: form.studentId,
        degree: form.degree,
        graduationDate: form.graduationDate,
        gpa: form.gpa ? parseFloat(form.gpa) : undefined,
        connectionId,
        issuingDid,
        schemaId,
      });

      setStatusMsg("Offer sent — waiting for student wallet to accept the credential…");
      const finalRecord = await pollCredentialRecord(record.recordId);
      setCredentialRecord(finalRecord);

      // Write hash to Cardano
      setStatusMsg("Writing VC hash to Cardano preprod metadata…");
      try {
        const cardano = await writeVcHashToCardano(finalRecord);
        setCardanoResult(cardano);
      } catch (cardanoErr) {
        console.warn("Cardano write failed (non-fatal):", cardanoErr);
        setCardanoResult(null);
      }

      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  const reset = () => {
    setStep("form");
    setForm({ studentName: "", studentId: "", degree: DEGREE_OPTIONS[0], graduationDate: "", gpa: "" });
    setInvitationUrl("");
    setConnectionId("");
    setCredentialRecord(null);
    setCardanoResult(null);
    setError("");
    setStatusMsg("");
  };

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Issue Diploma</h1>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "2rem", maxWidth: "680px" }}>

        {/* ── Step: Form ── */}
        {step === "form" && (
          <>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: 0, marginBottom: "1.5rem" }}>
              Fill in the student's diploma details. You'll get a QR code / link that the student scans with their wallet to claim the credential.
            </p>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Student Full Name *</label>
                <input style={inputStyle} name="studentName" value={form.studentName} onChange={handleFieldChange} placeholder="Alice Johnson" />
              </div>
              <div>
                <label style={labelStyle}>Student ID *</label>
                <input style={inputStyle} name="studentId" value={form.studentId} onChange={handleFieldChange} placeholder="CS-2024-001" />
              </div>
              <div>
                <label style={labelStyle}>Degree *</label>
                <select style={inputStyle} name="degree" value={form.degree} onChange={handleFieldChange}>
                  {DEGREE_OPTIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Graduation Date *</label>
                <input style={inputStyle} type="date" name="graduationDate" value={form.graduationDate} onChange={handleFieldChange} />
              </div>
              <div>
                <label style={labelStyle}>GPA (optional, 0 – 4.0)</label>
                <input style={inputStyle} type="number" step="0.01" min="0" max="4" name="gpa" value={form.gpa} onChange={handleFieldChange} placeholder="3.85" />
              </div>
            </div>

            {/* Config status */}
            <div style={{ marginTop: "1.2rem", fontSize: "0.8rem", color: "#64748b" }}>
              Issuing DID: <code>{issuingDid || "⚠ not found"}</code><br />
              Schema ID: <code>{schemaId || "⚠ not found"}</code>
            </div>

            {error && <div style={{ marginTop: "1rem", color: "#dc2626", fontSize: "0.875rem" }}>{error}</div>}

            <button style={{ ...btnStyle("primary"), marginTop: "1.5rem" }} onClick={handleGenerateOffer}>
              Generate Diploma Offer →
            </button>
          </>
        )}

        {/* ── Step: QR code ── */}
        {step === "qr" && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "1.1rem" }}>Student: Scan this QR code</h2>
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
              Have the student open their wallet and scan the code (or paste the invitation link).
            </p>
            <div style={{ display: "inline-block", padding: "1rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", margin: "1rem 0" }}>
              <QRCodeSVG value={invitationUrl} size={220} />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ ...labelStyle, textAlign: "left", display: "block", marginBottom: "4px" }}>Invitation URL — paste this into the student wallet</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  readOnly
                  value={invitationUrl}
                  style={{ ...inputStyle, fontSize: "0.75rem", flex: 1, cursor: "text" }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  style={{ ...btnStyle("secondary"), whiteSpace: "nowrap", padding: "8px 14px" }}
                  onClick={() => navigator.clipboard.writeText(invitationUrl)}
                >
                  Copy
                </button>
              </div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Once the student has scanned the code and their wallet is connected, click the button below to issue the diploma.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button style={btnStyle("secondary")} onClick={reset}>← Start Over</button>
              <button style={btnStyle("primary")} onClick={handleAcceptAndIssue}>Issue Diploma ✓</button>
            </div>
          </div>
        )}

        {/* ── Step: Polling ── */}
        {step === "polling" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Processing…</div>
            <div style={{ fontSize: "0.875rem", color: "#64748b" }}>{statusMsg}</div>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === "success" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ fontSize: "1.2rem", color: "#16a34a" }}>Diploma Issued Successfully!</h2>
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
              The credential has been sent to the student's wallet via DIDComm.
            </p>
            <div style={{ textAlign: "left", background: "#f8fafc", borderRadius: "8px", padding: "1rem", margin: "1rem 0", fontSize: "0.875rem" }}>
              <div><strong>Student:</strong> {form.studentName}</div>
              <div><strong>Degree:</strong> {form.degree}</div>
              <div><strong>Record ID:</strong> <code>{credentialRecord?.recordId}</code></div>
              {cardanoResult && (
                <>
                  <div style={{ marginTop: "0.75rem" }}><strong>VC Hash (SHA-256):</strong></div>
                  <code style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>{cardanoResult.vcHash}</code>
                  <div style={{ marginTop: "0.5rem" }}>
                    <strong>Cardano Receipt:</strong>{" "}
                    <a href={cardanoResult.cardanoscanUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>
                      {cardanoResult.txHash.slice(0, 16)}… on Cardanoscan ↗
                    </a>
                  </div>
                </>
              )}
              {!cardanoResult && (
                <div style={{ marginTop: "0.75rem", color: "#f59e0b", fontSize: "0.8rem" }}>
                  ⚠ Cardano hash submission skipped (configure BLOCKFROST_PROJECT_ID and CARDANO_WALLET_MNEMONIC in .env)
                </div>
              )}
            </div>
            <button style={btnStyle("primary")} onClick={reset}>Issue Another Diploma</button>
          </div>
        )}

        {/* ── Step: Error ── */}
        {step === "error" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>❌</div>
            <h2 style={{ color: "#dc2626" }}>Something went wrong</h2>
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>{error}</p>
            <button style={btnStyle("secondary")} onClick={reset}>← Try Again</button>
          </div>
        )}
      </div>
    </>
  );
}
