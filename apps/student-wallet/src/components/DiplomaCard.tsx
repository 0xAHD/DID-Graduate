import { useState } from "react";
import type { CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
import SDK from "@hyperledger/identus-edge-agent-sdk";
import type { DiplomaCredentialSubject } from "@university-diplomas/common";

interface DiplomaCardProps {
  credential: SDK.Domain.Credential;
  compact?: boolean;
  revoked?: boolean;
  revocationReason?: string;
  revocationDate?: string;
  cardanoscanUrl?: string;
  cardanoRevocationUrl?: string;
  walletConfirmedAt?: string;
  vcHash?: string;
}

function extractClaims(credential: SDK.Domain.Credential): DiplomaCredentialSubject | null {
  try {
    const c = credential as unknown as Record<string, unknown>;

    let raw =
      c["claims"] ??
      c["credentialSubject"] ??
      (c["vc"] as Record<string, unknown> | undefined)?.["credentialSubject"] ??
      (c["payload"] as Record<string, unknown> | undefined)?.["vc"]?.["credentialSubject" as never];

    if (!raw) return null;

    // Array case: could be [{name, value}...] OR [credentialSubjectObject]
    if (Array.isArray(raw)) {
      if (raw.length === 0) return null;
      const first = raw[0] as Record<string, unknown>;
      // If first element has a "name" key it's a {name,value} array — convert to object
      if (first && typeof first === "object" && "name" in first && "value" in first) {
        const obj: Record<string, unknown> = {};
        for (const claim of raw as Array<{ name: string; value: unknown }>) {
          if (claim?.name) obj[claim.name] = claim.value;
        }
        raw = obj;
      } else {
        // First element IS the credentialSubject object
        raw = first;
      }
    }

    return raw as DiplomaCredentialSubject;
  } catch (e) {
    console.error("[DiplomaCard] extractClaims error:", e);
    return null;
  }
}

// -- Print certificate -------------------------------------------------------

function printCertificate(claims: DiplomaCredentialSubject, cardanoscanUrl?: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
<title>Diploma \u2013 ${claims.studentName ?? ""}</title>
<style>
  @media print { body { margin: 0; } }
  body { font-family: Georgia, serif; background: #fffdf5; display: flex; justify-content: center; padding: 2rem; }
  .cert { border: 12px solid #c9a84c; padding: 3rem 3.5rem; max-width: 700px; width: 100%; text-align: center; }
  .univ { font-size: 0.8rem; letter-spacing: 0.2em; color: #0f3460; text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem; }
  .divider { border: none; border-top: 1px solid #c9a84c; margin: 1.25rem 0; }
  .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; }
  .value { font-weight: bold; color: #1e293b; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 2rem; text-align: left; margin: 0 auto 1rem; max-width: 420px; }
  .chain { font-size: 0.65rem; color: #1d4ed8; font-family: monospace; word-break: break-all; margin-top: 1rem; }
  .did { font-size: 0.6rem; color: #94a3b8; font-family: monospace; word-break: break-all; margin-top: 0.75rem; }
</style>
</head>
<body>
<div class="cert">
  <div style="font-size:3rem">&#127891;</div>
  <div class="univ">${claims.universityName ?? ""}</div>
  <hr class="divider" />
  <p style="font-size:0.8rem;color:#64748b;letter-spacing:0.1em;text-transform:uppercase">This certifies that</p>
  <div style="font-size:2rem;font-style:italic;color:#0f3460;margin:0.5rem 0 1rem">${claims.studentName ?? ""}</div>
  <p style="font-size:0.85rem;color:#475569">has successfully completed the requirements for the degree of</p>
  <div style="font-size:1.3rem;font-weight:bold;color:#1e293b;margin:0.75rem 0">${claims.degree ?? ""}</div>
  <hr class="divider" />
  <div class="grid">
    <div><div class="label">Student ID</div><div class="value">${claims.studentId ?? ""}</div></div>
    <div><div class="label">Graduation Date</div><div class="value">${claims.graduationDate ?? ""}</div></div>
    ${claims.gpa !== undefined ? `<div><div class="label">GPA</div><div class="value">${claims.gpa} / 4.0</div></div>` : ""}
    <div><div class="label">Credential</div><div class="value" style="color:#16a34a">&#10003; Verified on-chain</div></div>
  </div>
  ${cardanoscanUrl ? `<div class="chain">&#9971; Anchored on Cardano:<br>${cardanoscanUrl}</div>` : ""}
  ${claims.universityDid ? `<div class="did">Issued by: ${claims.universityDid}</div>` : ""}
</div>
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
  const win = window.open("", "_blank", "width=800,height=600");
  if (win) { win.document.write(html); win.document.close(); }
}

function CertificateModal({ claims, cardanoscanUrl, walletConfirmedAt, vcHash, onClose }: { claims: DiplomaCredentialSubject; cardanoscanUrl?: string; walletConfirmedAt?: string; vcHash?: string; onClose: () => void }) {
  const overlay: CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: "1rem",
  };
  const cert: CSSProperties = {
    background: "#fffdf5",
    border: "12px solid #c9a84c",
    borderRadius: "4px",
    boxShadow: "0 0 0 4px #0f3460, 0 20px 60px rgba(0,0,0,0.4)",
    padding: "3rem 3.5rem",
    maxWidth: "640px",
    width: "100%",
    position: "relative",
    textAlign: "center",
    fontFamily: "Georgia, serif",
  };
  const corner: CSSProperties = {
    position: "absolute", width: "48px", height: "48px",
    border: "3px solid #c9a84c",
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={cert} onClick={(e) => e.stopPropagation()}>
        {/* Corner decorations */}
        <div style={{ ...corner, top: 8, left: 8, borderRight: "none", borderBottom: "none" }} />
        <div style={{ ...corner, top: 8, right: 8, borderLeft: "none", borderBottom: "none" }} />
        <div style={{ ...corner, bottom: 8, left: 8, borderRight: "none", borderTop: "none" }} />
        <div style={{ ...corner, bottom: 8, right: 8, borderLeft: "none", borderTop: "none" }} />

        {/* Seal */}
        <div style={{ fontSize: "3rem", marginBottom: "0.25rem" }}>🎓</div>

        {/* University */}
        <div style={{ fontSize: "0.8rem", letterSpacing: "0.2em", color: "#0f3460", textTransform: "uppercase", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "0.5rem" }}>
          {claims.universityName}
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "0.75rem 0" }}>
          <div style={{ flex: 1, height: "1px", background: "#c9a84c" }} />
          <div style={{ color: "#c9a84c", fontSize: "1rem" }}>✦</div>
          <div style={{ flex: 1, height: "1px", background: "#c9a84c" }} />
        </div>

        <div style={{ fontSize: "0.8rem", color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          This certifies that
        </div>

        <div style={{ fontSize: "2rem", fontStyle: "italic", color: "#0f3460", margin: "0.5rem 0 1rem" }}>
          {claims.studentName}
        </div>

        <div style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "0.25rem" }}>
          has successfully completed the requirements for the degree of
        </div>

        <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1e293b", margin: "0.75rem 0", lineHeight: 1.3 }}>
          {claims.degree}
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1rem 0" }}>
          <div style={{ flex: 1, height: "1px", background: "#c9a84c" }} />
          <div style={{ color: "#c9a84c", fontSize: "1rem" }}>✦</div>
          <div style={{ flex: 1, height: "1px", background: "#c9a84c" }} />
        </div>

        {/* Details grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem", fontSize: "0.8rem", textAlign: "left", margin: "0 auto", maxWidth: "380px" }}>
          <div>
            <div style={{ color: "#94a3b8", fontFamily: "sans-serif", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Student ID</div>
            <div style={{ fontWeight: 600, color: "#1e293b", fontFamily: "sans-serif" }}>{claims.studentId}</div>
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontFamily: "sans-serif", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Graduation Date</div>
            <div style={{ fontWeight: 600, color: "#1e293b", fontFamily: "sans-serif" }}>{claims.graduationDate}</div>
          </div>
          {claims.gpa !== undefined && (
            <div>
              <div style={{ color: "#94a3b8", fontFamily: "sans-serif", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>GPA</div>
              <div style={{ fontWeight: 600, color: "#1e293b", fontFamily: "sans-serif" }}>{claims.gpa} / 4.0</div>
            </div>
          )}
          <div>
            <div style={{ color: "#94a3b8", fontFamily: "sans-serif", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Credential</div>
            <div style={{ fontWeight: 600, color: "#16a34a", fontFamily: "sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
              <span>✓</span> Verified on-chain
            </div>
          </div>
        </div>

        {/* Blockchain anchor link */}
        {cardanoscanUrl ? (
          <div style={{ marginTop: "1.25rem", padding: "0.6rem 1rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.7rem", fontFamily: "sans-serif", color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>⛓ Anchored on Cardano</span>
            <a
              href={cardanoscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: "0.75rem", color: "#1d4ed8", fontFamily: "sans-serif", fontWeight: 600 }}
            >
              View on Cardanoscan ↗
            </a>
          </div>
        ) : walletConfirmedAt ? (
          <div style={{ marginTop: "1.25rem", padding: "0.6rem 1rem", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.75rem", fontFamily: "sans-serif", color: "#b45309", fontWeight: 600 }}>⏳ Recording to Cardano blockchain… (about 1 min)</span>
          </div>
        ) : null}

        {/* QR code for Cardanoscan link */}
        {cardanoscanUrl && (
          <div style={{ marginTop: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", fontFamily: "sans-serif", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Scan to verify on Cardano</div>
            <div style={{ display: "inline-block", padding: "0.75rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <QRCodeSVG value={cardanoscanUrl} size={130} />
            </div>
          </div>
        )}

        {/* Action buttons row */}
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
          {cardanoscanUrl && (
            <button
              onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(cardanoscanUrl); }}
              style={{ padding: "6px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "4px", cursor: "pointer", fontFamily: "sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "#1d4ed8" }}
            >
              📋 Copy Cardano Link
            </button>
          )}
          {vcHash && (
            <button
              onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(vcHash); }}
              style={{ padding: "6px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", cursor: "pointer", fontFamily: "sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}
            >
              📋 Copy vcHash
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); printCertificate(claims, cardanoscanUrl); }}
            style={{ padding: "6px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", cursor: "pointer", fontFamily: "sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}
          >
            🖨 Print Certificate
          </button>
          <button
            onClick={onClose}
            style={{ padding: "6px 24px", background: "#0f3460", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontFamily: "sans-serif", fontWeight: 600, fontSize: "0.85rem" }}
          >
            Close
          </button>
        </div>
        {/* Issuer DID */}
        {claims.universityDid && (
          <div style={{ marginTop: "0.75rem", fontSize: "0.65rem", color: "#94a3b8", fontFamily: "monospace", wordBreak: "break-all" }}>
            Issued by: {claims.universityDid}
          </div>
        )}
      </div>
    </div>
  );
}

export function DiplomaCard({ credential, compact = false, revoked = false, revocationReason, revocationDate, cardanoscanUrl, cardanoRevocationUrl, walletConfirmedAt, vcHash }: DiplomaCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const claims = extractClaims(credential);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const cardStyle: CSSProperties = {
    background: compact ? "transparent" : revoked ? "#fff5f5" : "#fff",
    border: compact ? "none" : revoked ? "1px solid #fca5a5" : "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: compact ? "0.75rem 1rem" : "1.5rem",
    marginBottom: compact ? 0 : "1rem",
    cursor: compact ? "default" : "pointer",
    transition: "box-shadow 0.15s, border-color 0.15s",
    position: "relative",
    opacity: revoked ? 0.75 : 1,
  };

  if (!claims) {
    return (
      <div style={cardStyle}>
        <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Unknown credential format</span>
      </div>
    );
  }

  return (
    <>
      <div
        style={cardStyle}
        onClick={() => !compact && !revoked && setShowModal(true)}
        onMouseEnter={(e) => { if (!compact && !revoked) { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; (e.currentTarget as HTMLDivElement).style.borderColor = "#c9a84c"; } }}
        onMouseLeave={(e) => { if (!compact && !revoked) { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0"; } }}
      >
        {!compact && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            {revoked ? (
              <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: "999px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600 }}>
                ✕ Revoked
              </span>
            ) : (
              <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: "999px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600 }}>
                ✓ Verified Diploma
              </span>
            )}
            {!revoked && <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Click to view certificate</span>}
          </div>
        )}
        {revoked && revocationReason && !compact && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "8px 12px", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
            <span style={{ color: "#991b1b", fontWeight: 600 }}>Reason: </span>
            <span style={{ color: "#7f1d1d" }}>{revocationReason}</span>
            {revocationDate && (
              <span style={{ color: "#94a3b8", marginLeft: "8px", fontSize: "0.75rem" }}>
                — {new Date(revocationDate).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: compact ? "0.9rem" : "1.1rem" }}>
          {claims.degree ?? "Diploma"}
        </div>
        <div style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "2px" }}>
          {claims.universityName ?? "University"}
        </div>
        {!compact && (
          <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", fontSize: "0.8rem" }}>
            <div><span style={{ color: "#94a3b8" }}>Student: </span>{claims.studentName}</div>
            <div><span style={{ color: "#94a3b8" }}>ID: </span>{claims.studentId}</div>
            <div><span style={{ color: "#94a3b8" }}>Graduated: </span>{claims.graduationDate}</div>
            {claims.gpa !== undefined && (
              <div><span style={{ color: "#94a3b8" }}>GPA: </span>{claims.gpa}</div>
            )}
          </div>
        )}
        {!compact && !revoked && (cardanoscanUrl || walletConfirmedAt) && (
          <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {cardanoscanUrl ? (
              <a
                href={cardanoscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.78rem", color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}
              >
                ⛓ Anchored on Cardano ↗
              </a>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.78rem", color: "#b45309", fontWeight: 600 }}>
                ⏳ Recording to Cardano blockchain…
              </div>
            )}
            {cardanoscanUrl && (
              <button
                onClick={(e) => { e.stopPropagation(); copy(cardanoscanUrl, "link"); }}
                style={{ padding: "3px 10px", background: copied === "link" ? "#dcfce7" : "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: copied === "link" ? "#15803d" : "#475569" }}
              >
                {copied === "link" ? "✓ Copied" : "📋 Copy Link"}
              </button>
            )}
            {vcHash && (
              <button
                onClick={(e) => { e.stopPropagation(); copy(vcHash, "hash"); }}
                style={{ padding: "3px 10px", background: copied === "hash" ? "#dcfce7" : "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: copied === "hash" ? "#15803d" : "#475569" }}
              >
                {copied === "hash" ? "✓ Copied" : "📋 Copy vcHash"}
              </button>
            )}
          </div>
        )}
        {!compact && revoked && (cardanoscanUrl || cardanoRevocationUrl) && (
          <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #fecaca", display: "flex", flexDirection: "column", gap: "4px" }}>
            {cardanoscanUrl && (
              <a
                href={cardanoscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.78rem", color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}
              >
                ⛓ Issuance anchor ↗
              </a>
            )}
            {cardanoRevocationUrl && (
              <a
                href={cardanoRevocationUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.78rem", color: "#dc2626", fontWeight: 600, textDecoration: "none" }}
              >
                ⛓ Revocation on-chain ↗
              </a>
            )}
          </div>
        )}
      </div>

      {showModal && <CertificateModal claims={claims} cardanoscanUrl={cardanoscanUrl} walletConfirmedAt={walletConfirmedAt} vcHash={vcHash} onClose={() => setShowModal(false)} />}
    </>
  );
}
