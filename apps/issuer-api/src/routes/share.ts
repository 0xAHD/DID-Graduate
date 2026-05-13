import { Router } from "express";
import jwt from "jsonwebtoken";
import {
  createShare,
  getShare,
  deleteShare,
  getSharesForStudent,
} from "../services/shareStore.js";
import { findById } from "../services/studentStore.js";

export const shareRouter = Router();

const JWT_SECRET =
  process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-prod-please";

function verifyToken(authHeader?: string): { sub: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: string };
  } catch {
    return null;
  }
}

function verifierPortalUrl(): string {
  return process.env.VERIFIER_PORTAL_URL ?? "http://localhost:5175";
}

// ── POST /api/share ────────────────────────────────────────────────────────────
// Authenticated. Creates (or returns existing) share link for a credential.
shareRouter.post("/", (req, res) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { credentialRecordId } = (req.body ?? {}) as {
    credentialRecordId?: string;
  };
  if (!credentialRecordId || typeof credentialRecordId !== "string") {
    return res.status(400).json({ error: "credentialRecordId is required" });
  }

  const student = findById(user.sub);
  if (!student) return res.status(404).json({ error: "Student not found" });

  // Verify the credential belongs to this student and is not revoked
  const cred = (student.issuedCredentials ?? []).find(
    (c) => c.credentialRecordId === credentialRecordId
  );
  if (!cred) return res.status(404).json({ error: "Credential not found" });
  if (cred.revoked) {
    return res.status(400).json({ error: "Cannot share a revoked credential" });
  }

  const share = createShare(user.sub, credentialRecordId);
  const url = `${verifierPortalUrl()}/share/${share.token}`;
  return res.json({ token: share.token, url, createdAt: share.createdAt });
});

// ── GET /api/share ─────────────────────────────────────────────────────────────
// Authenticated. Lists all active share links for the logged-in student.
shareRouter.get("/", (req, res) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const shares = getSharesForStudent(user.sub);
  const base = verifierPortalUrl();
  return res.json(
    shares.map((s) => ({
      token: s.token,
      credentialRecordId: s.credentialRecordId,
      createdAt: s.createdAt,
      url: `${base}/share/${s.token}`,
    }))
  );
});

// ── GET /api/share/:token ──────────────────────────────────────────────────────
// Public — no auth required. Returns the public diploma data for the share.
shareRouter.get("/:token", (req, res) => {
  const { token } = req.params;

  // Basic sanity-check: tokens are 40 hex chars
  if (!/^[0-9a-f]{40}$/i.test(token)) {
    return res.status(404).json({ error: "Share not found" });
  }

  const share = getShare(token);
  if (!share) return res.status(404).json({ error: "Share not found" });

  const student = findById(share.studentId);
  if (!student) return res.status(404).json({ error: "Share not found" });

  const cred = (student.issuedCredentials ?? []).find(
    (c) => c.credentialRecordId === share.credentialRecordId
  );
  if (!cred) return res.status(404).json({ error: "Share not found" });

  // Return only public-safe fields — no internal IDs, no email, no wallet data
  return res.json({
    degree: cred.degree,
    graduationDate: cred.graduationDate,
    gpa: cred.gpa,
    studentName: cred.studentName,
    universityName: cred.universityName,
    issuingDid: cred.issuingDid,
    vcHash: cred.vcHash,
    cardanoTxHash: cred.cardanoTxHash,
    cardanoscanUrl: cred.cardanoscanUrl,
    cardanoRevocationTxHash: cred.cardanoRevocationTxHash,
    cardanoRevocationUrl: cred.cardanoRevocationUrl,
    revoked: cred.revoked,
    revocationReason: cred.revocationReason,
    revocationConfirmedAt: cred.revocationConfirmedAt,
    issuedAt: cred.issuedAt,
    walletConfirmedAt: cred.walletConfirmedAt,
    sharedAt: share.createdAt,
  });
});

// ── DELETE /api/share/:token ───────────────────────────────────────────────────
// Authenticated. Revokes the share link.
shareRouter.delete("/:token", (req, res) => {
  const user = verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { token } = req.params;
  const deleted = deleteShare(token, user.sub);
  if (!deleted) return res.status(404).json({ error: "Share not found" });

  return res.json({ success: true });
});
