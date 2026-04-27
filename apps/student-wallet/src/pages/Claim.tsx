import { useState, type CSSProperties } from "react";
import { useWalletContext } from "../context/WalletContext.js";
import { acceptInvitation } from "../services/edgeAgent.js";

export function Claim() {
  const { status, start } = useWalletContext();
  const [url, setUrl] = useState("");
  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const handleClaim = async () => {
    if (!url.trim()) return;
    setClaimStatus("claiming");
    setErrMsg("");
    try {
      await acceptInvitation(url.trim());
      setClaimStatus("success");
      setUrl("");
    } catch (e) {
      setClaimStatus("error");
      setErrMsg(e instanceof Error ? e.message : String(e));
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Claim Diploma</h1>

      {status !== "ready" && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "8px", padding: "1rem 1.5rem", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
          ⚠ Your wallet is not started. <button style={{ ...btnStyle("primary"), padding: "4px 12px", fontSize: "0.8rem" }} onClick={start}>Start Wallet</button>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "2rem", maxWidth: "600px" }}>
        <p style={{ marginTop: 0, fontSize: "0.875rem", color: "#64748b" }}>
          Paste the invitation URL from the issuer portal QR code below. After connecting, wait a few seconds — the diploma will appear in <strong>My Diplomas</strong> automatically.
        </p>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.875rem" }}>
            Invitation URL
          </label>
          <textarea
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.875rem", minHeight: "80px", resize: "vertical" }}
            placeholder="https://your-domain/?_oob=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={claimStatus === "claiming"}
          />
        </div>

        {claimStatus === "error" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "6px", padding: "10px 14px", marginBottom: "1rem", fontSize: "0.875rem", color: "#dc2626" }}>
            {errMsg}
          </div>
        )}

        {claimStatus === "success" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "6px", padding: "10px 14px", marginBottom: "1rem", fontSize: "0.875rem", color: "#16a34a" }}>
            ✅ Connection accepted! Your diploma will appear in <strong>My Diplomas</strong> once the issuer sends it (usually within 3–10 seconds).
          </div>
        )}

        <button
          style={btnStyle("primary")}
          onClick={handleClaim}
          disabled={!url.trim() || claimStatus === "claiming" || status !== "ready"}
        >
          {claimStatus === "claiming" ? "Connecting…" : "Accept Invitation"}
        </button>
      </div>

      <div style={{ marginTop: "2rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.25rem", fontSize: "0.8rem", color: "#64748b" }}>
        <strong>How it works:</strong>
        <ol style={{ paddingLeft: "1.25rem", lineHeight: 1.8, marginTop: "0.5rem" }}>
          <li>You paste the OOB (Out-of-Band) invitation URL from the university issuer portal.</li>
          <li>Your wallet creates a DIDComm connection with the university's Cloud Agent.</li>
          <li>The university agent sends a <em>credential offer</em> via DIDComm.</li>
          <li>Your wallet auto-accepts the offer and sends back a <em>credential request</em>.</li>
          <li>The university agent signs the JWT credential and returns it through DIDComm.</li>
          <li>Your wallet stores the credential in IndexedDB — it's yours forever.</li>
        </ol>
      </div>
    </>
  );
}
