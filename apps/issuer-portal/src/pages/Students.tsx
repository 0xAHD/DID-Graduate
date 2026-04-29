import { useState, useEffect, useRef, type CSSProperties } from "react";
import {
  fetchStudents,
  createCredentialOffer,
  pollCredentialRecord,
  writeVcHashToCardano,
  listManagedDids,
  listSchemas,
  queueDiploma,
  type RegisteredStudent,
} from "../services/agentApi.js";

// ── Styles ────────────────────────────────────────────────────────────────────

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: "0.8rem",
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: CSSProperties = {
  padding: "12px 16px",
  fontSize: "0.9rem",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#374151",
};

const btn = (variant: "primary" | "secondary" | "small"): CSSProperties => {
  if (variant === "small") return { padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem", background: "#1e3a5f", color: "#fff" };
  if (variant === "secondary") return { padding: "10px 20px", fontSize: "0.9rem", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 600, background: "#e2e8f0", color: "#374151" };
  return { padding: "10px 24px", fontSize: "0.9rem", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 600, background: "#1e3a5f", color: "#fff" };
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEGREE_OPTIONS = [
  "Bachelor of Science in Computer Science",
  "Bachelor of Science in Mathematics",
  "Bachelor of Arts in Economics",
  "Master of Science in Data Science",
  "Master of Business Administration",
  "Doctor of Philosophy in Engineering",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConnectionBadge({ connectionId }: { connectionId?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 600,
      background: connectionId ? "#dcfce7" : "#fef3c7",
      color: connectionId ? "#15803d" : "#b45309",
    }}>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: connectionId ? "#16a34a" : "#f59e0b", display: "inline-block" }} />
      {connectionId ? "Wallet linked" : "Not linked yet"}
    </span>
  );
}

// ── Issue Diploma Modal ────────────────────────────────────────────────────────

type ModalStep = "form" | "issuing" | "success" | "error";

interface IssueModalProps {
  student: RegisteredStudent;
  issuingDid: string;
  schemaId: string;
  onClose: () => void;
}

