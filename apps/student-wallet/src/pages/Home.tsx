import type { CSSProperties } from "react";
import { useWalletContext } from "../context/WalletContext.js";
import { DiplomaCard } from "../components/DiplomaCard.js";

const btnStyle = (variant: "primary" | "secondary"): CSSProperties => ({
  padding: "10px 24px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  background: variant === "primary" ? "#0f3460" : "#e2e8f0",
  color: variant === "primary" ? "#fff" : "#374151",
});

export function Home() {
  const { status, credentials, error, start, stop } = useWalletContext();

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>My Diplomas</h1>

      {/* Wallet status / control */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.25rem", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Wallet status: </span>
          <span style={{ color: status === "ready" ? "#16a34a" : status === "error" ? "#dc2626" : "#f59e0b", fontWeight: 700 }}>
            {status === "idle" && "Stopped"}
            {status === "starting" && "Connecting to mediator…"}
            {status === "ready" && "Connected ✓"}
            {status === "error" && "Error"}
          </span>
          {error && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#dc2626", maxWidth: "480px", whiteSpace: "pre-wrap" }}>{error}</div>
          )}
        </div>
        {status === "idle" || status === "error" ? (
          <button style={btnStyle("primary")} onClick={start}>
            Start Wallet
          </button>
        ) : (
          <button style={btnStyle("secondary")} onClick={stop} disabled={status === "starting"}>
            Stop Wallet
          </button>
        )}
      </div>

      {/* Info box for first-time setup */}
      {status === "idle" && (
        <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "8px", padding: "1.25rem", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
          <strong>First time?</strong>
          <ol style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", lineHeight: 1.8 }}>
            <li>Click <strong>Start Wallet</strong> above to create your wallet and connect to the mediator.</li>
            <li>Your wallet keys are stored securely in your browser's IndexedDB.</li>
            <li>Go to <strong>Claim Diploma</strong> to scan the QR code from your university.</li>
          </ol>
        </div>
      )}

      {/* Diplomas */}
      {status === "ready" && credentials.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
          No diplomas yet. <br />
          Go to <strong>Claim Diploma</strong> to claim your first diploma.
        </div>
      )}

      {credentials.map((cred, i) => (
        <DiplomaCard key={i} credential={cred} />
      ))}
    </>
  );
}
