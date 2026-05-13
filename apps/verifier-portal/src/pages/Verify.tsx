import { useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import QRCode from "qrcode";
import {
  createVerifierConnection,
  pollConnectionRecord,
  createProofRequest,
  pollPresentationRecord,
  verifyCardanoHash,
  type PresentationRecord,
  type ConnectionRecord,
} from "../services/verifierApi.js";

type Step = "idle" | "connecting" | "connected" | "requesting" | "polling" | "done" | "error";

interface VerifyResult {
  status: "verified" | "failed";
  claims?: Record<string, unknown>;
  presentationRecord?: PresentationRecord;
  cardanoVerified?: boolean;
  cardanoTxId?: string;
  errorMessage?: string;
}

export function Verify() {
  const [step, setStep] = useState<Step>("idle");
  const [invitationUrl, setInvitationUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [connectionId, setConnectionId] = useState<string>("");
  const [presentationId, setPresentationId] = useState<string>("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string>("");
  const [urlCopied, setUrlCopied] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startVerification = useCallback(async () => {
    setStep("connecting");
    setError("");
    setResult(null);
    setQrDataUrl("");
    setInvitationUrl("");
    setConnectionId("");      setUrlCopied(false);
    try {
      const conn: ConnectionRecord = await createVerifierConnection();
      setConnectionId(conn.connectionId);
      const oobUrl = conn.invitation?.invitationUrl ?? "";
      setInvitationUrl(oobUrl);
      const qr = await QRCode.toDataURL(oobUrl, { width: 280, margin: 1 });
      setQrDataUrl(qr);

      // Poll for connection acceptance
      let connectionAccepted = false;
      pollTimerRef.current = setInterval(async () => {
        try {
          const updated = await pollConnectionRecord(conn.connectionId);
          if (
            updated.state === "ConnectionResponseSent" ||
            updated.state === "ConnectionResponseReceived"
          ) {
            stopPolling();
            connectionAccepted = true;
            setStep("connected");
            await sendProofRequest(conn.connectionId);
          }
        } catch {
          // silently retry
        }
      }, 3000);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!connectionAccepted) {
          stopPolling();
          setStep("error");
          setError("Connection timed out. The student did not accept the invitation within 5 minutes.");
        }
      }, 300_000);
    } catch (err: unknown) {
      setStep("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [stopPolling]);

  const sendProofRequest = useCallback(async (connId: string) => {
    setStep("requesting");
    try {
      const presentation = await createProofRequest({
        connectionId: connId,
        issuingDid: import.meta.env.VITE_UNIVERSITY_DID ?? "",
        schemaId: import.meta.env.VITE_DIPLOMA_SCHEMA_ID ?? "",
      });
      setPresentationId(presentation.presentationId);
      setStep("polling");

      // Poll for presentation result
      pollTimerRef.current = setInterval(async () => {
        try {
          const updated = await pollPresentationRecord(presentation.presentationId);
          if (updated.status === "PresentationVerified") {
            stopPolling();
            const claims = extractClaims(updated);
            let cardanoVerified: boolean | undefined;
            let cardanoTxId: string | undefined;

            // Optionally verify on-chain hash
            const vcJwt = extractVcJwt(updated);
            if (vcJwt) {
              try {
                const onchain = await verifyCardanoHash(vcJwt);
                cardanoVerified = onchain.verified;
                cardanoTxId = onchain.txId;
              } catch {
                // Cardano verification is optional — don't fail
                cardanoVerified = undefined;
              }
            }

            setResult({ status: "verified", claims, presentationRecord: updated, cardanoVerified, cardanoTxId });
            setStep("done");
          } else if (
            updated.status === "PresentationFailed" ||
            updated.status === "PresentationRejected"
          ) {
            stopPolling();
            setResult({ status: "failed", errorMessage: "Presentation failed or was rejected by the agent." });
            setStep("done");
          }
        } catch {
          // silently retry
        }
      }, 3000);
    } catch (err: unknown) {
      setStep("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setStep("idle");
    setError("");
    setResult(null);
    setQrDataUrl("");
    setInvitationUrl("");
    setConnectionId("");
    setPresentationId("");
    setUrlCopied(false);
  }, [stopPolling]);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Verify Diploma Credential</h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
        Generate a connection link and share it with the student. They paste it into their wallet to connect and share their diploma credential.
      </p>

      {step === "idle" && (
        <button
          onClick={startVerification}
          style={btnStyle("#1a3c2e", "#fff")}
        >
          Start Verification Session
        </button>
      )}

      {(step === "connecting" || step === "connected" || step === "requesting" || step === "polling") && (
        <div>
          <StepIndicator current={step} />

          {step === "connecting" && invitationUrl && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>Step 1 — Share this link with the student</h3>
              <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
                Copy the link below and send it to the student. They paste it into the <strong>Present Diploma</strong> page of their wallet to establish a secure connection.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1.25rem" }}>
                <input
                  readOnly
                  value={invitationUrl}
                  style={{ flex: 1, padding: "0.6rem 0.75rem", fontSize: "0.78rem", borderRadius: 6, border: "1px solid #d1d5db", background: "#f3f4f6", color: "#374151", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => { void navigator.clipboard.writeText(invitationUrl).then(() => { setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000); }); }}
                  style={{ ...btnStyle(urlCopied ? "#059669" : "#1a3c2e", "#fff"), padding: "0.6rem 1rem", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {urlCopied ? "✓ Copied" : "Copy Link"}
                </button>
              </div>
              {qrDataUrl && (
                <details style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "1rem" }}>
                  <summary style={{ cursor: "pointer" }}>Show QR code (for mobile wallets)</summary>
                  <div style={{ textAlign: "center", margin: "1rem 0" }}>
                    <img src={qrDataUrl} alt="DIDComm invitation QR code" style={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                  </div>
                </details>
              )}
              <p style={{ textAlign: "center", color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
                ⏳ Waiting for student to accept connection...
              </p>
            </div>
          )}

          {step === "connected" && (
            <div style={cardStyle}>
              <p>✅ Connection established with student wallet.</p>
              <p style={{ color: "#6b7280" }}>Sending proof request…</p>
            </div>
          )}

          {step === "requesting" && (
            <div style={cardStyle}>
              <p>📤 Proof request sent. Waiting for student to share credential…</p>
            </div>
          )}

          {step === "polling" && (
            <div style={cardStyle}>
              <p>🔄 Verifying presentation… (connection: <code>{connectionId.slice(0, 8)}…</code>)</p>
              <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>This may take up to 30 seconds.</p>
            </div>
          )}
        </div>
      )}

      {step === "done" && result && (
        <div>
          {result.status === "verified" ? (
            <div style={{ ...cardStyle, borderLeft: "4px solid #10b981" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "2rem" }}>✅</span>
                <div>
                  <h2 style={{ color: "#065f46", margin: 0 }}>Diploma Verified</h2>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>Cryptographic proof accepted by the Identus agent</p>
                </div>
              </div>

              {result.claims && <DiplomaDisplay claims={result.claims} />}

              {result.cardanoVerified !== undefined && (
                <div style={cardanoBoxStyle(result.cardanoVerified)}>
                  {result.cardanoVerified
                    ? <>🔗 On-chain hash verified on Cardano preprod
                        {result.cardanoTxId && (
                          <> — <a href={`https://preprod.cardanoscan.io/transaction/${result.cardanoTxId}`} target="_blank" rel="noreferrer">View on Cardanoscan</a></>
                        )}
                      </>
                    : "⚠️ Credential hash not found on Cardano preprod (VC may not have been anchored yet)"}
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, borderLeft: "4px solid #ef4444" }}>
              <h2 style={{ color: "#7f1d1d", marginTop: 0 }}>❌ Verification Failed</h2>
              <p>{result.errorMessage}</p>
            </div>
          )}
          <button onClick={reset} style={{ ...btnStyle("#6b7280", "#fff"), marginTop: "1rem" }}>
            Start New Verification
          </button>
        </div>
      )}

      {step === "error" && (
        <div style={{ ...cardStyle, borderLeft: "4px solid #ef4444" }}>
          <h3 style={{ color: "#7f1d1d", marginTop: 0 }}>Error</h3>
          <p>{error}</p>
          <button onClick={reset} style={btnStyle("#6b7280", "#fff")}>Try Again</button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractClaims(record: PresentationRecord): Record<string, unknown> {
  try {
    const raw = (record as unknown as Record<string, unknown>).data
      ?? (record as unknown as Record<string, unknown>).presentation;
    // data is an array of JWT strings in the agent v2 response
    const jwt = Array.isArray(raw) ? raw[0] : raw;
    if (typeof jwt === "string") {
      const payload = jwt.split(".")[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      // VP wraps a VC inside verifiableCredential[0]
      const vcJwt = decoded?.vp?.verifiableCredential?.[0];
      if (typeof vcJwt === "string") {
        const vcPayload = vcJwt.split(".")[1];
        const vc = JSON.parse(atob(vcPayload.replace(/-/g, "+").replace(/_/g, "/")));
        return { ...vc?.vc?.credentialSubject ?? {}, _issuer: vc?.iss, _issuedAt: vc?.iat };
      }
      return decoded?.vc?.credentialSubject ?? decoded ?? {};
    }
    return {};
  } catch {
    return {};
  }
}

function extractVcJwt(record: PresentationRecord): string | null {
  try {
    const raw = (record as unknown as Record<string, unknown>).data
      ?? (record as unknown as Record<string, unknown>).presentation;
    const jwt = Array.isArray(raw) ? raw[0] : raw;
    if (typeof jwt !== "string") return null;
    // Extract the inner VC JWT from the VP
    const payload = jwt.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded?.vp?.verifiableCredential?.[0] ?? jwt;
  } catch {
    return null;
  }
}

const LABEL: Record<string, string> = {
  studentName: "Student Name",
  universityName: "University",
  degree: "Degree",
  graduationDate: "Graduation Date",
  gpa: "GPA",
  studentId: "Student ID",
  _issuer: "Issuer DID",
  _issuedAt: "Issued At",
};

function DiplomaDisplay({ claims }: { claims: Record<string, unknown> }) {
  const primary = ["studentName", "universityName", "degree", "graduationDate", "gpa", "studentId"];
  const meta = ["_issuer", "_issuedAt"];

  const row = (key: string, value: unknown) => {
    let display = String(value);
    if (key === "_issuedAt" && typeof value === "number") {
      display = new Date(value * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }
    if (key === "_issuer") {
      display = String(value).length > 60 ? String(value).slice(0, 32) + "…" + String(value).slice(-16) : String(value);
    }
    return (
      <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {LABEL[key] ?? key}
        </span>
        <span style={{ fontWeight: key === "studentName" || key === "degree" ? 700 : 500, color: "#111827", fontSize: key === "studentName" ? "1rem" : "0.9rem" }}>
          {display}
        </span>
      </div>
    );
  };

  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem 1.25rem", margin: "0.5rem 0 1rem" }}>
      {primary.filter(k => claims[k] != null).map(k => row(k, claims[k]))}
      {meta.filter(k => claims[k] != null).length > 0 && (
        <details style={{ marginTop: "0.5rem" }}>
          <summary style={{ fontSize: "0.8rem", color: "#9ca3af", cursor: "pointer" }}>Technical details</summary>
          <div style={{ marginTop: "0.5rem" }}>
            {meta.filter(k => claims[k] != null).map(k => row(k, claims[k]))}
          </div>
        </details>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: "connecting", label: "Connect" },
    { key: "connected", label: "Connected" },
    { key: "requesting", label: "Request Proof" },
    { key: "polling", label: "Verify" },
  ];
  const order: Step[] = ["connecting", "connected", "requesting", "polling"];
  const currentIndex = order.indexOf(current);

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", alignItems: "center" }}>
      {steps.map((s, i) => (
        <span
          key={s.key}
          style={{
            padding: "0.3rem 0.75rem",
            borderRadius: 20,
            fontSize: "0.8rem",
            background: i <= currentIndex ? "#1a3c2e" : "#e5e7eb",
            color: i <= currentIndex ? "#fff" : "#6b7280",
            fontWeight: i === currentIndex ? 700 : 400,
          }}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "1.5rem",
  marginBottom: "1rem",
};

const btnStyle = (bg: string, color: string): CSSProperties => ({
  background: bg,
  color,
  border: "none",
  borderRadius: 6,
  padding: "0.65rem 1.4rem",
  fontSize: "0.95rem",
  cursor: "pointer",
  fontWeight: 600,
});

const cardanoBoxStyle = (verified: boolean): CSSProperties => ({
  marginTop: "1rem",
  padding: "0.75rem",
  borderRadius: 6,
  background: verified ? "#d1fae5" : "#fef3c7",
  color: verified ? "#065f46" : "#92400e",
  fontSize: "0.875rem",
});
