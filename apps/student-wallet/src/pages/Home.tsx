import type { CSSProperties } from "react";
import { useWalletContext } from "../context/WalletContext.js";
import { DiplomaCard } from "../components/DiplomaCard.js";

const statusColor: Record<string, string> = {
  idle: "#94a3b8",
  starting: "#f59e0b",
  connecting: "#3b82f6",
  ready: "#16a34a",
  error: "#dc2626",
};

const statusLabel: Record<string, string> = {
  idle: "Stopped",
  starting: "Starting wallet…",
  connecting: "Connecting to issuer…",
  ready: "Ready \u2713",
  error: "Error",
};

export function Home() {
  const { status, credentials, error, connectionError, isConnecting, currentUser, walletDid, retryConnection } = useWalletContext();

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>
        My Diplomas
      </h1>
      {currentUser && (
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Welcome, <strong>{currentUser.name}</strong>
          {currentUser.studentNumber ? ` (${currentUser.studentNumber})` : ""}
        </p>
      )}

      {walletDid && (
        <p
          title={walletDid}
          onClick={() => navigator.clipboard.writeText(walletDid)}
          style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b", marginBottom: "1.5rem", cursor: "pointer", borderBottom: "1px dashed #cbd5e1", display: "inline-block" }}
        >
          DID: {walletDid.slice(0, 28)}&hellip;{walletDid.slice(-10)}
        </p>
      )}

      {/* Wallet status pill */}
      <div style={pillContainerStyle}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 12px",
            borderRadius: "999px",
            background: "#f1f5f9",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: statusColor[status] ?? "#64748b",
          }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: statusColor[status] ?? "#64748b", display: "inline-block" }} />
          {statusLabel[status] ?? status}
        </span>
        {error && (
          <span style={{ marginLeft: "1rem", fontSize: "0.8rem", color: "#dc2626" }}>
            {error}
          </span>
        )}
      </div>

      {/* Issuer connection status */}
      {status === "ready" && (
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {currentUser?.connectionId ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 600, background: "#dcfce7", color: "#15803d" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
              Connected to issuer
            </span>
          ) : (
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 600, background: "#fef3c7", color: "#b45309" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                Not connected to issuer
              </span>
              <button
                onClick={retryConnection}
                disabled={isConnecting}
                style={{ padding: "3px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", cursor: isConnecting ? "not-allowed" : "pointer", fontSize: "0.78rem", fontWeight: 600, opacity: isConnecting ? 0.6 : 1 }}
              >
                {isConnecting ? "Connecting…" : "Connect now"}
              </button>
              {connectionError && (
                <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>
                  ⚠ {connectionError}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Diplomas */}
      {status === "ready" && credentials.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
          No diplomas yet. Your issuer will send you one when you're graduated.
        </div>
      )}

      {credentials.map((cred, i) => (
        <DiplomaCard key={i} credential={cred} />
      ))}
    </>
  );
}

const pillContainerStyle: CSSProperties = {
  marginBottom: "1.5rem",
  display: "flex",
  alignItems: "center",
};