function IssueModal({ student, issuingDid, schemaId, onClose }: IssueModalProps) {
  const [degree, setDegree] = useState(DEGREE_OPTIONS[0]);
  const [graduationDate, setGraduationDate] = useState("");
  const [gpa, setGpa] = useState("");
  const [step, setStep] = useState<ModalStep>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  /** true when we fell back to queue because the stored connection was stale */
  const [queuedFallback, setQueuedFallback] = useState(false);
  /** true when the offer was sent but the wallet wasn't active yet (poll timed out) */
  const [offerSentOnly, setOfferSentOnly] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const isConnected = !!student.connectionId;

  const handleSubmit = async () => {
    if (!graduationDate) { setError("Graduation date is required."); return; }
    if (!issuingDid) { setError("No published DID found. Run scripts/01-init-university-did.sh first."); return; }
    if (!schemaId) { setError("No diploma schema found. Run scripts/02-register-diploma-schema.sh first."); return; }

    setError("");
    const gpaNum = gpa ? parseFloat(gpa) : undefined;

    if (!isConnected) {
      setStep("issuing");
      setStatusMsg("Saving diploma to queue…");
      try {
        await queueDiploma(student.id, {
          studentName: student.name,
          studentIdField: student.studentNumber || student.id,
          degree,
          graduationDate,
          gpa: gpaNum,
          issuingDid,
          schemaId,
        });
        setStep("success");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStep("error");
      }
      return;
    }

    setStep("issuing");
    try {
      setStatusMsg("Creating credential offer…");

      let record;
      try {
        record = await createCredentialOffer({
          studentName: student.name,
          studentId: student.studentNumber || student.id,
          degree,
          graduationDate,
          gpa: gpaNum,
          connectionId: student.connectionId!,
          issuingDid,
          schemaId,
        });
      } catch {
        // Connection is stale (e.g. agent restarted) — queue instead so the
        // diploma is auto-delivered when the student's wallet reconnects.
        setStatusMsg("Connection stale — queuing diploma for auto-delivery…");
        await queueDiploma(student.id, {
          studentName: student.name,
          studentIdField: student.studentNumber || student.id,
          degree,
          graduationDate,
          gpa: gpaNum,
          issuingDid,
          schemaId,
        });
        setQueuedFallback(true);
        setStep("success");
        return;
      }

      setStatusMsg("Offer sent — waiting for student wallet to accept…");
      try {
        const finalRecord = await pollCredentialRecord(record.recordId);
        setStatusMsg("Writing VC hash to Cardano…");
        try { await writeVcHashToCardano(finalRecord); } catch { /* non-fatal */ }
      } catch {
        // Wallet wasn't active during the poll window — queue the diploma so it
        // gets re-issued automatically when the student reconnects (even with a
        // new connectionId after a stale-connection reset).
        setOfferSentOnly(true);
        try {
          await queueDiploma(student.id, {
            studentName: student.name,
            studentIdField: student.studentNumber || student.id,
            degree,
            graduationDate,
            gpa: gpaNum,
            issuingDid,
            schemaId,
          });
        } catch { /* non-fatal — best-effort queue */ }
      }

      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: "min(520px, 95vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#0f3460" }}>Issue Diploma</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>{student.name} — {student.email}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", color: "#94a3b8", lineHeight: 1 }}>×</button>
        </div>

        {/* Pre-filled student info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
          <div>
            <label style={labelStyle}>Student Name</label>
            <input style={{ ...inputStyle, background: "#f8fafc" }} value={student.name} readOnly />
          </div>
          <div>
            <label style={labelStyle}>Student ID</label>
            <input style={{ ...inputStyle, background: "#f8fafc" }} value={student.studentNumber || student.id} readOnly />
          </div>
        </div>

        {(step === "form" || step === "error") && (
          <>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Degree *</label>
                <select style={inputStyle} value={degree} onChange={(e) => setDegree(e.target.value)}>
                  {DEGREE_OPTIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Graduation Date *</label>
                <input style={inputStyle} type="date" value={graduationDate} onChange={(e) => setGraduationDate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>GPA (optional, 0 – 4.0)</label>
                <input style={inputStyle} type="number" step="0.01" min="0" max="4" value={gpa} onChange={(e) => setGpa(e.target.value)} placeholder="3.85" />
              </div>
            </div>

            {!isConnected && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#1e40af", background: "#eff6ff", padding: "8px 12px", borderRadius: "6px" }}>
                📬 Student not yet connected — diploma will be <strong>queued</strong> and auto-delivered when they open their wallet.
              </div>
            )}

            {error && (
              <div style={{ marginTop: "0.75rem", color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px" }}>{error}</div>
            )}

            <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button style={btn("secondary")} onClick={onClose}>Cancel</button>
              <button style={btn("primary")} onClick={handleSubmit}>
                {isConnected ? "Issue Diploma ✓" : "Queue Diploma 📬"}
              </button>
            </div>
          </>
        )}

        {step === "issuing" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>{statusMsg}</p>
          </div>
        )}

        {step === "success" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>
              {isConnected && !queuedFallback && !offerSentOnly ? "🎓" : "📬"}
            </div>
            <h3 style={{ color: "#15803d", margin: "0 0 0.5rem" }}>
              {isConnected && !queuedFallback && !offerSentOnly
                ? "Diploma Issued!"
                : "Diploma Queued!"}
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
              {queuedFallback
                ? `Connection was stale — diploma queued for ${student.name}. It will be auto-delivered when they reconnect their wallet.`
                : offerSentOnly
                ? `Offer sent to ${student.name}'s wallet. The diploma will be stored automatically when they next open it.`
                : isConnected
                ? `The diploma credential has been delivered to ${student.name}'s wallet.`
                : `Queued — it will be auto-delivered when ${student.name} opens their wallet.`}
            </p>
            <div style={{ textAlign: "left", background: "#f8fafc", borderRadius: "8px", padding: "0.75rem 1rem", margin: "1rem 0", fontSize: "0.875rem" }}>
              <div><strong>Degree:</strong> {degree}</div>
              <div><strong>Graduation:</strong> {graduationDate}</div>
              {gpa && <div><strong>GPA:</strong> {gpa}</div>}
            </div>
            <button style={btn("primary")} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Students() {
  const [students, setStudents] = useState<RegisteredStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuingDid, setIssuingDid] = useState(import.meta.env.VITE_UNIVERSITY_DID ?? "");
  const [schemaId, setSchemaId] = useState(import.meta.env.VITE_DIPLOMA_SCHEMA_ID ?? "");
  const [activeStudent, setActiveStudent] = useState<RegisteredStudent | null>(null);

  const load = () => {
    setLoading(true);
    fetchStudents()
      .then(setStudents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh every 8 seconds so connection status updates appear without manual refresh
  useEffect(() => {
    const id = setInterval(() => {
      fetchStudents()
        .then(setStudents)
        .catch(() => {}); // silent refresh — don't overwrite a user-visible error
    }, 8_000);
    return () => clearInterval(id);
  }, []);

  // Pre-load DID and schema so the modal opens instantly with them ready
  useEffect(() => {
    if (!issuingDid) {
      listManagedDids()
        .then((dids) => { const p = dids.find((d) => d.status === "PUBLISHED"); if (p) setIssuingDid(p.did); })
        .catch(() => {});
    }
    if (!schemaId) {
      listSchemas()
        .then((schemas) => {
          const d = schemas.find((s) => s.name === "DiplomaCredential");
          if (d) setSchemaId(`http://localhost:8085/schema-registry/schemas/${d.guid}`);
        })
        .catch(() => {});
    }
  }, [issuingDid, schemaId]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Students</h1>
        <button
          onClick={load}
          style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.85rem" }}
        >
          ↻ Refresh
        </button>
      </div>

      <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        Students who have registered and logged into their wallet. Click <strong>Issue Diploma</strong> to fill in the diploma details — connected students receive it instantly, others are queued for auto-delivery.
      </p>

      {loading && <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>Loading students…</div>}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "1rem", color: "#dc2626", fontSize: "0.875rem" }}>{error}</div>
      )}

      {!loading && !error && students.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
          No students registered yet.<br />Students will appear here after they create an account in the wallet app.
        </div>
      )}

      {students.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Student #</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>DID</th>
                <th style={thStyle}>Registered</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.id}
                  style={{ background: "#fff" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{s.email}</td>
                  <td style={tdStyle}>{s.studentNumber || "—"}</td>
                  <td style={tdStyle}><ConnectionBadge connectionId={s.connectionId} /></td>                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.75rem", color: "#475569", maxWidth: "220px" }}>
                    {s.walletDid ? (
                      <span
                        title={s.walletDid}
                        onClick={() => navigator.clipboard.writeText(s.walletDid!)}
                        style={{ cursor: "pointer", borderBottom: "1px dashed #94a3b8" }}
                      >
                        {s.walletDid.slice(0, 20)}…{s.walletDid.slice(-8)}
                      </span>
                    ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                  </td>                  <td style={{ ...tdStyle, color: "#94a3b8", fontSize: "0.8rem" }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td style={tdStyle}>
                    <button style={btn("small")} onClick={() => setActiveStudent(s)}>
                      Issue Diploma
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeStudent && (
        <IssueModal
          student={activeStudent}
          issuingDid={issuingDid}
          schemaId={schemaId}
          onClose={() => setActiveStudent(null)}
        />
      )}
    </>
  );
}
