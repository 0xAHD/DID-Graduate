import { useState, useEffect, useCallback, type CSSProperties } from "react";
import SDK from "@hyperledger/identus-edge-agent-sdk";
import { useWalletContext } from "../context/WalletContext.js";
import { acceptInvitation, sendPresentation } from "../services/edgeAgent.js";
import { DiplomaCard } from "../components/DiplomaCard.js";
import { fetchStudentCredentials, type IssuedCredentialRecord } from "../services/authApi.js";

function extractClaimsForMatch(cred: unknown): { degree?: string; graduationDate?: string } {
  try {
    const c = cred as Record<string, unknown>;
    let raw: unknown =
      c["claims"] ??
      c["credentialSubject"] ??
      (c["vc"] as Record<string, unknown> | undefined)?.["credentialSubject"] ??
      (c["payload"] as Record<string, unknown> | undefined)?.["vc"]?.["credentialSubject" as never];
    if (!raw) return {};
    if (Array.isArray(raw)) {
      const first = raw[0] as Record<string, unknown>;
      if (first && "name" in first && "value" in first) {
        const obj: Record<string, unknown> = {};
        for (const claim of raw as Array<{ name: string; value: unknown }>) {
          if (claim?.name) obj[claim.name] = claim.value;
        }
        raw = obj;
      } else { raw = first; }
    }
    const obj = raw as Record<string, unknown>;
    return { degree: obj["degree"] as string | undefined, graduationDate: obj["graduationDate"] as string | undefined };
  } catch { return {}; }
}

export function Present() {
  const { status, credentials, pendingProofRequest, clearProofRequest, currentUser, token } = useWalletContext();
  const [selectedCred, setSelectedCred] = useState<SDK.Domain.Credential | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [result, setResult] = useState<"sent" | "error" | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [issuedRecords, setIssuedRecords] = useState<IssuedCredentialRecord[]>([]);

  // ── Fetch server-side revocation status ──────────────────────────────────
  const refreshRecords = useCallback(async () => {
    if (!currentUser || !token) return;
    try {
      const records = await fetchStudentCredentials(currentUser.id, token);
      setIssuedRecords(records);
    } catch { /* silently ignore */ }
  }, [currentUser, token]);

  useEffect(() => {
    void refreshRecords();
  }, [refreshRecords]);

  // Build revoked key set (same logic as Home.tsx)
  const activeServerPairs = new Set(
    issuedRecords
      .filter((r) => !r.revoked && !r.revocationPendingAt)
      .map((r) => `${r.degree}||${r.graduationDate}`)
  );
  const revokedPairs = new Set(
    issuedRecords
      .filter((r) => r.revoked || !!r.revocationPendingAt)
      .map((r) => `${r.degree}||${r.graduationDate}`)
      .filter((key) => !activeServerPairs.has(key))
  );

  // Deduplicate and split credentials into valid / revoked
  const seenKeys = new Set<string>();
  const deduped = [...credentials].reverse().filter((c) => {
    const { degree, graduationDate } = extractClaimsForMatch(c);
    if (!degree || !graduationDate) return true;
    const key = `${degree}||${graduationDate}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  }).reverse();

  const validCreds = deduped.filter((c) => {
    const { degree, graduationDate } = extractClaimsForMatch(c);
    return !(degree && graduationDate && revokedPairs.has(`${degree}||${graduationDate}`));
  });
  const revokedCreds = deduped.filter((c) => {
    const { degree, graduationDate } = extractClaimsForMatch(c);
    return !!(degree && graduationDate && revokedPairs.has(`${degree}||${graduationDate}`));
  });

  // ── Connect-via-URL state ────────────────────────────────────────────────
  const [inviteUrl, setInviteUrl] = useState("");
  const [connectStatus, setConnectStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [connectErr, setConnectErr] = useState("");

  const handleConnect = async () => {
    const url = inviteUrl.trim();
    if (!url) return;
    setConnectStatus("connecting");
    setConnectErr("");
    try {
      await acceptInvitation(url);
      setConnectStatus("connected");
      setInviteUrl("");
    } catch (e) {
      setConnectStatus("error");
      setConnectErr(e instanceof Error ? e.message : String(e));
    }
  };

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
          ) : validCreds.length === 0 ? (
            <div style={{ color: "#dc2626", fontSize: "0.875rem" }}>
              All credentials in your wallet have been revoked and cannot be presented.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              {validCreds.map((cred, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedCred(cred)}
                  style={{ cursor: "pointer", border: `2px solid ${selectedCred === cred ? "#3b82f6" : "#e2e8f0"}`, borderRadius: "8px", overflow: "hidden" }}
                >
                  <DiplomaCard credential={cred} compact />
                </div>
              ))}
              {revokedCreds.length > 0 && (
                <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                  {revokedCreds.length} revoked credential{revokedCreds.length > 1 ? "s" : ""} hidden — revoked credentials cannot be presented.
                </div>
              )}
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
              disabled={!selectedCred || presenting || !validCreds.includes(selectedCred)}
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
        <div>
          {/* ── Step 1: paste the connection URL from the verifier portal ── */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.5rem", marginBottom: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Step 1 — Connect to the Verifier</h3>
            <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1rem" }}>
              Ask the employer to click <strong>Start Verification Session</strong> on their portal, then copy the link they generate and paste it below.
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="Paste invitation URL here…"
                value={inviteUrl}
                onChange={e => { setInviteUrl(e.target.value); setConnectStatus("idle"); }}
                disabled={connectStatus === "connecting" || status !== "ready"}
                style={{ flex: 1, padding: "0.6rem 0.75rem", fontSize: "0.875rem", borderRadius: 6, border: "1px solid #cbd5e1", outline: "none" }}
              />
              <button
                onClick={handleConnect}
                disabled={!inviteUrl.trim() || connectStatus === "connecting" || status !== "ready"}
                style={btnStyle("primary")}
              >
                {connectStatus === "connecting" ? "Connecting…" : "Connect"}
              </button>
            </div>
            {connectStatus === "connected" && (
              <p style={{ marginTop: "0.75rem", color: "#15803d", fontSize: "0.875rem" }}>
                ✅ Connected! Waiting for the employer to send a proof request…
              </p>
            )}
            {connectStatus === "error" && (
              <p style={{ marginTop: "0.75rem", color: "#dc2626", fontSize: "0.875rem" }}>{connectErr}</p>
            )}
            {status !== "ready" && (
              <p style={{ marginTop: "0.75rem", color: "#d97706", fontSize: "0.8rem" }}>
                ⚠ Start your wallet first (go to <strong>My Diplomas</strong>).
              </p>
            )}
          </div>

          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
            Once the employer sends the proof request it will appear here automatically.
          </div>
        </div>
      )}
    </>
  );
}
