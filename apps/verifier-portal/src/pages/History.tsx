import { useState, useEffect, type CSSProperties } from "react";
import { listPresentationRecords, type PresentationRecord } from "../services/verifierApi.js";

export function History() {
  const [records, setRecords] = useState<PresentationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listPresentationRecords()
      .then(setRecords)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading presentation history…</p>;
  if (error) return <p style={{ color: "#ef4444" }}>Error: {error}</p>;
  if (records.length === 0) return <p style={{ color: "#6b7280" }}>No presentations found. Verifications will appear here.</p>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Verification History</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            <th style={th}>Presentation ID</th>
            <th style={th}>Connection ID</th>
            <th style={th}>Status</th>
            <th style={th}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.presentationId} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={td}><code>{r.presentationId.slice(0, 8)}…</code></td>
              <td style={td}><code>{r.connectionId ? r.connectionId.slice(0, 8) + "…" : "—"}</code></td>
              <td style={td}>
                <StatusBadge status={r.status} />
              </td>
              <td style={td}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    PresentationVerified: { bg: "#d1fae5", color: "#065f46" },
    PresentationFailed: { bg: "#fee2e2", color: "#7f1d1d" },
    PresentationRejected: { bg: "#fee2e2", color: "#7f1d1d" },
    RequestPending: { bg: "#fef3c7", color: "#92400e" },
    RequestSent: { bg: "#dbeafe", color: "#1e3a8a" },
    PresentationReceived: { bg: "#e0e7ff", color: "#3730a3" },
  };
  const s = colors[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{ ...s, padding: "0.2rem 0.6rem", borderRadius: 12, fontSize: "0.8rem", fontWeight: 600 }}>
      {status}
    </span>
  );
}

const th: CSSProperties = { padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" };
const td: CSSProperties = { padding: "0.6rem 0.75rem" };
