import { Router } from "express";
import { hashVc, writeVcHashToCardano, getWalletInfo } from "../services/cardanoWriter.js";
import { CardanoVcHashPayload } from "@university-diplomas/common";
import { listStudents, updateIssuedCredentialCardano } from "../services/studentStore.js";

export const cardanoRouter = Router();

/** In-memory map from vcHash (hex SHA-256 of canonical VC) → Cardano txHash.
 *  Rebuilt from students.json on startup so restarts don't break lookup. */
const vcHashToTxHash = new Map<string, string>();

function rebuildHashMap() {
  try {
    const students = listStudents();
    for (const student of students) {
      for (const cred of student.issuedCredentials ?? []) {
        if (cred.vcHash && cred.cardanoTxHash) {
          vcHashToTxHash.set(cred.vcHash, cred.cardanoTxHash);
        }
      }
    }
    console.log(`[cardano] Rebuilt hash map: ${vcHashToTxHash.size} entries`);
  } catch (e) {
    console.warn("[cardano] Could not rebuild hash map:", e);
  }
}

rebuildHashMap();

/**
 * GET /api/cardano/wallet-info
 *
 * Returns the Cardano wallet address and current ADA balance.
 * Useful for diagnosing insufficient-funds errors.
 */
cardanoRouter.get("/wallet-info", async (_req, res) => {
  try {
    const info = await getWalletInfo();
    res.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cardano/wallet-info] error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/cardano/retry-stuck
 *
 * Finds all credentials with walletConfirmedAt but no cardanoTxHash and
 * re-submits them to Cardano, saving the result to students.json.
 * Writes are serialized (25s apart) to avoid UTXO collision.
 */
cardanoRouter.post("/retry-stuck", async (_req, res) => {
  const students = listStudents();
  const stuck: Array<{ studentId: string; credentialRecordId: string; degree: string; studentNumber: string; studentName: string; gpa?: number; graduationDate?: string; universityName?: string; issuingDid?: string; issuedAt?: string }> = [];

  for (const student of students) {
    for (const cred of student.issuedCredentials ?? []) {
      if (cred.walletConfirmedAt && !cred.cardanoTxHash) {
        stuck.push({
          studentId: student.id,
          credentialRecordId: cred.credentialRecordId,
          degree: cred.degree ?? "",
          studentNumber: (student as unknown as Record<string, string>).studentNumber ?? student.id,
          studentName: (student as unknown as Record<string, string>).name ?? "Unknown",
          gpa: cred.gpa,
          graduationDate: cred.graduationDate,
          universityName: cred.universityName,
          issuingDid: cred.issuingDid,
          issuedAt: cred.issuedAt,
        });
      }
    }
  }

  res.json({ queued: stuck.length, credentials: stuck.map((s) => `${s.studentName} / ${s.degree}`) });

  // Process in background, one at a time (writeVcHashToCardano already queues internally)
  void (async () => {
    for (const item of stuck) {
      const vc = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        id: `urn:credential:${item.credentialRecordId}`,
        type: ["VerifiableCredential", "DiplomaCredential2022"],
        issuer: item.issuingDid ?? "did:prism:unknown",
        issuanceDate: item.issuedAt ?? new Date().toISOString(),
        credentialSubject: {
          degree: item.degree,
          graduationDate: item.graduationDate ?? "",
          gpa: item.gpa,
          studentId: item.studentNumber,
          studentName: item.studentName,
          universityName: item.universityName ?? "",
          universityDid: item.issuingDid ?? "did:prism:unknown",
        },
      };

      const vcHash = hashVc(vc);
      const payload: CardanoVcHashPayload = {
        label: 674,
        vcId: vc.id,
        vcHash,
        universityDid: item.issuingDid ?? "did:prism:unknown",
        universityName: item.universityName ?? "",
        studentId: item.studentNumber,
        degree: item.degree,
        gpa: item.gpa != null ? String(item.gpa) : undefined,
        issuedAt: new Date().toISOString(),
      };

      try {
        const result = await writeVcHashToCardano(payload);
        updateIssuedCredentialCardano(item.studentId, item.credentialRecordId, result.txHash, result.cardanoscanUrl, vcHash);
        console.log(`[cardano/retry-stuck] OK: ${item.studentName} / ${item.degree} -> ${result.txHash}`);
      } catch (e) {
        console.error(`[cardano/retry-stuck] FAILED: ${item.studentName} / ${item.degree}:`, e instanceof Error ? e.message : String(e));
      }
    }
    console.log("[cardano/retry-stuck] All done.");
  })();
});

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
      universityName: (credentialSubject.universityName ?? process.env.VITE_UNIVERSITY_NAME ?? "") as string,
      studentId: (credentialSubject.studentId ?? "unknown") as string,
      degree: (credentialSubject.degree ?? "") as string,
      gpa: credentialSubject.gpa != null ? String(credentialSubject.gpa) : undefined,
      issuedAt: new Date().toISOString(),
    };

    const result = await writeVcHashToCardano(payload);

    // Store mapping so the verifier can look up by vcHash later
    vcHashToTxHash.set(vcHash, result.txHash);

    res.json({ ...result, vcHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cardano/write-vc-hash] error:", message);
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

    // Primary lookup: hash-based (works when vcHash was stored at issuance)
    let txHash = vcHashToTxHash.get(vcHash);

    // Fallback: match by credentialSubject fields stored in students.json.
    // Needed for credentials issued before vcHash storage was added.
    if (!txHash) {
      const subj = (vc.credentialSubject ?? {}) as Record<string, unknown>;
      const degree = subj.degree as string | undefined;
      const graduationDate = subj.graduationDate as string | undefined;
      const studentId = subj.studentId as string | undefined;

      if (degree || graduationDate) {
        outer: for (const student of listStudents()) {
          for (const cred of student.issuedCredentials ?? []) {
            if (!cred.cardanoTxHash) continue;
            const degreeMatch = !degree || cred.degree === degree;
            const dateMatch = !graduationDate || cred.graduationDate === graduationDate;
            const sidMatch = !studentId || student.studentNumber === studentId;
            if (degreeMatch && dateMatch && sidMatch) {
              txHash = cred.cardanoTxHash;
              break outer;
            }
          }
        }
      }
    }

    if (!txHash) {
      console.log("[cardano/lookup-by-jwt] no match for vcHash:", vcHash);
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
