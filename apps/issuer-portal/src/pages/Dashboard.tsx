import { useState, type CSSProperties } from "react";
import { useDiplomas } from "../hooks/useDiplomas.js";
import type { AgentCredentialRecord } from "@university-diplomas/common";

const stateColor: Record<string, string> = {
  CredentialSent: "#22c55e",
  OfferSent: "#f59e0b",
  RequestSent: "#3b82f6",
  RequestReceived: "#3b82f6",
  RequestPending: "#a78bfa",
  CredentialPending: "#a78bfa",
  ProblemReportPending: "#ef4444",
};

const stateLabel: Record<string, string> = {
  CredentialSent: "Issued \u2713",
  OfferSent: "Offer Sent",
  RequestSent: "Request Sent",
  RequestReceived: "Request Received",
  RequestPending: "Pending",
  CredentialPending: "Preparing",
  ProblemReportPending: "Failed",
};

function StatusBadge({ state }: { state: string }) {
  const color = stateColor[state] ?? "#94a3b8";
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}`, borderRadius: "999px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>
      {stateLabel[state] ?? state}
    </span>
  );
}

// â”€â”€ Detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DetailModal({ record, onClose }: { record: AgentCredentialRecord; onClose: () => void }) {
  const claims = record.claims as Record<string, unknown> | undefined;
  const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" };
  const modal: CSSProperties = { background: "#fff", borderRadius: "12px", padding: "2rem", maxWidth: "560px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" };

  const Field = ({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) =>
    value != null ? (
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: "2px" }}>{label}</div>
        <div style={{ fontSize: "0.875rem", color: "#1e293b", fontFamily: mono ? "monospace" : undefined, wordBreak: mono ? "break-all" : undefined, background: mono ? "#f8fafc" : undefined, padding: mono ? "4px 8px" : undefined, borderRadius: mono ? "4px" : undefined }}>{String(value)}</div>
      </div>
    ) : null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#0f3460" }}>{(claims?.studentName as string) ?? "Diploma"}</h2>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "2px" }}>{(claims?.degree as string) ?? ""}</div>
          </div>
          <StatusBadge state={record.protocolState} />
        </div>

        {/* Student info */}
        <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "0.75rem" }}>Student Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <Field label="Full Name" value={claims?.studentName as string} />
            <Field label="Student ID" value={claims?.studentId as string} />
            <Field label="Graduation Date" value={claims?.graduationDate as string} />
            {claims?.gpa != null && <Field label="GPA" value={`${claims.gpa} / 4.0`} />}
          </div>
        </div>

        {/* Credential info */}
        <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "0.75rem" }}>Credential Details</div>
          <Field label="Record ID" value={record.recordId} mono />
          <Field label="Thread ID" value={record.thid} mono />
          <Field label="Connection ID" value={record.connectionId} mono />
          <Field label="Format" value={record.credentialFormat} />
          <Field label="Issued By (DID)" value={record.issuingDID ?? (claims?.universityDid as string)} mono />
          {record.subjectId && <Field label="Student DID" value={record.subjectId} mono />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <Field label="Created" value={new Date(record.createdAt).toLocaleString()} />
            <Field label="Updated" value={new Date(record.updatedAt).toLocaleString()} />
          </div>
        </div>

        {/* JWT */}
        {record.jwt && (
          <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "0.5rem" }}>JWT Token</div>
            <div style={{ fontSize: "0.7rem", fontFamily: "monospace", wordBreak: "break-all", color: "#475569", maxHeight: "80px", overflowY: "auto" }}>{record.jwt}</div>
            <button
              onClick={() => navigator.clipboard.writeText(record.jwt!)}
              style={{ marginTop: "0.5rem", fontSize: "0.75rem", padding: "4px 12px", background: "#0f3460", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Copy JWT
            </button>
          </div>
        )}

        <button onClick={onClose} style={{ width: "100%", padding: "10px", background: "#0f3460", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
          Close
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const tdStyle: CSSProperties = { padding: "10px 12px", fontSize: "0.875rem", verticalAlign: "middle" };

function RecordRow({ record, onClick }: { record: AgentCredentialRecord; onClick: () => void }) {
  const claims = record.claims as Record<string, unknown> | undefined;
  const [hover, setHover] = useState(false);
  return (
    <tr
      style={{ borderBottom: "1px solid #e2e8f0", cursor: "pointer", background: hover ? "#f8fafc" : undefined, transition: "background 0.1s" }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td style={tdStyle}>{(claims?.studentName as string) ?? "â€“"}</td>
      <td style={tdStyle}>{(claims?.studentId as string) ?? "â€“"}</td>
      <td style={tdStyle}>{(claims?.degree as string) ?? "â€“"}</td>
      <td style={tdStyle}>{(claims?.graduationDate as string) ?? "â€“"}</td>
      {claims?.gpa != null && <td style={tdStyle}>{String(claims.gpa)}</td>}
      {claims?.gpa == null && <td style={{ ...tdStyle, color: "#94a3b8" }}>â€“</td>}
      <td style={tdStyle}><StatusBadge state={record.protocolState} /></td>
      <td style={tdStyle}>{new Date(record.createdAt).toLocaleDateString()}</td>
      <td style={{ ...tdStyle, color: "#3b82f6", fontSize: "0.8rem" }}>View &rarr;</td>
    </tr>
  );
}

// â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const stateSummary = (records: AgentCredentialRecord[]) => ({
  total: records.length,
  issued: records.filter((r) => r.protocolState === "CredentialSent").length,
  pending: records.filter((r) => ["OfferSent", "RequestSent", "RequestReceived", "RequestPending", "CredentialPending"].includes(r.protocolState)).length,
  failed: records.filter((r) => r.protocolState === "ProblemReportPending").length,
});

// â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function Dashboard() {
  const { records, loading, error } = useDiplomas();
  const [selected, setSelected] = useState<AgentCredentialRecord | null>(null);
  const stats = stateSummary(records);

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Dashboard</h1>

      {/* Stats */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        {[
          { label: "Total Issued", value: stats.total, color: "#1e3a5f" },
          { label: "Confirmed", value: stats.issued, color: "#16a34a" },
          { label: "Pending", value: stats.pending, color: "#d97706" },
          { label: "Failed", value: stats.failed, color: "#dc2626" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${color}`, borderRadius: "8px", padding: "1rem 1.5rem", minWidth: "140px" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* University DID info */}
      {import.meta.env.VITE_UNIVERSITY_DID && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem 1.5rem", marginBottom: "2rem", fontSize: "0.875rem" }}>
          <strong>University DID:</strong>{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontSize: "0.8rem", wordBreak: "break-all" }}>{import.meta.env.VITE_UNIVERSITY_DID}</code>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e2e8f0", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Issued Diplomas</span>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 400 }}>Click a row to view details</span>
        </div>
        {loading && <div style={{ padding: "2rem", color: "#64748b" }}>Loadingâ€¦</div>}
        {error && <div style={{ padding: "2rem", color: "#dc2626" }}>{error}</div>}
        {!loading && !error && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                  {["Student", "ID", "Degree", "Grad Date", "GPA", "Status", "Created", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                      No diplomas issued yet. Go to <strong>Issue Diploma</strong> to get started.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => <RecordRow key={r.recordId} record={r} onClick={() => setSelected(r)} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <DetailModal record={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
