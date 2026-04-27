import { Router } from "express";
import { hashVc, writeVcHashToCardano } from "../services/cardanoWriter.js";
import { CardanoVcHashPayload } from "@university-diplomas/common";

export const cardanoRouter = Router();

/** In-memory map from vcHash (hex SHA-256 of canonical VC) → Cardano txHash */
const vcHashToTxHash = new Map<string, string>();

/**
 * POST /api/cardano/write-vc-hash
 *
 * Body: { vc: object }
 * Response: { txHash: string, cardanoscanUrl: string, vcHash: string }
 *
 * Called by the issuer portal after a credential is confirmed issued.
 * Computes the VC hash server-side and submits a Cardano metadata transaction.
 */
cardanoRouter.post("/write-vc-hash", async (req, res) => {
  try {
    const { vc } = req.body as { vc: unknown };

    // Input validation
    if (!vc || typeof vc !== "object") {
      res.status(400).json({ error: "Missing or invalid 'vc' field in request body" });
      return;
    }

    const vcObj = vc as Record<string, unknown>;

    if (typeof vcObj.id !== "string" || !vcObj.id) {
      res.status(400).json({ error: "VC must have a non-empty 'id' field" });
      return;
    }

    // Compute hash
    const vcHash = hashVc(vc);

    // Extract fields needed for metadata
    const credentialSubject = (vcObj.credentialSubject ?? {}) as Record<string, unknown>;
    const issuer =
      typeof vcObj.issuer === "string"
        ? vcObj.issuer
        : (vcObj.issuer as Record<string, string>)?.id ?? "";

    const payload: CardanoVcHashPayload = {
      label: 674,
      vcId: vcObj.id as string,
      vcHash,
      universityDid: (credentialSubject.universityDid ?? issuer) as string,
      studentId: (credentialSubject.studentId ?? "unknown") as string,
      issuedAt: new Date().toISOString(),
    };

    const result = await writeVcHashToCardano(payload);

    // Store mapping so the verifier can look up by vcHash later
    vcHashToTxHash.set(vcHash, result.txHash);

    res.json({ ...result, vcHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cardano/write-vc-hash] error:", message);
    // Don't leak internal error details to client
    res.status(500).json({ error: "Failed to write VC hash to Cardano. Check server logs." });
  }
});

/**
 * GET /api/cardano/verify-hash?txHash=<hash>&vcHash=<hash>
 *
 * Fetches the Cardano transaction metadata from Blockfrost and confirms
 * the stored hash matches the provided vcHash.
 */
cardanoRouter.get("/verify-hash", async (req, res) => {
  try {
    const { txHash, vcHash } = req.query as { txHash?: string; vcHash?: string };

    if (!txHash || !vcHash) {
      res.status(400).json({ error: "txHash and vcHash query params are required" });
      return;
    }

    // Fetch metadata from Blockfrost
    const projectId = process.env.BLOCKFROST_PROJECT_ID;
    if (!projectId) {
      res.status(503).json({ error: "Blockfrost not configured" });
      return;
    }

    const bfUrl = `https://cardano-preprod.blockfrost.io/api/v0/txs/${txHash}/metadata`;
    const bfRes = await fetch(bfUrl, {
      headers: { project_id: projectId },
    });

    if (!bfRes.ok) {
      res.status(404).json({ error: "Transaction not found on Blockfrost" });
      return;
    }

    const metadata = (await bfRes.json()) as Array<{
      label: string;
      json_metadata: Record<string, unknown>;
    }>;

    const label674Entry = metadata.find((m) => m.label === "674");
    if (!label674Entry) {
      res.status(404).json({ error: "No metadata label 674 found in transaction" });
      return;
    }

    const storedHash = label674Entry.json_metadata.vcHash as string | undefined;
    const matches = storedHash === vcHash;

    res.json({
      matches,
      storedHash: storedHash ?? null,
      providedHash: vcHash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cardano/verify-hash] error:", message);
    res.status(500).json({ error: "Failed to verify hash on Cardano" });
  }
});

/**
 * POST /api/cardano/lookup-by-jwt
 *
 * Body: { vcJwt: string }
 * Response: { verified: boolean, txId?: string }
 *
 * Called by the verifier portal after credential presentation is confirmed.
 * Decodes the VC JWT, hashes the VC payload with the same algorithm used
 * at issuance, then looks up the Cardano txHash from the in-memory store.
 */
cardanoRouter.post("/lookup-by-jwt", (req, res) => {
  try {
    const { vcJwt } = req.body as { vcJwt?: unknown };

    if (!vcJwt || typeof vcJwt !== "string") {
      res.status(400).json({ error: "Missing or invalid 'vcJwt' field" });
      return;
    }

    // Decode the JWT payload (no signature verification needed — agent already verified it)
    const parts = vcJwt.split(".");
    if (parts.length !== 3) {
      res.status(400).json({ error: "Invalid JWT format" });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    } catch {
      res.status(400).json({ error: "Failed to decode JWT payload" });
      return;
    }

    // Extract the VC from the JWT claims (standard JWT-VC wrapping)
    const vc = (payload.vc ?? payload) as Record<string, unknown>;
    const vcHash = hashVc(vc);

    const txHash = vcHashToTxHash.get(vcHash);
    if (!txHash) {
      res.json({ verified: false });
      return;
    }

    res.json({ verified: true, txId: txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cardano/lookup-by-jwt] error:", message);
    res.status(500).json({ error: "Failed to look up VC hash" });
  }
});
