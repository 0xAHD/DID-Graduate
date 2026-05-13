import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

const ISSUER_API_URL = import.meta.env.VITE_ISSUER_API_URL ?? "http://localhost:3002";

interface ShareData {
  degree: string;
  graduationDate: string;
  gpa?: number;
  studentName: string;
  universityName: string;
  issuingDid?: string;
  vcHash?: string;
  cardanoTxHash?: string;
  cardanoscanUrl?: string;
  cardanoRevocationTxHash?: string;
  cardanoRevocationUrl?: string;
  revoked: boolean;
  revocationReason?: string;
  revocationConfirmedAt?: string;
  issuedAt: string;
  walletConfirmedAt?: string;
  sharedAt: string;
}

type LoadState = "loading" | "loaded" | "not-found" | "error";

export function ShareVerify() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!token) { setLoadState("not-found"); return; }

    fetch(`${ISSUER_API_URL}/api/share/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 404) { setLoadState("not-found"); return; }
        if (!res.ok) { setLoadState("error"); return; }
        const body = await res.json() as ShareData;
        setData(body);
        setLoadState("loaded");
      })
      .catch(() => setLoadState("error"));
  }, [token]);

  const page: CSSProperties = {
    minHeight: "100vh",
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    fontFamily: "sans-serif",
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <div style={page}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
        <p style={{ color: "#64748b" }}>Loading credential…</p>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (loadState === "not-found") {
    return (
      <div style={page}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔗</div>
        <h1 style={{ color: "#1e293b", marginBottom: "0.5rem" }}>Link not found</h1>
        <p style={{ color: "#64748b", textAlign: "center", maxWidth: "400px" }}>
          This share link is invalid or has been revoked by the student.
        </p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (loadState === "error" || !data) {
    return (
      <div style={page}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h1 style={{ color: "#1e293b", marginBottom: "0.5rem" }}>Could not load credential</h1>
        <p style={{ color: "#64748b" }}>Please try again later.</p>
      </div>
    );
  }

  const isRevoked = data.revoked;

  // ── Loaded ─────────────────────────────────────────────────────────────────
  const card: CSSProperties = {
    background: "#fff",
    border: isRevoked ? "2px solid #fca5a5" : "2px solid #86efac",
    borderRadius: "12px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    padding: "2.5rem",
    maxWidth: "560px",
    width: "100%",
  };

  const badge: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 14px",
    borderRadius: "999px",
    fontWeight: 700,
    fontSize: "0.85rem",
    background: isRevoked ? "#fee2e2" : "#dcfce7",
    color: isRevoked ? "#dc2626" : "#15803d",
    marginBottom: "1.5rem",
  };

  const label: CSSProperties = {
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#94a3b8",
    marginBottom: "2px",
  };

  const value: CSSProperties = {
    fontWeight: 600,
    color: "#1e293b",
    fontSize: "0.95rem",
  };

  const divider: CSSProperties = {
    borderTop: "1px solid #e2e8f0",
    margin: "1.25rem 0",
  };

  return (
    <div style={page}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.25rem" }}>🎓</div>
        <h1 style={{ fontSize: "1.4rem", color: "#0f3460", margin: 0, fontWeight: 800 }}>
          University Diploma Verification
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "0.25rem" }}>
          This credential was digitally signed and is cryptographically verifiable.
        </p>
      </div>

      <div style={card}>
        {/* Status badge */}
        <div style={{ textAlign: "center" }}>
          <span style={badge}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: isRevoked ? "#dc2626" : "#16a34a", display: "inline-block" }} />
            {isRevoked ? "Revoked" : "✓ Verified"}
          </span>
        </div>

        {/* University */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "2px" }}>
            Issued by
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f3460" }}>
            {data.universityName ?? "University"}
          </div>
        </div>

        <hr style={divider} />

        {/* Student & Degree */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <div style={label}>Student Name</div>
            <div style={value}>{data.studentName}</div>
          </div>
          <div>
            <div style={label}>Degree</div>
            <div style={value}>{data.degree}</div>
          </div>
          <div>
            <div style={label}>Graduation Date</div>
            <div style={value}>{data.graduationDate}</div>
          </div>
          {data.gpa !== undefined && (
            <div>
              <div style={label}>GPA</div>
              <div style={value}>{data.gpa} / 4.0</div>
            </div>
          )}
        </div>

        <hr style={divider} />

        {/* Revocation notice */}
        {isRevoked && (
          <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: "4px" }}>⚠ This diploma has been revoked</div>
            {data.revocationReason && (
              <div style={{ fontSize: "0.85rem", color: "#b91c1c" }}>Reason: {data.revocationReason}</div>
            )}
            {data.revocationConfirmedAt && (
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>
                Revoked on: {new Date(data.revocationConfirmedAt).toLocaleDateString()}
              </div>
            )}
            {data.cardanoRevocationUrl && (
              <a href={data.cardanoRevocationUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: "0.78rem", color: "#dc2626", fontWeight: 600, display: "block", marginTop: "4px" }}>
                ⛓ View revocation on Cardano ↗
              </a>
            )}
          </div>
        )}

        {/* Cardano anchor */}
        {data.cardanoscanUrl && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "#1d4ed8", fontSize: "0.85rem", marginBottom: "2px" }}>
                ⛓ Anchored on Cardano blockchain
              </div>
              <div style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "6px" }}>
                An immutable timestamped record of this diploma exists on the Cardano preprod blockchain.
              </div>
              <a href={data.cardanoscanUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: "0.78rem", color: "#1d4ed8", fontWeight: 600 }}>
                View on Cardanoscan ↗
              </a>
            </div>
            <div style={{ flexShrink: 0 }}>
              <QRCodeSVG value={data.cardanoscanUrl} size={70} />
            </div>
          </div>
        )}

        {/* Technical details */}
        {(data.vcHash || data.issuingDid) && (
          <details style={{ marginTop: "0.5rem" }}>
            <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
              Technical details
            </summary>
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.vcHash && (
                <div>
                  <div style={label}>Credential Hash (SHA-256)</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#475569", wordBreak: "break-all" }}>
                    {data.vcHash}
                  </div>
                </div>
              )}
              {data.issuingDid && (
                <div>
                  <div style={label}>Issuer DID</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#475569", wordBreak: "break-all" }}>
                    {data.issuingDid}
                  </div>
                </div>
              )}
              <div>
                <div style={label}>Issued At</div>
                <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                  {data.issuedAt ? new Date(data.issuedAt).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </details>
        )}
      </div>

      <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", maxWidth: "480px" }}>
        This link was shared by the credential holder. It is valid until they choose to revoke it.
        Verification is backed by a cryptographic signature from {data.universityName ?? "the issuing university"}.
      </p>
    </div>
  );
}
