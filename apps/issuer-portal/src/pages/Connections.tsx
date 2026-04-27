import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createConnection, listConnections } from "../services/agentApi.js";
import type { AgentConnection } from "@university-diplomas/common";

const btnStyle = (variant: "primary" | "secondary"): CSSProperties => ({
  padding: "8px 20px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.875rem",
  background: variant === "primary" ? "#1e3a5f" : "#e2e8f0",
  color: variant === "primary" ? "#fff" : "#374151",
});

function stateColor(state: string): string {
  if (state === "ConnectionResponseSent") return "#22c55e";
  if (state === "InvitationGenerated") return "#f59e0b";
  return "#94a3b8";
}

export function Connections() {
  const [connections, setConnections] = useState<AgentConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newInvUrl, setNewInvUrl] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await listConnections();
      setConnections(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleCreate = async () => {
    if (!label.trim()) return;
    setCreating(true);
    try {
      const conn = await createConnection(label.trim());
      setNewInvUrl(conn.invitationUrl);
      setLabel("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create connection");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Student Connections</h1>
      <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem" }}>
        A connection must be established with each student wallet before issuing a diploma.
        When you issue a diploma, a connection QR code is automatically generated —
        this page lets you pre-create connections or review existing ones.
      </p>

      {/* Create new */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>
              Connection Label
            </label>
            <input
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Alice Johnson – CS 2024"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <button style={btnStyle("primary")} onClick={handleCreate} disabled={creating || !label.trim()}>
            {creating ? "Creating…" : "Create Invitation"}
          </button>
        </div>

        {newInvUrl && (
          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }}>Scan with student wallet:</p>
            <div style={{ display: "inline-block", padding: "1rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <QRCodeSVG value={newInvUrl} size={180} />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <input
                readOnly
                value={newInvUrl}
                style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.75rem" }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>
          </div>
        )}
      </div>

      {/* Connections list */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e2e8f0", fontWeight: 700 }}>
          All Connections ({connections.length})
        </div>
        {loading && <div style={{ padding: "2rem", color: "#64748b" }}>Loading…</div>}
        {error && <div style={{ padding: "2rem", color: "#dc2626" }}>{error}</div>}
        {!loading && connections.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>No connections yet.</div>
        )}
        {connections.map((c) => (
          <div key={c.connectionId} style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.label ?? "(unlabeled)"}</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{c.connectionId}</div>
            </div>
            <span style={{ background: stateColor(c.state) + "22", color: stateColor(c.state), border: `1px solid ${stateColor(c.state)}`, borderRadius: "999px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600 }}>
              {c.state}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
