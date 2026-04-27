/**
 * Verifier portal service — calls the Verifier Cloud Agent REST API.
 * Note: The verifier agent API is called from the browser directly
 * (no backend needed for the verifier). API key auth is disabled in dev mode.
 * In production, proxy through a backend to keep the verifier API key private.
 */
import type { AgentConnection, AgentPresentationRecord } from "@university-diplomas/common";

export interface ConnectionRecord {
  connectionId: string;
  state: string;
  thid?: string;
  invitation?: { invitationUrl: string; id?: string };
}

export type PresentationRecord = AgentPresentationRecord;

const VERIFIER_AGENT = import.meta.env.VITE_VERIFIER_AGENT_URL ?? "http://127.0.0.1:9000";
const VERIFIER_API_KEY = import.meta.env.VITE_VERIFIER_API_KEY ?? "";

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (VERIFIER_API_KEY) h["apikey"] = VERIFIER_API_KEY;
  return h;
}

// ── Connections ────────────────────────────────────────────────────────────────

export async function createVerifierConnection(label = "verifier-session"): Promise<ConnectionRecord> {
  const res = await fetch(`${VERIFIER_AGENT}/connections`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ label }),
  });
  if (!res.ok) throw new Error(`createVerifierConnection: ${res.status} ${res.statusText}`);
  return res.json() as Promise<ConnectionRecord>;
}

export async function pollConnectionRecord(connectionId: string): Promise<ConnectionRecord> {
  const res = await fetch(`${VERIFIER_AGENT}/connections/${connectionId}`, { headers: headers() });
  if (!res.ok) throw new Error(`pollConnectionRecord: ${res.status}`);
  return res.json() as Promise<ConnectionRecord>;
}

export async function listVerifierConnections(): Promise<AgentConnection[]> {
  const res = await fetch(`${VERIFIER_AGENT}/connections`, { headers: headers() });
  if (!res.ok) throw new Error(`listVerifierConnections: ${res.status}`);
  const data = await res.json();
  return (data.contents ?? []) as AgentConnection[];
}

// ── Proof Requests ─────────────────────────────────────────────────────────────

export interface CreateProofRequestBody {
  connectionId: string;
  issuingDid: string;
  schemaId: string;
  challenge?: string;
}

/**
 * Creates a Presentation Request (proof request) on the verifier agent.
 * The student's wallet will receive this via DIDComm and must respond with a VP.
 */
export async function createProofRequest(body: CreateProofRequestBody): Promise<{ presentationId: string }> {
  const res = await fetch(`${VERIFIER_AGENT}/present-proof/presentations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      connectionId: body.connectionId,
      proofs: [
        {
          schemaId: body.schemaId,
          trustIssuers: [body.issuingDid],
        },
      ],
      options: {
        challenge: body.challenge ?? crypto.randomUUID(),
        domain: window.location.hostname,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createProofRequest: ${res.status} — ${text}`);
  }
  return res.json();
}

/** Polls a presentation record until it reaches a terminal state */
export async function pollPresentationRecord(
  presentationId: string,
  maxAttempts = 40,
  intervalMs = 3_000
): Promise<AgentPresentationRecord> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${VERIFIER_AGENT}/present-proof/presentations/${presentationId}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`pollPresentationRecord: ${res.status}`);
    const record = (await res.json()) as AgentPresentationRecord;

    if (record.status === "PresentationVerified") return record;
    if (record.status === "PresentationFailed") {
      throw new Error("Presentation verification failed — signature invalid or credential not trusted");
    }
    await sleep(intervalMs);
  }
  throw new Error("Presentation request timed out — student may not have responded yet");
}

export async function listPresentationRecords(): Promise<AgentPresentationRecord[]> {
  const res = await fetch(`${VERIFIER_AGENT}/present-proof/presentations`, { headers: headers() });
  if (!res.ok) throw new Error(`listPresentationRecords: ${res.status}`);
  const data = await res.json();
  return (data.contents ?? []) as AgentPresentationRecord[];
}

// ── Cardano hash verification ──────────────────────────────────────────────────

/**
 * Asks issuer-api to verify the VC JWT against Cardano metadata.
 * The backend hashes the VC from the JWT and looks up the stored txHash.
 */
export async function verifyCardanoHash(vcJwt: string): Promise<{ verified: boolean; txId?: string }> {
  const issuerApiBase = import.meta.env.VITE_ISSUER_API_URL ?? "http://localhost:3010";
  const url = `${issuerApiBase}/api/cardano/lookup-by-jwt`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vcJwt }),
  });
  if (!res.ok) return { verified: false };
  return res.json() as Promise<{ verified: boolean; txId?: string }>;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
