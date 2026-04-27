import { useState, type CSSProperties } from "react";
import SDK from "@hyperledger/identus-edge-agent-sdk";
import { useWalletContext } from "../context/WalletContext.js";
import { sendPresentation } from "../services/edgeAgent.js";
import { DiplomaCard } from "../components/DiplomaCard.js";

export function Present() {
  const { status, credentials, pendingProofRequest, clearProofRequest } = useWalletContext();
  const [selectedCred, setSelectedCred] = useState<SDK.Domain.Credential | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [result, setResult] = useState<"sent" | "error" | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const handlePresent = async () => {
    if (!pendingProofRequest || !selectedCred) return;
    setPresenting(true);
    setResult(null);
    try {
      await sendPresentation(pendingProofRequest, selectedCred);
      setResult("sent");
      clearProofRequest();
      setSelectedCred(null);
    } catch (e) {
      setResult("error");
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPresenting(false);
    }
  };

  const btnStyle = (variant: "primary" | "secondary"): CSSProperties => ({
    padding: "10px 24px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    background: variant === "primary" ? "#0f3460" : "#e2e8f0",
    color: variant === "primary" ? "#fff" : "#374151",
  });

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Present Diploma</h1>

      {status !== "ready" && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "8px", padding: "1rem 1.5rem", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
          ⚠ Start your wallet first (go to <strong>My Diplomas</strong>).
        </div>
      )}

      {/* Incoming proof request banner */}
      {pendingProofRequest && (
        <div style={{ background: "#eff6ff", border: "2px solid #3b82f6", borderRadius: "8px", padding: "1.25rem", marginBottom: "2rem" }}>
          <div style={{ fontWeight: 700, color: "#1d4ed8", marginBottom: "0.5rem" }}>
            📋 Proof Request Received!
          </div>
          <p style={{ fontSize: "0.875rem", color: "#1e40af", margin: "0 0 1rem" }}>
            An employer is requesting proof of your diploma. Select which diploma to present below, then click <strong>Send Presentation</strong>.
          </p>

          {credentials.length === 0 ? (
            <div style={{ color: "#dc2626", fontSize: "0.875rem" }}>No credentials found in wallet.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              {credentials.map((cred, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedCred(cred)}
                  style={{ cursor: "pointer", border: `2px solid ${selectedCred === cred ? "#3b82f6" : "#e2e8f0"}`, borderRadius: "8px", overflow: "hidden" }}
                >
                  <DiplomaCard credential={cred} compact />
                </div>
              ))}
            </div>
          )}

          {result === "error" && (
            <div style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: "1rem" }}>{errMsg}</div>
          )}

          <div style={{ display: "flex", gap: "1rem" }}>
            <button style={btnStyle("secondary")} onClick={clearProofRequest} disabled={presenting}>
              Decline
            </button>
            <button
              style={btnStyle("primary")}
              onClick={handlePresent}
              disabled={!selectedCred || presenting}
            >
              {presenting ? "Sending…" : "Send Presentation →"}
            </button>
          </div>
        </div>
      )}

      {result === "sent" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "1.25rem", marginBottom: "1.5rem", fontSize: "0.875rem", color: "#15803d" }}>
          ✅ Presentation sent! The employer's portal will verify it automatically.
        </div>
      )}

      {!pendingProofRequest && result !== "sent" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>
          Waiting for a proof request from an employer…
          <br />
          <span style={{ fontSize: "0.8rem", marginTop: "0.5rem", display: "block" }}>
            Ask the employer to scan your connection QR code from the Verifier Portal, then come back here.
          </span>
        </div>
      )}

      <div style={{ marginTop: "2rem", fontSize: "0.8rem", color: "#94a3b8" }}>
        <strong>Your stored diplomas ({credentials.length}):</strong>
        {credentials.map((cred, i) => <DiplomaCard key={i} credential={cred} />)}
      </div>
    </>
  );
}
